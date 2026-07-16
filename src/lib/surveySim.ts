// ── Concept-validation survey (placeholder) ─────────────────────────────
// PLACEHOLDER — same simulation pattern as feedbackSim.ts / backendProfileSim.ts:
// persists to localStorage + logs to console since there's no real analytics
// backend wired up here. Swap for a real destination (a database, Airtable,
// a proper analytics/survey tool) once one exists — the shape of what's
// captured is deliberately close to what a real survey tool would store.

export interface SurveyResponse {
  profileId: string;
  overallRating: number; // 1-5
  questionsRelevant: "yes" | "somewhat" | "not_really";
  matchQuality: "yes" | "maybe" | "no" | "no_matches_shown";
  nps: number; // 0-10, "how likely to recommend"
  obstacles: string[];
  comments: string;
  submittedAt: string;
}

const SURVEY_STORAGE_KEY = "cordy_survey_responses";

export function submitSurvey(entry: Omit<SurveyResponse, "submittedAt">): void {
  try {
    const raw = localStorage.getItem(SURVEY_STORAGE_KEY);
    const log = raw ? (JSON.parse(raw) as SurveyResponse[]) : [];
    const record: SurveyResponse = { ...entry, submittedAt: new Date().toISOString() };
    log.push(record);
    localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(log));
    console.log("[CORDY survey simulation] concept-validation response recorded:", record);
  } catch {
    // storage unavailable — non-fatal
  }
}
