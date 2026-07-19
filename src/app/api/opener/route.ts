import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { LIMITS } from "~/lib/apiLimits";
import { buildRetrievalBlockFromCandidates } from "~/lib/opportunities";
import { OPENER_SYSTEM_PROMPT, OPENING_MESSAGE, parseOpener } from "~/lib/prompts";
import { checkCombinedRateLimit, clientIpFrom } from "~/lib/rateLimit";
import { ensureSessionCookie, readSessionId } from "~/lib/session";
import { semanticRetrieve } from "~/lib/semanticRetrieval";
import type { OpenerRequest, OpenerResponse } from "~/lib/types";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 2 });

const FALLBACK_SUGGESTIONS = [
  "Something competitive",
  "Something creative",
  "Something hands-on",
  "Not sure yet",
];

const OPENER_RATE_LIMIT = 20;
const OPENER_RATE_WINDOW_MS = 5 * 60 * 1000;

/** Wraps NextResponse.json and always attaches the anonymous session cookie, on every exit path. */
function respond(
  request: Request,
  body: OpenerResponse,
  init?: ResponseInit,
): NextResponse<OpenerResponse> {
  const res = NextResponse.json(body, init);
  ensureSessionCookie(request, res);
  return res;
}

export async function POST(request: Request): Promise<NextResponse<OpenerResponse>> {
  const { allowed, retryAfterSeconds } = checkCombinedRateLimit(
    clientIpFrom(request),
    readSessionId(request),
    OPENER_RATE_LIMIT,
    OPENER_RATE_WINDOW_MS,
  );
  if (!allowed) {
    return respond(
      request,
      { message: OPENING_MESSAGE, suggestions: FALLBACK_SUGGESTIONS },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  let body: OpenerRequest;
  try {
    body = (await request.json()) as OpenerRequest;
  } catch {
    body = { categories: [] };
  }

  const categories = Array.isArray(body.categories)
    ? body.categories
        .filter((c): c is string => typeof c === "string" && c.length > 0 && c.length <= 100)
        .slice(0, LIMITS.MAX_CATEGORIES)
    : [];
  const filters = categories.length === 1 ? { category: categories[0] } : {};
  const candidates = await semanticRetrieve(anthropic, categories.join(", "), filters);
  const retrievalBlock = buildRetrievalBlockFromCandidates(candidates);
  const situation = categories.length
    ? `Their picked categories from a quick tap-only warm-up: ${categories.join(", ")}.`
    : `They haven't picked any category yet — keep the opening question broad and easy.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 160,
      // Fixed constant across every request — same cache benefit as chat/route.ts.
      system: [{ type: "text", text: OPENER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `${situation}\n\n${retrievalBlock}` }],
    });

    const block = response.content[0];
    if (block?.type !== "text") throw new Error("Unexpected response type from Claude");

    return respond(request, parseOpener(block.text));
  } catch (err) {
    console.error("[opener/route] Claude API error:", err);
    return respond(request, { message: OPENING_MESSAGE, suggestions: FALLBACK_SUGGESTIONS });
  }
}
