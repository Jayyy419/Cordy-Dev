import { describe, expect, it } from "vitest";
import { buildProfileFromReply, inferFiltersFromTranscript, parseOpener, parseReply } from "./prompts";

describe("parseReply", () => {
  it("parses a mid-conversation turn", () => {
    const raw = `REPLY: Oh nice, tell me more!
INTERESTS: esports, competitive gaming
SUGGESTIONS: Solo, Team, Not sure
DONE: false`;
    const parsed = parseReply(raw);
    expect(parsed.reply).toBe("Oh nice, tell me more!");
    expect(parsed.interests).toEqual(["esports", "competitive gaming"]);
    expect(parsed.suggestions).toEqual(["Solo", "Team", "Not sure"]);
    expect(parsed.done).toBe(false);
    expect(parsed.summary).toBeUndefined();
    expect(parsed.filters).toBeUndefined();
  });

  it("parses a wrap-up turn with SUMMARY/FILTERS/QUERIES", () => {
    const raw = `REPLY: Great, all set!
INTERESTS: esports, coding
SUGGESTIONS:
DONE: true
SUMMARY: You're someone who loves competitive team play.
FILTERS: {"category": "Tech & Coding", "groupSize": "team"}
QUERIES: youth esports league, hackathon`;
    const parsed = parseReply(raw);
    expect(parsed.done).toBe(true);
    expect(parsed.summary).toBe("You're someone who loves competitive team play.");
    expect(parsed.filters).toEqual({ category: "Tech & Coding", groupSize: "team" });
    expect(parsed.queries).toEqual(["youth esports league", "hackathon"]);
  });

  it("strips an invented category outside the real taxonomy", () => {
    const raw = `REPLY: Done!
INTERESTS: tag
SUGGESTIONS:
DONE: true
SUMMARY: summary
FILTERS: {"category": "Made Up Category", "groupSize": "solo"}
QUERIES: q`;
    const parsed = parseReply(raw);
    expect(parsed.filters?.category).toBeUndefined();
    expect(parsed.filters?.groupSize).toBe("solo");
  });

  it("falls back gracefully on malformed input", () => {
    const parsed = parseReply("this is not in the expected format at all");
    expect(parsed.reply).toBeTruthy();
    expect(parsed.interests).toEqual([]);
    expect(parsed.done).toBe(false);
  });

  it("falls back gracefully on invalid FILTERS JSON", () => {
    const raw = `REPLY: Done!
INTERESTS: tag
SUGGESTIONS:
DONE: true
SUMMARY: summary
FILTERS: {not valid json}
QUERIES: q`;
    const parsed = parseReply(raw);
    expect(parsed.filters).toBeUndefined();
  });
});

describe("parseOpener", () => {
  it("parses a well-formed opener", () => {
    const raw = `MESSAGE: Hey! Into competitive or casual play?
SUGGESTIONS: Competitive, Casual, Not sure`;
    const parsed = parseOpener(raw);
    expect(parsed.message).toBe("Hey! Into competitive or casual play?");
    expect(parsed.suggestions).toEqual(["Competitive", "Casual", "Not sure"]);
  });

  it("falls back to defaults on empty input", () => {
    const parsed = parseOpener("");
    expect(parsed.message).toBeTruthy();
    expect(parsed.suggestions.length).toBeGreaterThan(0);
  });
});

describe("buildProfileFromReply", () => {
  it("carries tags/summary/filters through into a ProfileData shape", () => {
    const profile = buildProfileFromReply({
      reply: "done",
      interests: ["coding"],
      suggestions: [],
      done: true,
      summary: "You're a builder.",
      filters: { category: "Tech & Coding" },
      queries: ["hackathon"],
    });
    expect(profile.tags).toEqual(["coding"]);
    expect(profile.summary).toBe("You're a builder.");
    expect(profile.filters).toEqual({ category: "Tech & Coding" });
    expect(profile._opportunityQueries).toEqual(["hackathon"]);
    expect(profile.opportunities).toEqual([]);
  });
});

describe("inferFiltersFromTranscript", () => {
  it("detects category, format, group size, and skill level from free text", () => {
    const filters = inferFiltersFromTranscript(
      "I really want something in Tech & Coding, ideally online, with a team, and I'm competitive.",
    );
    expect(filters.category).toBe("Tech & Coding");
    expect(filters.format).toBe("online");
    expect(filters.groupSize).toBe("team");
    expect(filters.skillLevel).toBe("advanced");
  });

  it("returns an empty object for text with no signal", () => {
    expect(inferFiltersFromTranscript("hi there")).toEqual({});
  });
});
