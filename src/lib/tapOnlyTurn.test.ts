import { describe, expect, it } from "vitest";
import { CATALOG, bestDiscriminator, shouldStopAsking } from "./opportunities";
import { buildTapOnlyTurn, labelForValue, valueForLabel } from "./tapOnlyTurn";

describe("bestDiscriminator", () => {
  it("returns null when the candidates agree on everything askable", () => {
    const identical = CATALOG.filter((o) => o.id === "opp-hackathon");
    expect(bestDiscriminator(identical, {})).toBeNull();
  });

  it("skips dimensions we've already inferred", () => {
    const candidates = CATALOG.filter((o) => o.category === "Tech & Coding");
    const withoutKnown = bestDiscriminator(candidates, {});
    const withKnown = bestDiscriminator(candidates, {
      [withoutKnown!.dimension]: candidates[0]![withoutKnown!.dimension],
    });
    expect(withKnown?.dimension).not.toBe(withoutKnown!.dimension);
  });

  it("only proposes a dimension the candidates actually differ on", () => {
    const candidates = CATALOG.slice(0, 6);
    const split = bestDiscriminator(candidates, {});
    if (split) {
      expect(split.values.length).toBeGreaterThanOrEqual(2);
      // Every proposed value must exist on at least one real candidate.
      for (const value of split.values) {
        expect(candidates.some((c) => c[split.dimension] === value)).toBe(true);
      }
    }
  });

  it("ignores catch-all values that cannot discriminate", () => {
    const split = bestDiscriminator(CATALOG, {});
    expect(split?.values).not.toContain("any");
    expect(split?.values).not.toContain("either");
  });
});

describe("shouldStopAsking", () => {
  it("stops once the pool is down to a couple of entries", () => {
    expect(shouldStopAsking(CATALOG.slice(0, 2), {}, 2)).toBe(true);
  });

  it("keeps going while a real discriminator remains", () => {
    expect(shouldStopAsking(CATALOG, {}, CATALOG.length)).toBe(false);
  });

  it("stops when every askable dimension is already known", () => {
    const allKnown = {
      category: "Tech & Coding",
      format: "in-person" as const,
      groupSize: "team" as const,
      skillLevel: "beginner" as const,
    };
    expect(shouldStopAsking(CATALOG, allKnown, CATALOG.length)).toBe(true);
  });
});

describe("buildTapOnlyTurn", () => {
  it("renders a question plus one button per real value", () => {
    const turn = buildTapOnlyTurn({ dimension: "format", values: ["in-person", "online"] }, "sig");
    expect(turn).not.toBeNull();
    expect(turn!.message.length).toBeGreaterThan(0);
    expect(turn!.suggestions).toEqual(["In person", "Online"]);
  });

  it("declines when there are too many options to tap comfortably", () => {
    expect(buildTapOnlyTurn({ dimension: "category", values: ["a", "b", "c", "d", "e"] }, "s")).toBeNull();
  });

  it("declines when there is nothing to choose between", () => {
    expect(buildTapOnlyTurn({ dimension: "format", values: ["online"] }, "s")).toBeNull();
  });

  it("is deterministic for the same dimension and pool", () => {
    const split = { dimension: "groupSize" as const, values: ["solo", "team"] };
    expect(buildTapOnlyTurn(split, "pool-a")!.message).toBe(
      buildTapOnlyTurn(split, "pool-a")!.message,
    );
  });

  it("round-trips labels back to the catalog values they came from", () => {
    for (const value of ["in-person", "online", "hybrid", "solo", "team", "beginner"]) {
      expect(valueForLabel(labelForValue(value))).toBe(value);
    }
  });
});
