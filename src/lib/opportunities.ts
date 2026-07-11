import type { Opportunity, OpportunityFilters } from "./types";

// ── Placeholder opportunities catalog ───────────────────────────────────────
// PLACEHOLDER DATA — stands in for Cordy's real opportunities inventory until
// that's wired up (via CORDY_API_URL, see fetchOpportunities in
// src/app/api/chat/route.ts, or a future Airtable/DB integration). The
// *shape* here (category, subTags, format, groupSize, skillLevel, age range)
// is what should be replaced 1:1 with the real fields once the actual
// inventory is available — the MCQ, chat questions, and matcher are all
// keyed off these fields specifically so the swap should just mean pointing
// CATALOG at real data with the same shape.

export const CATEGORIES = [
  "Sports & Outdoor",
  "Arts & Music",
  "Tech & Coding",
  "Community & Volunteering",
  "Academic & STEM",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATALOG: Opportunity[] = [
  {
    id: "opp-football-dev",
    title: "Junior Football Development Squad",
    description: "Weekend training and friendly matches for aspiring footballers.",
    tags: ["sports", "football", "team"],
    category: "Sports & Outdoor",
    subTags: ["football", "soccer", "endurance"],
    format: "in-person",
    groupSize: "team",
    skillLevel: "beginner",
    ageMin: 13,
    ageMax: 18,
  },
  {
    id: "opp-track-meet",
    title: "Track & Field Youth Meet",
    description: "Open-entry regional athletics meet, all skill levels welcome.",
    tags: ["sports", "athletics", "running"],
    category: "Sports & Outdoor",
    subTags: ["athletics", "running", "individual-sport"],
    format: "in-person",
    groupSize: "solo",
    skillLevel: "any",
    ageMin: 12,
    ageMax: 19,
  },
  {
    id: "opp-rec-league",
    title: "Casual Rec Sports League",
    description: "No-pressure weekly pickup games across several sports.",
    tags: ["sports", "social", "casual"],
    category: "Sports & Outdoor",
    subTags: ["multi-sport", "casual", "social"],
    format: "in-person",
    groupSize: "team",
    skillLevel: "beginner",
    ageMin: 13,
    ageMax: 21,
  },
  {
    id: "opp-street-dance",
    title: "Street Dance Crew Auditions",
    description: "Join a youth crew performing choreographed routines at local events.",
    tags: ["arts", "dance", "performance"],
    category: "Arts & Music",
    subTags: ["dance", "performance", "team"],
    format: "in-person",
    groupSize: "team",
    skillLevel: "intermediate",
    ageMin: 14,
    ageMax: 21,
  },
  {
    id: "opp-digital-art",
    title: "Digital Art & Illustration Circle",
    description: "Peer critique sessions plus beginner tablet/drawing tutorials.",
    tags: ["arts", "design", "illustration"],
    category: "Arts & Music",
    subTags: ["illustration", "design", "solo-craft"],
    format: "hybrid",
    groupSize: "solo",
    skillLevel: "beginner",
    ageMin: 12,
    ageMax: 21,
  },
  {
    id: "opp-music-prod",
    title: "Music Production Bootcamp",
    description: "Intro to beatmaking and DAWs across four weekend sessions.",
    tags: ["arts", "music", "production"],
    category: "Arts & Music",
    subTags: ["music-production", "audio", "solo-craft"],
    format: "in-person",
    groupSize: "solo",
    skillLevel: "beginner",
    ageMin: 13,
    ageMax: 21,
  },
  {
    id: "opp-hackathon",
    title: "Young Coders Hackathon",
    description: "48-hour build weekend, teams of up to 4, any skill level.",
    tags: ["tech", "coding", "hackathon"],
    category: "Tech & Coding",
    subTags: ["coding", "hackathon", "competitive"],
    format: "in-person",
    groupSize: "team",
    skillLevel: "intermediate",
    ageMin: 14,
    ageMax: 21,
  },
  {
    id: "opp-gamedev",
    title: "Game Dev Starter Workshop",
    description: "Build a small game in a weekend — no experience needed.",
    tags: ["tech", "coding", "gaming"],
    category: "Tech & Coding",
    subTags: ["game-dev", "coding", "creative-tech"],
    format: "in-person",
    groupSize: "solo",
    skillLevel: "beginner",
    ageMin: 12,
    ageMax: 19,
  },
  {
    id: "opp-esports",
    title: "National Youth Esports League",
    description: "School-affiliated competitive league across popular titles.",
    tags: ["tech", "gaming", "esports"],
    category: "Tech & Coding",
    subTags: ["esports", "gaming", "competitive"],
    format: "online",
    groupSize: "team",
    skillLevel: "advanced",
    ageMin: 13,
    ageMax: 19,
  },
  {
    id: "opp-maker-space",
    title: "Beginner-Friendly Maker Space",
    description: "Drop-in space with 3D printers, tools, and mentors on hand.",
    tags: ["tech", "creative", "diy"],
    category: "Tech & Coding",
    subTags: ["maker", "hardware", "casual"],
    format: "in-person",
    groupSize: "solo",
    skillLevel: "any",
    ageMin: 12,
    ageMax: 21,
  },
  {
    id: "opp-volunteer-circle",
    title: "Youth Volunteer & Social Impact Circle",
    description: "Small community projects with local charities, flexible hours.",
    tags: ["community", "volunteering", "social"],
    category: "Community & Volunteering",
    subTags: ["volunteering", "social-impact", "flexible-hours"],
    format: "in-person",
    groupSize: "team",
    skillLevel: "any",
    ageMin: 13,
    ageMax: 21,
  },
  {
    id: "opp-peer-mentoring",
    title: "Peer Mentoring Programme",
    description: "One-on-one mentoring for younger students, ongoing commitment.",
    tags: ["community", "mentoring", "social"],
    category: "Community & Volunteering",
    subTags: ["mentoring", "one-on-one", "ongoing"],
    format: "in-person",
    groupSize: "solo",
    skillLevel: "any",
    ageMin: 15,
    ageMax: 21,
  },
  {
    id: "opp-robotics",
    title: "Robotics Club Open House",
    description: "Try FIRST-style robotics builds, no prior experience needed.",
    tags: ["tech", "science", "robotics"],
    category: "Academic & STEM",
    subTags: ["robotics", "engineering", "team-build"],
    format: "in-person",
    groupSize: "team",
    skillLevel: "beginner",
    ageMin: 12,
    ageMax: 18,
  },
  {
    id: "opp-science-fair",
    title: "Science Fair Mentorship Track",
    description: "Paired with a mentor to develop a fair-ready research project.",
    tags: ["science", "research", "academic"],
    category: "Academic & STEM",
    subTags: ["research", "independent-study", "solo-craft"],
    format: "hybrid",
    groupSize: "solo",
    skillLevel: "intermediate",
    ageMin: 14,
    ageMax: 19,
  },
  {
    id: "opp-startup-taster",
    title: "Startup & Tech Entrepreneurship Taster",
    description: "Pitch-a-thon style intro to building a tech idea.",
    tags: ["tech", "business", "academic"],
    category: "Academic & STEM",
    subTags: ["entrepreneurship", "pitching", "competitive"],
    format: "in-person",
    groupSize: "team",
    skillLevel: "intermediate",
    ageMin: 15,
    ageMax: 21,
  },
];

// ── Matching ─────────────────────────────────────────────────────────────
// Weighted scoring across the real filter dimensions, not a flat tag string
// overlap: category is the strongest signal, sub-tags next, then the
// discriminating dimensions (format/group size/skill level) and an age-range
// overlap gate. Swap this out along with CATALOG once real data + real
// filtering rules from the backend are available.

function ageRangesOverlap(
  a: { ageMin?: number; ageMax?: number },
  b: { ageMin?: number; ageMax?: number },
): boolean {
  if (a.ageMin == null || a.ageMax == null || b.ageMin == null || b.ageMax == null) {
    return true; // unknown age range on either side — don't penalize
  }
  return a.ageMin <= b.ageMax && b.ageMin <= a.ageMax;
}

export function scoreOpportunity(opp: Opportunity, filters: OpportunityFilters): number {
  let score = 0;

  if (filters.category && opp.category === filters.category) score += 4;

  if (filters.subTags?.length && opp.subTags?.length) {
    const overlap = opp.subTags.filter((t) => filters.subTags?.includes(t)).length;
    score += overlap * 2;
  }

  if (filters.format && opp.format && filters.format === opp.format) score += 1.5;
  if (filters.groupSize && opp.groupSize && filters.groupSize === opp.groupSize) score += 1.5;
  if (filters.skillLevel && opp.skillLevel && filters.skillLevel === opp.skillLevel) score += 1.5;

  if (!ageRangesOverlap(opp, filters)) score -= 5;

  return score;
}

export function matchOpportunities(
  filters: OpportunityFilters,
  limit = 4,
): Opportunity[] {
  return CATALOG.map((opp) => ({ opp, score: scoreOpportunity(opp, filters) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ opp }) => opp);
}

// ── Retrieval grounding ─────────────────────────────────────────────────
// Surfaces the current best-matching real catalog entries — including the
// dimensions they differ on — as context for the model's next question, so
// it asks about a real, currently-discriminating filter rather than generic
// trivia. This is the same shape a real embeddings/vector-search retrieval
// step over the live catalog would produce; only the retrieval mechanism
// (substring/score match vs. real search) would change.

export function retrieveCandidates(filters: OpportunityFilters, limit = 5): Opportunity[] {
  const matched = matchOpportunities(filters, limit);
  if (matched.length) return matched;
  return CATALOG.slice(0, limit);
}

export function buildRetrievalBlockFromCandidates(candidates: Opportunity[]): string {
  const lines = candidates
    .map((o) => {
      const dims = [
        `category: ${o.category ?? "?"}`,
        `sub-tags: ${o.subTags?.join(", ") ?? "?"}`,
        `format: ${o.format ?? "?"}`,
        `group: ${o.groupSize ?? "?"}`,
        `skill level: ${o.skillLevel ?? "?"}`,
        `ages: ${o.ageMin ?? "?"}-${o.ageMax ?? "?"}`,
      ].join(" | ");
      return `- ${o.title} [${dims}]`;
    })
    .join("\n");
  return `RETRIEVED OPPORTUNITIES (current best matches from Cordy's catalog, given what's known so far):\n${lines}`;
}

export function buildRetrievalBlock(filters: OpportunityFilters): string {
  return buildRetrievalBlockFromCandidates(retrieveCandidates(filters, 5));
}

// ── Deterministic confidence ─────────────────────────────────────────────
// Confidence is a real, explainable number derived from the match scores
// themselves — not an LLM self-report — so it can only move the way the
// underlying data actually supports: it's a blend of (a) how well the top
// candidate covers the known filters, and (b) how much it's separated from
// the runner-up. As answers accumulate and narrow the field, both terms
// mechanically tighten; nothing about it can regress just because a reply
// "seemed" less certain to a model.

const MAX_POSSIBLE_SCORE = 4 + 3 * 2 + 1.5 + 1.5 + 1.5; // category + subTags(~3) + format + groupSize + skillLevel

export function confidenceFromFilters(filters: OpportunityFilters): number {
  const scores = CATALOG.map((opp) => scoreOpportunity(opp, filters)).sort((a, b) => b - a);
  const top = scores[0] ?? 0;
  if (top <= 0) return 0;

  const runnerUp = scores[1] ?? 0;
  const coverage = Math.min(1, top / MAX_POSSIBLE_SCORE);
  const separation = top > 0 ? Math.max(0, (top - runnerUp) / top) : 0;

  return Math.round(Math.min(100, Math.max(0, (0.6 * coverage + 0.4 * separation) * 100)));
}

// ── Explainable matches ───────────────────────────────────────────────────
// Human-readable reasons a given opportunity matched the collected filters —
// the same dimensions scoreOpportunity itself weighs — so a user (or a
// parent) can see *why* something was recommended, not just that it was.

export function explainMatch(opp: Opportunity, filters: OpportunityFilters): string[] {
  const reasons: string[] = [];

  if (filters.category && opp.category === filters.category) {
    reasons.push(`Category: ${opp.category}`);
  }
  if (filters.subTags?.length && opp.subTags?.length) {
    const overlap = opp.subTags.filter((t) => filters.subTags?.includes(t));
    if (overlap.length) reasons.push(`Matches on: ${overlap.join(", ")}`);
  }
  if (filters.format && opp.format && filters.format === opp.format) {
    reasons.push(`Format: ${opp.format}`);
  }
  if (filters.groupSize && opp.groupSize && filters.groupSize === opp.groupSize) {
    reasons.push(`Group: ${opp.groupSize}`);
  }
  if (filters.skillLevel && opp.skillLevel && filters.skillLevel === opp.skillLevel) {
    reasons.push(`Skill level: ${opp.skillLevel}`);
  }

  return reasons;
}

// ── Social proof (placeholder) ───────────────────────────────────────────
// PLACEHOLDER — a real deployment would pull actual recent-signup counts
// from Cordy's backend. This derives a stable (not random-per-render),
// plausible-looking number from the opportunity id purely so the UI concept
// is demonstrable; swap for a real aggregate query when one exists.

export function estimatedRecentJoins(oppId: string): number {
  let hash = 0;
  for (let i = 0; i < oppId.length; i++) {
    hash = (hash * 31 + oppId.charCodeAt(i)) >>> 0;
  }
  return 6 + (hash % 35); // stable pseudo-count in [6, 40]
}
