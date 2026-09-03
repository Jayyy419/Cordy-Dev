import { beforeEach, describe, expect, it, vi } from "vitest";
import { readTranscriptForSubmission } from "./studyContext";

// vitest runs in the node environment, so stand up a minimal localStorage.
function installStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

const MESSAGES = [
  { role: "assistant", content: "What are you into?" },
  { role: "user", content: "singing" },
];

describe("readTranscriptForSubmission", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the conversation out of the resume blob", () => {
    installStorage({
      cordy_chat_resume: JSON.stringify({ savedAt: Date.now(), messages: MESSAGES }),
    });
    const text = readTranscriptForSubmission();
    expect(text).toContain("CORDY: What are you into?");
    expect(text).toContain("THEM: singing");
  });

  it("falls back to the legacy standalone key", () => {
    // Someone mid-session across the storage change must not silently submit
    // an empty transcript — it's the richest signal the survey collects.
    installStorage({ cordy_chat_transcript: JSON.stringify(MESSAGES) });
    expect(readTranscriptForSubmission()).toContain("THEM: singing");
  });

  it("prefers the resume blob when both exist", () => {
    installStorage({
      cordy_chat_resume: JSON.stringify({
        savedAt: Date.now(),
        messages: [{ role: "user", content: "newer" }],
      }),
      cordy_chat_transcript: JSON.stringify([{ role: "user", content: "older" }]),
    });
    const text = readTranscriptForSubmission();
    expect(text).toContain("newer");
    expect(text).not.toContain("older");
  });

  it("returns empty string when there is nothing stored", () => {
    installStorage();
    expect(readTranscriptForSubmission()).toBe("");
  });

  it("survives malformed stored data", () => {
    installStorage({ cordy_chat_resume: "not json", cordy_chat_transcript: "{{{" });
    expect(readTranscriptForSubmission()).toBe("");
  });
});
