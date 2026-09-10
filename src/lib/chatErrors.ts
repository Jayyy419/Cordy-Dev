// ── Chat failure classification ──────────────────────────────────────────
// When a chat turn fails, the user needs to know whether to retry now, wait,
// or check their connection — and CORDY must never parrot a raw browser
// string. `fetch` rejects with things like "Failed to fetch" (Chrome),
// "NetworkError when attempting to fetch resource." (Firefox) or "Load
// failed" (Safari); those used to be rendered verbatim as CORDY's dialogue,
// because the only thing filtered out was our own "Request failed (…)".
//
// So: classify at the throw site, and only ever show a message we wrote or
// that our own API returned.

export type ChatErrorKind =
  /** Our API answered with a friendly, situation-specific message (429/502/400). */
  | "server"
  /** The request never completed — offline, DNS, connection dropped. */
  | "network"
  /** We gave up waiting. */
  | "timeout";

export class ChatError extends Error {
  readonly kind: ChatErrorKind;
  /** A message our own API returned, safe to show. Never a browser string. */
  readonly serverMessage: string | null;

  constructor(kind: ChatErrorKind, serverMessage: string | null = null) {
    super(serverMessage ?? kind);
    this.name = "ChatError";
    this.kind = kind;
    this.serverMessage = serverMessage;
  }
}

/**
 * Turns anything thrown by a chat fetch into a line CORDY can actually say.
 * Falls back to our own wording whenever the failure isn't one our API
 * described, so no browser/runtime text can reach the transcript.
 */
export function chatErrorMessage(err: unknown): string {
  if (err instanceof ChatError) {
    if (err.kind === "server" && err.serverMessage) return err.serverMessage;
    if (err.kind === "timeout") return "Aiya, that took too long! Give it another go?";
    if (err.kind === "network") {
      return "I can't reach the internet right now — check your connection and try again?";
    }
  }
  return "Aiya, something went wrong on my end! Can you try sending that again?";
}

/**
 * Drops locally-generated error notices from a thread.
 *
 * Error bubbles are appended to `messages` so the user can see what happened,
 * which meant a retry resent them to the API as genuine assistant turns —
 * CORDY would be reasoning about its own "something went wrong" line — and
 * they were persisted into the transcript the survey reads. Neither is real
 * conversation, so strip them at every boundary that leaves the component.
 */
export function withoutErrorMessages<T extends { isError?: boolean }>(messages: T[]): T[] {
  return messages.filter((m) => !m.isError);
}
