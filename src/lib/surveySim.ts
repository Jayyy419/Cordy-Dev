import type { SurveyAnswers } from "./survey/types";

// ── Local survey cache (placeholder/offline fallback) ───────────────────
// Written before the network request to /api/survey so a submission is
// never lost purely to a flaky connection — same simulation pattern as
// feedbackSim.ts / backendProfileSim.ts. Generic (keyed by surveyId) so
// multiple survey configs/products can coexist without clobbering each
// other's local cache.

export interface StoredSurveyResponse {
  surveyId: string;
  meta: Record<string, string>;
  answers: SurveyAnswers;
  submittedAt: string;
}

const SURVEY_STORAGE_PREFIX = "cordy_survey_responses_";

export function submitSurveyLocal(
  surveyId: string,
  meta: Record<string, string>,
  answers: SurveyAnswers,
): void {
  try {
    const key = SURVEY_STORAGE_PREFIX + surveyId;
    const raw = localStorage.getItem(key);
    const log = raw ? (JSON.parse(raw) as StoredSurveyResponse[]) : [];
    const record: StoredSurveyResponse = { surveyId, meta, answers, submittedAt: new Date().toISOString() };
    log.push(record);
    localStorage.setItem(key, JSON.stringify(log));
    console.log("[survey] response recorded locally:", record);
  } catch {
    // storage unavailable — non-fatal
  }
}
