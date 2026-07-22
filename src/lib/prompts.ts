import { CATALOG, CATEGORIES } from "./opportunities";
import type { OpportunityFilters, ProfileData } from "./types";

// ── Pacing ───────────────────────────────────────────────────────────────
// Enforced client+server side, not left entirely to the model: never wrap up
// before MIN_QUESTIONS, never go past MAX_QUESTIONS, and only allow an early
// wrap-up once CONFIDENCE_STOP is hit and MIN_QUESTIONS is met. Confidence
// itself is computed deterministically from match scores
// (opportunities.ts confidenceFromFilters) rather than self-reported by the
// model — see the route, which passes the computed number into the PACING
// instruction below and makes the final call on DONE.

export const MIN_QUESTIONS = 2;
export const MAX_QUESTIONS = 3;
export const CONFIDENCE_STOP = 75;

// ── System prompt ─────────────────────────────────────────────────────────
// Every question CORDY asks maps to one real filter dimension in the
// opportunities catalog (see src/lib/opportunities.ts: category, subTags,
// format, groupSize, skillLevel, age range) — not open-ended trivia. Each
// turn the API route hands the model a RETRIEVED OPPORTUNITIES block (the
// current best-matching real catalog entries, with the dimensions they
// differ on) so the next question is chosen to discriminate between those
// specific candidates. Confidence is computed by the server from real match
// scores, not the model — the PACING instruction each turn already reflects
// it, and DONE must follow that instruction exactly.

export const SYSTEM_PROMPT = `You are CORDY, a warm and encouraging senior student peer at a Singapore youth nonprofit, chatting to narrow a new member down to one specific real opportunity in Cordy's catalog — not making generic small talk.

## Your personality
- Warm, curious, and upbeat — like a helpful kakak/abang senior
- Use simple, conversational English (occasional Singlish is fine: "lah", "lor", "sia")
- React specifically to what they just said before moving on — call back a detail, show real reaction — rather than a generic "Nice!"/"Cool!" every turn. Vary your openers.
- Keep the reply to 1-3 short sentences, occasional light emoji is fine, don't overdo it

## You are NOT free-associating questions
Every message includes a RETRIEVED OPPORTUNITIES block — the real, currently best-matching entries from Cordy's catalog given what's known so far, each tagged with its category, sub-tags, format (in-person/online/hybrid), group size (solo/team), skill level, and age range. Your one follow-up question per turn must target the ONE dimension where those retrieved candidates actually differ (e.g. some are team-based and some solo; some competitive and some casual; different sub-tags within the same category) — never a generic question that doesn't map to a real field on those candidates. If the candidates already agree on every dimension, ask about whichever real dimension would most separate the top candidate from the rest of the full catalog.

Every message includes a PACING instruction telling you the current computed match confidence and whether to continue or wrap up this turn — that instruction has final say, not your own judgment. DONE must exactly match what it says.

## Rules
- Ask ONE question at a time
- Build on their previous answers — don't ignore what they said
- If an answer is vague, gently probe once ("Tell me more about that!")
- Never list bullet points or use markdown headers in your replies

## Response format
Respond in EXACTLY this format, no extra text before or after:
REPLY: <your 1-3 sentence reply. Include exactly one follow-up question UNLESS the PACING instruction says this is the final wrap-up turn, in which case give a warm closing line and NO question>
INTERESTS: <comma-separated cumulative interest tags inferred from the WHOLE conversation so far, most specific/confident first, 2-5 words each, lowercase, e.g. "environmental sustainability, graphic design, coding". Empty after the colon if nothing clear yet>
SUGGESTIONS: <3-4 short example answers (2-5 words each) to the question you just asked, comma-separated, grounded in the retrieved candidates' distinguishing fields so tapping one is a real, meaningful answer. Empty if this is the final wrap-up turn>
DONE: <true if this REPLY was a wrap-up with no question, otherwise false — must match the PACING instruction>

If DONE is true, ALSO include these additional lines after DONE:
SUMMARY: <a 2-3 sentence personal summary written warmly in second person, e.g. "You're someone who...">
FILTERS: <a single-line JSON object with any of: category (must be exactly one of ${CATEGORIES.join(", ")}), subTags (array, reuse sub-tags seen in RETRIEVED OPPORTUNITIES where possible), format ("in-person"|"online"|"hybrid"), groupSize ("solo"|"team"|"either"), skillLevel ("beginner"|"intermediate"|"advanced"|"any"), ageMin, ageMax. Omit any field you don't have real signal for>
QUERIES: <3 short comma-separated search strings CORDY's backend could use to find matching programmes, e.g. "youth environmental volunteering, digital arts workshop, peer mentoring">

Do not mention this format to the user — REPLY is the only thing they see.`;

// ── Opener (very first message) ─────────────────────────────────────────
// A grounded, LLM-generated opening question (not a canned line) — its
// suggestion chips are real, distinguishing answers pulled from the current
// retrieval, same as every other turn.

export const OPENER_SYSTEM_PROMPT = `You are CORDY, a cheerful youth-nonprofit peer guide, about to send the VERY FIRST message of a chat meant to narrow someone down to one real opportunity in Cordy's catalog.

You're given a RETRIEVED OPPORTUNITIES block — real, currently-relevant entries from Cordy's catalog. Your opening question must be grounded in the distinguishing fields across those retrieved entries (not generic trivia) — bake 2-3 concrete, real angles from those fields right into the question so the person has something specific to grab onto (e.g. if retrieved entries split between competitive esports leagues and casual game-dev workshops, ask whether they're more into playing competitively, or building/making games). Keep it warm, casual, upbeat, light emoji okay.

Respond in EXACTLY this format, no extra text:
MESSAGE: <1-2 sentence greeting + your one grounded opening question>
SUGGESTIONS: <3-4 short example answers (2-5 words each), comma-separated, each a real answer aligned to a distinguishing field from the retrieved entries>`;

export const OPENING_MESSAGE =
  "Hey there! I'm CORDY 👋 Super glad you're here. I'm going to ask you a few questions so we can find the best opportunities for you — there's no right or wrong answers, just be yourself! To start off: what do you usually love doing when you're not in school?";

const FALLBACK_SUGGESTIONS = [
  "Something competitive",
  "Something creative",
  "Something hands-on",
  "Not sure yet",
];

export function parseOpener(raw: string): { message: string; suggestions: string[] } {
  const text = (raw || "").trim();
  const msgMatch = /MESSAGE:\s*([\s\S]*?)(?:\nSUGGESTIONS:|$)/i.exec(text);
  const sugMatch = /SUGGESTIONS:\s*(.*)/i.exec(text);
  const message = msgMatch ? msgMatch[1]!.trim() : text.replace(/SUGGESTIONS:[\s\S]*/i, "").trim();
  const sugRaw = sugMatch ? sugMatch[1]!.trim() : "";
  const suggestions = sugRaw ? sugRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return {
    message: message || OPENING_MESSAGE,
    suggestions: suggestions.length ? suggestions : FALLBACK_SUGGESTIONS,
  };
}

// ── Per-turn reply parsing ──────────────────────────────────────────────

export interface ParsedReply {
  reply: string;
  interests: string[];
  suggestions: string[];
  done: boolean;
  summary?: string;
  filters?: OpportunityFilters;
  queries?: string[];
}

function parseFilters(raw: string | undefined): OpportunityFilters | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as OpportunityFilters;
    // Guard against the model inventing a category outside the real taxonomy
    if (parsed.category && !CATEGORIES.includes(parsed.category as (typeof CATEGORIES)[number])) {
      parsed.category = undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function parseReply(raw: string): ParsedReply {
  const text = (raw || "").trim();

  // All labelled fields are anchored to the start of a line (^ + "m" flag)
  // so a stray "DONE:"-looking substring inside the REPLY's own prose can't
  // be mistaken for the real structured field.
  const replyMatch = /^REPLY:\s*([\s\S]*?)(?:\n(?:INTERESTS|SUGGESTIONS|DONE):|$)/im.exec(text);
  const interestsMatch = /^INTERESTS:\s*(.*)/im.exec(text);
  const suggestionsMatch = /^SUGGESTIONS:\s*(.*)/im.exec(text);
  const doneMatch = /^DONE:\s*(true|false)/im.exec(text);
  const summaryMatch = /^SUMMARY:\s*([\s\S]*?)(?:\n(?:FILTERS|QUERIES):|$)/im.exec(text);
  const filtersMatch = /^FILTERS:\s*(\{[\s\S]*?\})\s*(?:\n|$)/im.exec(text);
  const queriesMatch = /^QUERIES:\s*(.*)/im.exec(text);

  const reply = replyMatch
    ? replyMatch[1]!.trim()
    : text.replace(/(INTERESTS|SUGGESTIONS|DONE|SUMMARY|FILTERS|QUERIES):[\s\S]*/i, "").trim();

  const interestsRaw = interestsMatch ? interestsMatch[1]!.trim() : "";
  const interests = interestsRaw ? interestsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const suggestionsRaw = suggestionsMatch ? suggestionsMatch[1]!.trim() : "";
  const suggestions = suggestionsRaw ? suggestionsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const done = doneMatch ? doneMatch[1]!.toLowerCase() === "true" : false;

  const summary = summaryMatch ? summaryMatch[1]!.trim() : undefined;
  const filters = parseFilters(filtersMatch?.[1]);
  const queriesRaw = queriesMatch ? queriesMatch[1]!.trim() : "";
  const queries = queriesRaw ? queriesRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  return {
    reply: reply || "Tell me more!",
    interests,
    suggestions,
    done,
    summary,
    filters,
    queries,
  };
}

export function buildProfileFromReply(parsed: ParsedReply): ProfileData {
  return {
    tags: parsed.interests,
    summary: parsed.summary ?? "Here's what CORDY picked up on so far.",
    opportunities: [],
    filters: parsed.filters,
    _opportunityQueries: parsed.queries ?? [],
  };
}

// ── Mid-conversation retrieval grounding ────────────────────────────────
// Before the model's own structured FILTERS are available (only emitted on
// the final DONE turn), infer a rough OpportunityFilters from the raw
// transcript text so every turn's RETRIEVED OPPORTUNITIES block is grounded
// in the real catalog's category/sub-tag vocabulary rather than nothing.

export function inferFiltersFromTranscript(text: string): OpportunityFilters {
  const lower = text.toLowerCase();
  const filters: OpportunityFilters = {};

  const category = CATEGORIES.find((c) => lower.includes(c.toLowerCase()));
  if (category) filters.category = category;

  const subTagPool = new Set(CATALOG.flatMap((o) => o.subTags ?? []));
  const subTags = [...subTagPool].filter((t) => lower.includes(t.replace(/-/g, " ")));
  if (subTags.length) filters.subTags = subTags;

  if (/\bonline\b/.test(lower)) filters.format = "online";
  else if (/\bin.person\b/.test(lower)) filters.format = "in-person";
  else if (/\bhybrid\b/.test(lower)) filters.format = "hybrid";

  if (/\b(team|group|together|with friends)\b/.test(lower)) filters.groupSize = "team";
  else if (/\b(solo|alone|by myself|individually)\b/.test(lower)) filters.groupSize = "solo";

  if (/\b(competitive|competition|tournament)\b/.test(lower)) filters.skillLevel = "advanced";
  else if (/\b(beginner|new to this|never (tried|done))\b/.test(lower))
    filters.skillLevel = "beginner";
  else if (/\bcasual\b/.test(lower)) filters.skillLevel = "any";

  return filters;
}
