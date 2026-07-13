import { describe, expect, it } from "vitest";
import { getMcqFlow } from "./mcq";

describe("getMcqFlow", () => {
  it("is describe -> categories when the user knows their interests", () => {
    const flow = getMcqFlow({ describe: "know_interests" });
    expect(flow.map((q) => q.id)).toEqual(["describe", "categories"]);
  });

  it("uses the softer categories copy when the user is unsure", () => {
    const flow = getMcqFlow({ describe: "unsure" });
    expect(flow.map((q) => q.id)).toEqual(["describe", "categories"]);
    expect(flow[1]!.question).toMatch(/no worries/i);
  });

  it("defaults to the two-question flow before describe is answered", () => {
    const flow = getMcqFlow({});
    expect(flow).toHaveLength(2);
  });
});
