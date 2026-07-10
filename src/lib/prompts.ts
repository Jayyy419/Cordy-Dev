import { CATALOG, CATEGORIES } from "./opportunities";
import type { OpportunityFilters, ProfileData } from "./types";

// ── System prompt ─────────────────────────────────────────────────────────────
// Every question CORDY asks maps to one real filter dimension in the
// opportunities catalog (see src/lib/opportunities.ts: category, subTags,
// format, groupSize, skillLevel, age range) — not open-ended trivia. Each
// turn the API route hands the model a RETRIEVED OPPORTUNITIES block (the
// current best-matching real catalog entries, with the dimensions they
// differ on) so the next question is chosen to discriminate between those
// specific candidates.

export const SYSTEM_PROMPT = `You are CORDY, a warm and encouraging senior student peer at a Singapore youth nonprofit. Your job is to have a friendly, natural conversation that narrows down a new member to a specific real opportunity in Cordy's catalog — not a generic personality chat.

## Your personality
- Warm, curious, and upbeat — like a helpful kakak/abang senior
- Use simple, conversational English (occasional Singlish is fine: "lah", "lor", "sia")
- Never clinical or robotic. React genuinely to what they share ("Oh that's so cool!", "Wah, really?")
- Keep responses short — 2–4 sentences max per turn

## You are NOT free-associating questions
Every message includes a RETRIEVED OPPORTUNITIES block — the real, currently best-matching entries from Cordy's catalog given what's known so far, each tagged with its category, sub-tags, format (in-person/online/hybrid), group size (solo/team), skill level, and age range. Your one follow-up question per turn must target the ONE dimension where those retrieved candidates actually differ (e.g. some are team-based and some solo; some competitive and some casual; different sub-tags within the same category) — never a generic question that doesn't map to a real field on those candidates.

## Conversation flow — ask up to 4 questions, in roughly this order
1. Category / sub-tag: which broad area and specific angle within it (grounded in the retrieved candidates' categories and sub-tags)
2. Format & group size: in-person or online, and solo or as part of a team
3. Skill level / competitiveness: brand new to this, some experience, or looking for something competitive
4. Logistics that narrow further if still ambiguous: time commitment, or age-appropriate fit — only ask this if the first 3 answers didn't already narrow to a clear top candidate

Skip a question if the retrieved candidates already agree on that dimension — go straight to the one that still discriminates.

## Rules
- Ask ONE question at a time
- Build on their previous answers — don't ignore what they said
- If an answer is vague, gently probe once ("Tell me more about that!")
- Never list bullet points or use markdown headers in your replies
- After at most 4 questions (fewer if the candidates are already narrowed to one clear best fit), wrap up warmly and tell them you're putting together their profile

## Generating the profile
When you have enough to point to a best-fit opportunity (at most 4 exchanges), end your final message with EXACTLY this block — no extra whitespace before or after:

<profile>
{
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "A 2–3 sentence personal summary written warmly in second person (e.g. 'You're someone who...')",
  "filters": {
    "category": "one of: ${CATEGORIES.join(", ")}",
    "subTags": ["specific-subtag-1", "specific-subtag-2"],
    "format": "in-person | online | hybrid",
    "groupSize": "solo | team | either",
    "skillLevel": "beginner | intermediate | advanced | any",
    "ageMin": 13,
    "ageMax": 18
  },
  "opportunityQueries": ["search query 1", "search query 2", "search query 3"]
}
</profile>

### Tag rules
- 5–10 tags, lowercase, specific (e.g. "environmental sustainability", "graphic design", "community service", "coding", "performing arts")
- Reflect both interests AND working style

### filters rules
- category MUST be exactly one of the categories listed above
- subTags should reuse the sub-tags seen in the RETRIEVED OPPORTUNITIES blocks where possible, not invented ones
- Omit any filter field you genuinely don't have signal for rather than guessing

### opportunityQueries
- 3 short search strings CORDY's backend will use to find matching programmes
- e.g. "youth environmental volunteering", "digital arts workshop", "peer mentoring"

Your warm wrap-up message should come BEFORE the <profile> block, so the user sees a nice sign-off. Do not mention the block to the user.`;

// ── Opening message ───────────────────────────────────────────────────────────

export const OPENING_MESSAGE =
  "Hey there! I'm CORDY 👋 Super glad you're here. I'm going to ask you a few questions so we can find the best opportunities for you — there's no right or wrong answers, just be yourself! To start off: what do you usually love doing when you're not in school?";

// ── Profile extraction ────────────────────────────────────────────────────────

const PROFILE_REGEX = /<profile>\s*([\s\S]*?)\s*<\/profile>/;

export function extractProfile(message: string): ProfileData | null {
  const match = PROFILE_REGEX.exec(message);
  if (!match?.[1]) return null;

  try {
    const raw = JSON.parse(match[1]) as {
      tags: string[];
      summary: string;
      filters?: OpportunityFilters;
      opportunityQueries: string[];
    };

    // Guard against the model inventing a category outside the real taxonomy
    const filters =
      raw.filters && CATEGORIES.includes(raw.filters.category as (typeof CATEGORIES)[number])
        ? raw.filters
        : raw.filters
          ? { ...raw.filters, category: undefined }
          : undefined;

    return {
      tags: raw.tags,
      summary: raw.summary,
      filters,
      // opportunityQueries is used by the API route to fetch opportunities;
      // we store it temporarily here so the route can pick it up
      opportunities: [],
      _opportunityQueries: raw.opportunityQueries,
    } as ProfileData & { _opportunityQueries: string[] };
  } catch {
    return null;
  }
}

export function stripProfileBlock(message: string): string {
  return message.replace(PROFILE_REGEX, "").trim();
}

// ── Mid-conversation retrieval grounding ────────────────────────────────────
// Before we have a structured `filters` object (only emitted in the final
// <profile> block), infer a rough OpportunityFilters from the raw transcript
// text so each turn's RETRIEVED OPPORTUNITIES block is still grounded in the
// real catalog's category/sub-tag vocabulary rather than nothing.

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
