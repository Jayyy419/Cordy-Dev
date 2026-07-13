import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { env } from "~/env";
import {
  buildRetrievalBlockFromCandidates,
  confidenceFromFilters,
  matchOpportunities,
} from "~/lib/opportunities";
import {
  buildProfileFromReply,
  CONFIDENCE_STOP,
  inferFiltersFromTranscript,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  parseReply,
  SYSTEM_PROMPT,
} from "~/lib/prompts";
import { checkCombinedRateLimit, clientIpFrom } from "~/lib/rateLimit";
import { ensureSessionCookie, readSessionId } from "~/lib/session";
import { semanticRetrieve } from "~/lib/semanticRetrieval";
import type {
  ChatRequest,
  ChatResponse,
  Opportunity,
  OpportunityFilters,
} from "~/lib/types";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 2 });

// Each turn costs two model calls (a fast rerank + the main reply), so the
// window is a little tighter than a naive "one call per request" limit.
const CHAT_RATE_LIMIT = 20;
const CHAT_RATE_WINDOW_MS = 5 * 60 * 1000;

/** Wraps NextResponse.json and always attaches the anonymous session cookie, on every exit path. */
function respond(
  request: Request,
  body: ChatResponse,
  init?: ResponseInit,
): NextResponse<ChatResponse> {
  const res = NextResponse.json(body, init);
  ensureSessionCookie(request, res);
  return res;
}

export async function POST(request: Request): Promise<NextResponse<ChatResponse>> {
  const { allowed, retryAfterSeconds } = checkCombinedRateLimit(
    clientIpFrom(request),
    readSessionId(request),
    CHAT_RATE_LIMIT,
    CHAT_RATE_WINDOW_MS,
  );
  if (!allowed) {
    return respond(
      request,
      {
        message: "CORDY needs a quick breather — try again in a minute!",
        suggestions: [],
        confidence: 0,
        done: false,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return respond(
      request,
      { message: "Invalid request body", suggestions: [], confidence: 0, done: false },
      { status: 400 },
    );
  }

  const { messages, questionsAsked, maxQuestions } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return respond(
      request,
      { message: "messages must be a non-empty array", suggestions: [], confidence: 0, done: false },
      { status: 400 },
    );
  }

  // Ground this turn's question in the real catalog: infer a rough filter
  // set from everything said so far, then have a fast model semantically
  // re-rank a candidate pool by relevance to the actual conversation (a
  // stand-in two-stage retrieval pipeline for a real embeddings/vector
  // search once one exists — see semanticRetrieval.ts) so the next
  // question targets an actual discriminating field, not generic trivia.
  const transcriptText = messages.map((m) => m.content).join("\n");
  const inferredFilters = inferFiltersFromTranscript(transcriptText);
  const candidates = await semanticRetrieve(anthropic, transcriptText, inferredFilters);
  const retrievalBlock = buildRetrievalBlockFromCandidates(candidates);

  // Confidence is computed deterministically from real match scores, not
  // asked of the model — it can only move the way the data actually
  // supports, so it can't visibly regress turn to turn.
  const computedConfidence = confidenceFromFilters(inferredFilters);

  // Pacing is decided server-side within [MIN_QUESTIONS, effectiveMax].
  // effectiveMax is normally MAX_QUESTIONS, but the client may raise it when
  // the user opts to "keep chatting" after already seeing a results screen.
  const effectiveMax = maxQuestions && maxQuestions > 0 ? maxQuestions : MAX_QUESTIONS;
  const forcedContinue = questionsAsked < MIN_QUESTIONS;
  const forcedFinal = questionsAsked >= effectiveMax;
  const pacingInstruction = forcedFinal
    ? `PACING: This is the FINAL turn — the question limit has been reached. Your REPLY must be a warm wrap-up with NO new question, DONE must be true.`
    : forcedContinue
      ? `PACING: You must continue — ask one more discriminating question. DONE must be false.`
      : `PACING: The computed match confidence is ${computedConfidence}%. You may wrap up now (DONE: true) ONLY if that is roughly ${CONFIDENCE_STOP}+ ; otherwise ask one more discriminating question (DONE: false).`;

  const messagesWithContext = [
    ...messages,
    {
      role: "user" as const,
      content: `[SYSTEM CONTEXT — not visible to the user]\n${retrievalBlock}\n\n${pacingInstruction}`,
    },
  ];

  let rawMessage: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messagesWithContext,
    });

    const block = response.content[0];
    if (block?.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }
    rawMessage = block.text;
  } catch (err) {
    console.error("[chat/route] Claude API error:", err);
    return respond(
      request,
      { message: "Something went wrong. Please try again.", suggestions: [], confidence: 0, done: false },
      { status: 502 },
    );
  }

  const parsed = parseReply(rawMessage);
  const done = forcedFinal ? true : forcedContinue ? false : parsed.done;

  if (!done) {
    return respond(request, {
      message: parsed.reply,
      suggestions: parsed.suggestions,
      confidence: computedConfidence,
      done: false,
    });
  }

  // Wrap-up turn — build the full profile and fetch matching opportunities.
  // Prefer the model's own FILTERS if it gave one (it's seen the whole
  // conversation), fall back to the transcript-inferred set.
  const profileData = buildProfileFromReply(parsed);
  profileData.filters = profileData.filters ?? inferredFilters;
  const queries = profileData._opportunityQueries ?? [];
  profileData._opportunityQueries = undefined;

  profileData.opportunities = await fetchOpportunities(queries, profileData.tags, profileData.filters);

  return respond(request, {
    message: parsed.reply,
    suggestions: [],
    confidence: Math.max(computedConfidence, confidenceFromFilters(profileData.filters ?? {})),
    done: true,
    profile: profileData,
  });
}

async function fetchOpportunities(
  queries: string[],
  tags: string[],
  filters: OpportunityFilters | undefined,
): Promise<Opportunity[]> {
  if (env.CORDY_API_URL) {
    try {
      const results = await Promise.all(
        queries.map((q) =>
          fetch(`${env.CORDY_API_URL}/opportunities?q=${encodeURIComponent(q)}`)
            .then((r) => r.json() as Promise<Opportunity[]>),
        ),
      );
      const seen = new Set<string>();
      return results
        .flat()
        .filter((o) => {
          if (seen.has(o.id)) return false;
          seen.add(o.id);
          return true;
        })
        .slice(0, 6);
    } catch (err) {
      console.error("[chat/route] CORDY API error, falling back:", err);
    }
  }

  // No CORDY_API_URL configured — match against the local placeholder
  // catalog using the structured filters CORDY collected, keyed on the same
  // real fields (category/subTags/format/groupSize/skillLevel/age) a real
  // backend would filter on. Only fall back to a generic templated
  // programme if the catalog genuinely has no match.
  const catalogMatches = filters ? matchOpportunities(filters, 4) : [];
  if (catalogMatches.length > 0) return catalogMatches;

  return generateFallbackOpportunities(tags);
}

function generateFallbackOpportunities(tags: string[]): Opportunity[] {
  const tagList = tags.slice(0, 3).join(", ");
  return [
    {
      id: "fallback-1",
      title: "Youth Interest Workshop",
      description: `A hands-on programme exploring ${tagList} with like-minded young people in Singapore.`,
      tags,
    },
    {
      id: "fallback-2",
      title: "Community Impact Project",
      description: `Collaborate with peers to create real change in areas you care about, including ${tagList}.`,
      tags,
    },
    {
      id: "fallback-3",
      title: "Skills Accelerator Programme",
      description: `Build practical skills in ${tagList} through mentorship and project-based learning.`,
      tags,
    },
  ];
}
