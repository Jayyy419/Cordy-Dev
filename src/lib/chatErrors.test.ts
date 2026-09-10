import { describe, expect, it } from "vitest";
import { ChatError, chatErrorMessage, withoutErrorMessages } from "./chatErrors";

describe("chatErrorMessage", () => {
  it("uses our API's own wording for a server error", () => {
    const msg = chatErrorMessage(
      new ChatError("server", "CORDY needs a quick breather — try again in a minute!"),
    );
    expect(msg).toBe("CORDY needs a quick breather — try again in a minute!");
  });

  it("tells the user to check their connection on a network failure", () => {
    const msg = chatErrorMessage(new ChatError("network"));
    expect(msg).toMatch(/connection/i);
  });

  it("has its own wording for a timeout", () => {
    expect(chatErrorMessage(new ChatError("timeout"))).toMatch(/took too long/i);
  });

  // The bug this guards: `fetch` rejects with TypeError("Failed to fetch")
  // when offline, and that string used to be rendered verbatim as CORDY's
  // dialogue — the filter only excluded our own "Request failed (…)".
  it("never leaks a raw browser error string", () => {
    for (const raw of [
      new TypeError("Failed to fetch"),
      new TypeError("NetworkError when attempting to fetch resource."),
      new TypeError("Load failed"),
      new Error("Request failed (500)"),
      "some string",
      null,
    ]) {
      const msg = chatErrorMessage(raw);
      expect(msg).not.toMatch(/fetch|NetworkError|Load failed|Request failed/i);
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});

describe("withoutErrorMessages", () => {
  const thread = [
    { id: "1", role: "assistant" as const, content: "What are you into?" },
    { id: "2", role: "user" as const, content: "singing" },
    { id: "3", role: "assistant" as const, content: "Aiya, went wrong!", isError: true },
  ];

  // The bug this guards: a retry resent the whole thread, so the failure
  // notice reached the model as a real assistant turn and was saved into the
  // survey transcript.
  it("strips error notices so they never reach the model or the transcript", () => {
    const kept = withoutErrorMessages(thread);
    expect(kept).toHaveLength(2);
    expect(kept.some((m) => m.content.includes("went wrong"))).toBe(false);
  });

  it("leaves a clean thread untouched", () => {
    expect(withoutErrorMessages(thread.slice(0, 2))).toHaveLength(2);
  });
});
