// ── Post-attendance feedback loop (placeholder) ─────────────────────────
// PLACEHOLDER — there's no real backend here to receive attendance
// feedback, so this persists to localStorage and logs to the console, the
// same simulation pattern as backendProfileSim.ts. In production this is
// where a rating + note would feed back into the real matching model
// (e.g. down-weighting a category for a user who rated it poorly, or
// surfacing aggregate ratings as real social proof instead of the
// estimatedRecentJoins() placeholder in opportunities.ts).

export interface AttendanceFeedback {
  profileId: string;
  opportunityId: string;
  opportunityTitle: string;
  rating: number; // 1-5
  note: string;
  submittedAt: string;
}

const FEEDBACK_STORAGE_KEY = "cordy_feedback_log";

export function submitAttendanceFeedback(
  entry: Omit<AttendanceFeedback, "submittedAt">,
): void {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    const log = raw ? (JSON.parse(raw) as AttendanceFeedback[]) : [];
    const record: AttendanceFeedback = { ...entry, submittedAt: new Date().toISOString() };
    log.push(record);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(log));
    console.log("[CORDY feedback simulation] attendance feedback recorded:", record);
  } catch {
    // storage unavailable — non-fatal
  }
}

export function hasSubmittedFeedback(profileId: string, opportunityId: string): boolean {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return false;
    const log = JSON.parse(raw) as AttendanceFeedback[];
    return log.some((f) => f.profileId === profileId && f.opportunityId === opportunityId);
  } catch {
    return false;
  }
}
