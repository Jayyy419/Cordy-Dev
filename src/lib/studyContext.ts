// ── Study context ────────────────────────────────────────────────────────
// Bridges what happens on the results screen into the survey submission.
//
// The survey's headline question ("was chatting with CORDY better than
// browsing yourself?") is only worth anything if we know whether the person
// actually compared, or just guessed from memory. Same for match quality:
// knowing which tags they rejected tells us where the inference was wrong.
// Both are captured on /profile and read back here at submit time, so the
// survey itself stays short and doesn't ask people to self-report things we
// already observed.

const COMPARISON_KEY = "cordy_comparison_outcome";
const RESUME_KEY = "cordy_chat_resume";
/** Legacy standalone transcript key, still read as a fallback. */
const TRANSCRIPT_KEY = "cordy_chat_transcript";

interface StoredMessage {
  role: string;
  content: string;
}

/** Messages from the current resume blob, or the legacy key if that's all there is. */
function readStoredMessages(): StoredMessage[] {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (raw) {
      const blob = JSON.parse(raw) as { messages?: StoredMessage[] };
      if (Array.isArray(blob.messages) && blob.messages.length) return blob.messages;
    }
  } catch {
    // fall through to the legacy key
  }
  try {
    const legacy = localStorage.getItem(TRANSCRIPT_KEY);
    if (!legacy) return [];
    const parsed = JSON.parse(legacy) as StoredMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** How many characters of transcript we're willing to ship to Airtable. */
const MAX_TRANSCRIPT_CHARS = 6000;

export type TriedRealCordy = "yes" | "no" | "not_shown";
export type PreferredList = "cordy" | "browse" | "same" | "not_answered";

export interface ComparisonOutcome {
  triedRealCordy: TriedRealCordy;
  preferredList: PreferredList;
  rejectedTags: string[];
}

const EMPTY: ComparisonOutcome = {
  triedRealCordy: "not_shown",
  preferredList: "not_answered",
  rejectedTags: [],
};

export function readComparisonOutcome(): ComparisonOutcome {
  try {
    const raw = localStorage.getItem(COMPARISON_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ComparisonOutcome>;
    return {
      triedRealCordy: parsed.triedRealCordy ?? "not_shown",
      preferredList: parsed.preferredList ?? "not_answered",
      rejectedTags: Array.isArray(parsed.rejectedTags) ? parsed.rejectedTags : [],
    };
  } catch {
    return EMPTY;
  }
}

export function updateComparisonOutcome(patch: Partial<ComparisonOutcome>): void {
  try {
    const next = { ...readComparisonOutcome(), ...patch };
    localStorage.setItem(COMPARISON_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — non-fatal, the survey just records defaults
  }
}

export function clearComparisonOutcome(): void {
  try {
    localStorage.removeItem(COMPARISON_KEY);
  } catch {
    // ignore
  }
}

/**
 * The chat transcript as a single readable string, ready to write to a
 * multilineText column. Returns "" when there's nothing stored (e.g. someone
 * opened /survey directly without doing the chat).
 */
export function readTranscriptForSubmission(): string {
  try {
    // The chat page now stores the conversation inside a single resume blob
    // (with a timestamp, so it can expire). Read that first, falling back to
    // the standalone legacy key for anyone mid-session across the change —
    // silently shipping empty transcripts would gut the richest signal the
    // survey collects.
    const stored = readStoredMessages();
    if (!stored.length) return "";
    const text = stored
      .map((m) => `${m.role === "user" ? "THEM" : "CORDY"}: ${m.content}`)
      .join("\n");
    return text.length > MAX_TRANSCRIPT_CHARS
      ? text.slice(0, MAX_TRANSCRIPT_CHARS) + "\n…[truncated]"
      : text;
  } catch {
    return "";
  }
}
