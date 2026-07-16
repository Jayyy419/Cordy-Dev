import { describe, expect, it } from "vitest";
import { hasAnyAnswer, isSurveyComplete, type SurveyQuestion } from "./types";

const QUESTIONS: SurveyQuestion[] = [
  { id: "name", type: "text", label: "Name", required: true },
  { id: "nickname", type: "text", label: "Nickname" },
  {
    id: "rating",
    type: "choice",
    label: "Rating",
    required: true,
    options: [{ value: "1", label: "1" }],
  },
  { id: "tags", type: "multiChoice", label: "Tags", options: [{ value: "a", label: "A" }] },
];

describe("isSurveyComplete", () => {
  it("is false when a required question has no answer", () => {
    expect(isSurveyComplete(QUESTIONS, {})).toBe(false);
  });

  it("is false when a required text answer is empty/whitespace", () => {
    expect(isSurveyComplete(QUESTIONS, { name: "   ", rating: "1" })).toBe(false);
  });

  it("is true once every required question is answered, regardless of optional ones", () => {
    expect(isSurveyComplete(QUESTIONS, { name: "Jay", rating: "1" })).toBe(true);
  });

  it("treats an empty array as unanswered for a required multi-choice", () => {
    const required: SurveyQuestion[] = [
      { id: "tags", type: "multiChoice", label: "Tags", required: true, options: [] },
    ];
    expect(isSurveyComplete(required, { tags: [] })).toBe(false);
    expect(isSurveyComplete(required, { tags: ["x"] })).toBe(true);
  });

  it("treats numeric 0 as a valid answer", () => {
    const required: SurveyQuestion[] = [
      { id: "score", type: "scale", label: "Score", required: true, min: 0, max: 10 },
    ];
    expect(isSurveyComplete(required, { score: 0 })).toBe(true);
  });
});

describe("hasAnyAnswer", () => {
  it("is false when nothing has been answered", () => {
    expect(hasAnyAnswer(QUESTIONS, {})).toBe(false);
  });

  it("is true once any single question has an answer, even an optional one", () => {
    expect(hasAnyAnswer(QUESTIONS, { nickname: "J" })).toBe(true);
  });
});
