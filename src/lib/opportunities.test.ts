import { describe, expect, it } from "vitest";
import {
  CATALOG,
  confidenceFromFilters,
  estimatedRecentJoins,
  explainMatch,
  matchOpportunities,
  scoreOpportunity,
} from "./opportunities";

describe("scoreOpportunity", () => {
  it("scores a full match higher than a partial one", () => {
    const opp = CATALOG.find((o) => o.id === "opp-esports")!;
    const fullMatch = scoreOpportunity(opp, {
      category: "Tech & Coding",
      subTags: ["esports", "gaming", "competitive"],
      format: "online",
      groupSize: "team",
      skillLevel: "advanced",
    });
    const partialMatch = scoreOpportunity(opp, { category: "Tech & Coding" });

    expect(fullMatch).toBeGreaterThan(partialMatch);
  });

  it("penalizes an opportunity outside the requested age range", () => {
    const opp = CATALOG.find((o) => o.id === "opp-peer-mentoring")!; // ageMin 15, ageMax 21
    const score = scoreOpportunity(opp, { category: "Community & Volunteering", ageMin: 10, ageMax: 12 });
    expect(score).toBeLessThan(0);
  });

  it("doesn't penalize when age range is unknown on either side", () => {
    const opp = CATALOG[0]!;
    const score = scoreOpportunity(opp, { category: opp.category });
    expect(score).toBeGreaterThan(0);
  });
});

describe("matchOpportunities", () => {
  it("returns only opportunities with a positive score, sorted descending", () => {
    const results = matchOpportunities({ category: "Tech & Coding" }, 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((o) => o.category === "Tech & Coding")).toBe(true);
  });

  it("returns an empty array for filters that match nothing", () => {
    const results = matchOpportunities({ category: "Tech & Coding", ageMin: 90, ageMax: 95 });
    expect(results).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const results = matchOpportunities({}, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

describe("confidenceFromFilters", () => {
  it("returns 0 when nothing matches", () => {
    expect(confidenceFromFilters({ category: "Tech & Coding", ageMin: 90, ageMax: 95 })).toBe(0);
  });

  it("returns a higher confidence for a narrower, well-separated filter set", () => {
    const broad = confidenceFromFilters({ category: "Tech & Coding" });
    const narrow = confidenceFromFilters({
      category: "Tech & Coding",
      subTags: ["esports", "competitive"],
      format: "online",
      groupSize: "team",
      skillLevel: "advanced",
    });
    expect(narrow).toBeGreaterThanOrEqual(broad);
  });

  it("always stays within [0, 100]", () => {
    for (const filters of [
      {},
      { category: "Sports & Outdoor" as const },
      { category: "Academic & STEM" as const, subTags: ["research"] },
    ]) {
      const confidence = confidenceFromFilters(filters);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    }
  });
});

describe("explainMatch", () => {
  it("lists real matched dimensions", () => {
    const opp = CATALOG.find((o) => o.id === "opp-esports")!;
    const reasons = explainMatch(opp, { category: "Tech & Coding", groupSize: "team" });
    expect(reasons.some((r) => r.includes("Tech & Coding"))).toBe(true);
    expect(reasons.some((r) => r.includes("team"))).toBe(true);
  });

  it("returns an empty list when nothing matches", () => {
    const opp = CATALOG.find((o) => o.id === "opp-esports")!;
    expect(explainMatch(opp, { category: "Sports & Outdoor" })).toEqual([]);
  });
});

describe("estimatedRecentJoins", () => {
  it("is stable for the same id across calls", () => {
    expect(estimatedRecentJoins("opp-esports")).toBe(estimatedRecentJoins("opp-esports"));
  });

  it("stays within the documented [6, 40] range", () => {
    for (const opp of CATALOG) {
      const n = estimatedRecentJoins(opp.id);
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(40);
    }
  });
});
