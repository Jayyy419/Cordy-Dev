// ── Generic survey module ────────────────────────────────────────────────
// Config-driven so the whole survey screen (SurveyForm.tsx) can be reused
// in a future project just by writing a new SurveyModuleConfig and pointing
// the (also generic) /api/survey route at a different Airtable base — no
// code changes needed in either. See src/app/survey/page.tsx for the
// CORDY-specific config this currently renders.

export type SurveyChoiceOption = { value: string; label: string };

interface SurveyQuestionBase {
  id: string; // becomes the answer key, and the Airtable field name it's written to
  label: string;
  required?: boolean;
  /** Visually emphasized — for the question(s) that matter most (e.g. the core validation question) */
  highlight?: boolean;
}

export interface SurveyTextQuestion extends SurveyQuestionBase {
  type: "text";
  placeholder?: string;
  multiline?: boolean;
}

export interface SurveyChoiceQuestion extends SurveyQuestionBase {
  type: "choice";
  options: SurveyChoiceOption[];
}

export interface SurveyMultiChoiceQuestion extends SurveyQuestionBase {
  type: "multiChoice";
  options: SurveyChoiceOption[];
}

export interface SurveyScaleQuestion extends SurveyQuestionBase {
  type: "scale";
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export type SurveyQuestion =
  | SurveyTextQuestion
  | SurveyChoiceQuestion
  | SurveyMultiChoiceQuestion
  | SurveyScaleQuestion;

export type SurveyAnswerValue = string | string[] | number | null;
export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export interface SurveyTheme {
  ink: string;
  cream: string;
  primary: string;
  accent: string;
  highlightBg: string;
}

export const DEFAULT_SURVEY_THEME: SurveyTheme = {
  ink: "#16213e",
  cream: "#fdf6e8",
  primary: "#ef4444",
  accent: "#2dd4a7",
  highlightBg: "#fff3f5",
};

export interface SurveyModuleConfig {
  /** Unique per product/deployment — not currently sent anywhere, but keeps configs self-describing */
  id: string;
  title: string;
  subtitle?: string;
  avatarSrc?: string;
  questions: SurveyQuestion[];
  submitLabel?: string;
  doneTitle?: string;
  doneMessage?: string;
  theme?: Partial<SurveyTheme>;
}

/** True once every `required` question has a non-empty answer. Pure — easy to unit test. */
export function isSurveyComplete(questions: SurveyQuestion[], answers: SurveyAnswers): boolean {
  return questions.every((q) => {
    if (!q.required) return true;
    const value = answers[q.id];
    if (value == null) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return true; // number 0 counts as answered
  });
}

export function hasAnyAnswer(questions: SurveyQuestion[], answers: SurveyAnswers): boolean {
  return questions.some((q) => {
    const value = answers[q.id];
    if (value == null) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}
