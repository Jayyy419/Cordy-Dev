// ── Interest vocabulary → catalog fields ─────────────────────────────────
// Young people describe interests in their own words. The catalog is keyed on
// tidy taxonomy labels ("Arts & Music") and hyphenated sub-tags
// ("music-production"), and the original inference only matched those literal
// strings — so "singing", "sketching" or "footy" inferred nothing at all.
//
// That mattered well beyond a missing tag: `category` looked unknown even
// after someone had plainly said they sing, which drove a redundant question,
// and both the confidence score and match quality key off these filters.
//
// This is deliberately a plain lookup table rather than anything clever. It's
// inspectable, testable, cheap, and easy for a non-engineer to extend when a
// tester says something nobody anticipated. Singapore-specific vocabulary
// (futsal, floorball, CCA, CIP, VIA) is included on purpose.

import type { OpportunityFilters } from "./types";

interface SynonymRule {
  /** Terms matched whole-word against the normalized transcript. */
  terms: string[];
  category?: string;
  subTags?: string[];
}

export const SYNONYM_RULES: SynonymRule[] = [
  // ── Arts & Music ───────────────────────────────────────────────────────
  {
    terms: ["sing", "singing", "sings", "vocals", "vocalist", "choir", "karaoke", "acapella"],
    category: "Arts & Music",
    subTags: ["performance"],
  },
  {
    terms: [
      "music", "musician", "band", "guitar", "piano", "drums", "drummer", "violin",
      "ukulele", "instrument", "busking", "songwriting", "songwriter",
    ],
    category: "Arts & Music",
    subTags: ["music-production"],
  },
  {
    terms: [
      "producing", "producer", "beats", "beatmaking", "daw", "mixing", "mastering",
      "recording", "studio", "fl studio", "ableton", "audio",
    ],
    category: "Arts & Music",
    subTags: ["music-production", "audio", "solo-craft"],
  },
  {
    terms: [
      "dance", "dancing", "dancer", "choreo", "choreography", "hip hop", "ballet",
      "street dance", "kpop dance",
    ],
    category: "Arts & Music",
    subTags: ["dance", "performance"],
  },
  {
    terms: [
      "draw", "drawing", "sketch", "sketching", "art", "arts", "artist", "painting",
      "paint", "illustration", "illustrate", "doodle", "doodling", "comics", "manga",
    ],
    category: "Arts & Music",
    subTags: ["illustration", "solo-craft"],
  },
  {
    terms: ["design", "designing", "graphic design", "poster", "photoshop", "figma", "branding"],
    category: "Arts & Music",
    subTags: ["design"],
  },
  {
    terms: [
      "theatre", "theater", "drama", "acting", "act", "perform", "performing",
      "performance", "stage", "musical",
    ],
    category: "Arts & Music",
    subTags: ["performance"],
  },
  {
    terms: ["photography", "photo", "photos", "videography", "filming", "video editing", "editing"],
    category: "Arts & Music",
    subTags: ["design", "creative-tech"],
  },

  // ── Tech & Coding ──────────────────────────────────────────────────────
  {
    terms: [
      "code", "coding", "codes", "program", "programming", "programmer", "developer",
      "dev", "software", "app", "apps", "website", "web dev", "web development",
      "python", "javascript", "java", "html", "css", "c++",
    ],
    category: "Tech & Coding",
    subTags: ["coding"],
  },
  {
    terms: ["hackathon", "hackathons", "hack"],
    category: "Tech & Coding",
    subTags: ["hackathon", "coding", "competitive"],
  },
  {
    terms: [
      "game dev", "gamedev", "game design", "game development", "unity", "godot",
      "roblox", "making games", "build games",
    ],
    category: "Tech & Coding",
    subTags: ["game-dev", "creative-tech"],
  },
  {
    terms: [
      "gaming", "games", "gamer", "esports", "valorant", "dota", "league of legends",
      "mobile legends", "minecraft", "genshin",
    ],
    category: "Tech & Coding",
    subTags: ["gaming", "esports"],
  },
  {
    terms: [
      "3d printing", "maker", "tinker", "tinkering", "electronics", "arduino",
      "raspberry pi", "soldering", "build stuff",
    ],
    category: "Tech & Coding",
    subTags: ["maker", "hardware"],
  },
  {
    terms: ["ai", "machine learning", "ml", "data science", "cybersecurity", "cyber"],
    category: "Tech & Coding",
    subTags: ["coding"],
  },

  // ── Sports & Outdoor ───────────────────────────────────────────────────
  {
    terms: ["football", "soccer", "futsal", "footy"],
    category: "Sports & Outdoor",
    subTags: ["football", "soccer"],
  },
  {
    terms: [
      "basketball", "netball", "volleyball", "badminton", "table tennis", "tennis",
      "floorball", "hockey", "rugby", "frisbee",
    ],
    category: "Sports & Outdoor",
    subTags: ["multi-sport", "team"],
  },
  {
    terms: ["run", "running", "jog", "jogging", "track", "marathon", "sprint", "cross country"],
    category: "Sports & Outdoor",
    subTags: ["running", "athletics", "individual-sport"],
  },
  {
    terms: ["swim", "swimming", "swimmer"],
    category: "Sports & Outdoor",
    subTags: ["athletics", "individual-sport"],
  },
  {
    terms: ["gym", "fitness", "workout", "working out", "lifting", "training", "endurance"],
    category: "Sports & Outdoor",
    subTags: ["endurance"],
  },
  {
    terms: [
      "hike", "hiking", "outdoors", "outdoor", "camping", "climbing", "bouldering",
      "kayaking", "sailing", "cycling", "biking", "skating", "skateboarding",
    ],
    category: "Sports & Outdoor",
    subTags: ["multi-sport", "casual"],
  },
  { terms: ["sports", "sport", "athletic"], category: "Sports & Outdoor" },

  // ── Community & Volunteering ───────────────────────────────────────────
  {
    terms: [
      "volunteer", "volunteering", "community service", "cip", "via", "charity",
      "helping people", "help people", "give back", "social work", "vwo",
    ],
    category: "Community & Volunteering",
    subTags: ["volunteering", "social-impact"],
  },
  {
    terms: ["mentor", "mentoring", "tutor", "tutoring", "teaching", "teach", "coaching"],
    category: "Community & Volunteering",
    subTags: ["mentoring", "one-on-one"],
  },
  {
    terms: [
      "environment", "environmental", "sustainability", "sustainable", "climate",
      "recycling", "green", "conservation",
    ],
    category: "Community & Volunteering",
    subTags: ["social-impact", "volunteering"],
  },
  {
    terms: ["elderly", "seniors", "befriending", "underprivileged", "special needs"],
    category: "Community & Volunteering",
    subTags: ["social-impact", "one-on-one"],
  },

  // ── Academic & STEM ────────────────────────────────────────────────────
  {
    terms: [
      "science", "physics", "chemistry", "chem", "biology", "bio", "astronomy",
      "experiments", "lab",
    ],
    category: "Academic & STEM",
    subTags: ["research"],
  },
  {
    terms: ["math", "maths", "mathematics", "olympiad", "statistics"],
    category: "Academic & STEM",
    subTags: ["research", "independent-study"],
  },
  {
    terms: ["research", "science fair", "project work", "thesis", "investigation"],
    category: "Academic & STEM",
    subTags: ["research", "independent-study", "solo-craft"],
  },
  {
    terms: ["engineering", "engineer", "mechanical", "aerospace"],
    category: "Academic & STEM",
    subTags: ["engineering"],
  },
  {
    terms: ["robot", "robots", "robotics", "first robotics", "vex"],
    category: "Academic & STEM",
    subTags: ["robotics", "engineering", "team-build"],
  },
  {
    terms: [
      "startup", "startups", "entrepreneur", "entrepreneurship", "business",
      "pitch", "pitching", "founder", "marketing",
    ],
    category: "Academic & STEM",
    subTags: ["entrepreneurship", "pitching", "competitive"],
  },
];

/**
 * Collapses punctuation to single spaces and pads the ends, so a term can be
 * matched as ` term ` without regex. Keeps `+` and `#` so "c++" survives.
 *
 * Whole-word matching matters more than it looks: a naive substring check has
 * "art" matching "party", "start" and "smart", which would file half the
 * conversations under Arts & Music.
 */
function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()} `;
}

export interface InferredInterests {
  category?: string;
  subTags: string[];
}

/**
 * Reads the transcript in the user's own vocabulary. Category is decided by
 * vote — the one with the most distinct term hits wins — so a passing mention
 * of "art" doesn't outrank a conversation that's been about football
 * throughout.
 */
export function inferInterestsFromText(text: string): InferredInterests {
  const haystack = normalize(text);

  const categoryVotes = new Map<string, number>();
  const subTags = new Set<string>();

  for (const rule of SYNONYM_RULES) {
    let hits = 0;
    for (const term of rule.terms) {
      if (haystack.includes(` ${term} `)) hits++;
    }
    if (hits === 0) continue;

    if (rule.category) {
      categoryVotes.set(rule.category, (categoryVotes.get(rule.category) ?? 0) + hits);
    }
    for (const t of rule.subTags ?? []) subTags.add(t);
  }

  let category: string | undefined;
  let best = 0;
  for (const [name, votes] of categoryVotes) {
    if (votes > best) {
      best = votes;
      category = name;
    }
  }

  return { category, subTags: [...subTags] };
}
