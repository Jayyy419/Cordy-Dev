import { describe, expect, it } from "vitest";
import { inferInterestsFromText, SYNONYM_RULES } from "./interestSynonyms";
import { CATALOG, CATEGORIES } from "./opportunities";
import { inferFiltersFromTranscript } from "./prompts";

describe("inferInterestsFromText", () => {
  it("reads the case that shipped broken: 'singing' now infers Arts & Music", () => {
    // Real transcript from a tester. Previously category came back undefined
    // because the literal string "Arts & Music" never appears — so CORDY
    // asked the user to pick a category they had already described.
    const r = inferInterestsFromText("i love singing sia");
    expect(r.category).toBe("Arts & Music");
    expect(r.subTags).toContain("performance");
  });

  it.each([
    ["footy with my friends", "Sports & Outdoor"],
    ["i like sketching and doodling", "Arts & Music"],
    ["mostly python and building apps", "Tech & Coding"],
    ["i do CIP at an elderly home", "Community & Volunteering"],
    ["science fair research project", "Academic & STEM"],
    ["futsal every weekend", "Sports & Outdoor"],
    ["i want to start a startup", "Academic & STEM"],
    ["making beats in fl studio", "Arts & Music"],
  ])("maps %j to %s", (text, expected) => {
    expect(inferInterestsFromText(text).category).toBe(expected);
  });

  it("matches whole words only — 'party' must not read as art", () => {
    // A naive substring check has "art" inside party/start/smart, which would
    // file a large share of conversations under Arts & Music.
    for (const text of ["we had a party", "lets start now", "he is smart", "apart from that"]) {
      expect(inferInterestsFromText(text).category, text).toBeUndefined();
    }
  });

  it("lets the dominant interest win rather than a passing mention", () => {
    const r = inferInterestsFromText(
      "i play football every day, futsal on weekends, soccer with my cca. sometimes i draw",
    );
    expect(r.category).toBe("Sports & Outdoor");
  });

  it("returns nothing for text with no interest signal", () => {
    const r = inferInterestsFromText("hi hello ok sure thanks");
    expect(r.category).toBeUndefined();
    expect(r.subTags).toEqual([]);
  });

  it("only emits sub-tags that exist in the catalog", () => {
    const pool = new Set(CATALOG.flatMap((o) => o.subTags ?? []));
    for (const rule of SYNONYM_RULES) {
      for (const t of rule.subTags ?? []) {
        expect(pool.has(t), `sub-tag "${t}" is not in the catalog`).toBe(true);
      }
    }
  });

  it("only emits categories that exist in the taxonomy", () => {
    for (const rule of SYNONYM_RULES) {
      if (rule.category) {
        expect(CATEGORIES).toContain(rule.category);
      }
    }
  });
});

describe("inferFiltersFromTranscript with synonyms wired in", () => {
  it("infers a category from natural speech, end to end", () => {
    const f = inferFiltersFromTranscript("I love singing and I'm in choir");
    expect(f.category).toBe("Arts & Music");
    expect(f.subTags?.length).toBeGreaterThan(0);
  });

  it("still prefers the catalog's own literal spelling when present", () => {
    // "Arts & Music" literal should win over synonym votes for coding.
    const f = inferFiltersFromTranscript("Arts & Music is my thing, though I also code a bit");
    expect(f.category).toBe("Arts & Music");
  });

  it("keeps the existing format/groupSize/skillLevel inference intact", () => {
    const f = inferFiltersFromTranscript("i want something online, solo, im a beginner");
    expect(f.format).toBe("online");
    expect(f.groupSize).toBe("solo");
    expect(f.skillLevel).toBe("beginner");
  });
});
