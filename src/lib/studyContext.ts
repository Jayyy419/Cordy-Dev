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
const TRANSCRIPT_KEY = "cordy_chat_transcript";

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
    const raw = localStorage.getItem(TRANSCRIPT_KEY);
    if (!raw) return "";
    const stored = JSON.parse(raw) as { role: string; content: string }[];
    if (!Array.isArray(stored)) return "";
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
