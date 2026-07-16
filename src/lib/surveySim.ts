// ── Concept-validation survey (placeholder) ─────────────────────────────
// PLACEHOLDER — same simulation pattern as feedbackSim.ts / backendProfileSim.ts:
// persists to localStorage + logs to console since there's no real analytics
// backend wired up here. Swap for a real destination (a database, Airtable,
// a proper analytics/survey tool) once one exists — the shape of what's
// captured is deliberately close to what a real survey tool would store.
//
// Question design is deliberately built around three real validation
// questions, not just a satisfaction score:
//  1. Does chatting actually beat the status quo (browsing/searching)?
//     (vsBrowsing) — this is THE concept-validation question.
//  2. Would they actually use it for real, not just "recommend" it?
//     (wouldUseForReal) — distinct from NPS, which measures advocacy, not
//     personal intent to use.
//  3. What SPECIFICALLY did they like/dislike — tap-chips tied to real
//     features (chat itself, visual design, speed, questions, matches,
//     voice input) so responses are actionable, not just "it was fine."

export interface SurveyResponse {
  profileId: string;
  overallRating: number; // 1-5
  vsBrowsing: "worse" | "same" | "better";
  wouldUseForReal: "yes" | "maybe" | "no";
  questionsRelevant: "yes" | "somewhat" | "not_really";
  matchQuality: "yes" | "maybe" | "no" | "no_matches_shown";
  nps: number; // 0-10, "how likely to recommend"
  likedTags: string[];
  dislikedTags: string[];
  likedMost: string;
  wouldChange: string;
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
