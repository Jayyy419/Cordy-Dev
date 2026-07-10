import { CATEGORIES } from "./opportunities";

// ── MCQ bucketing flow ──────────────────────────────────────────────────────
// A short multiple-choice warm-up shown before the free-form chat. It lets
// CORDY bucket a user's broad interests fast (tap-only, no typing) using the
// SAME category taxonomy the opportunities catalog is keyed on (see
// src/lib/opportunities.ts CATEGORIES) — not invented buckets — so the pick
// here narrows the same real field the chat stage later refines.

export interface McqOption {
  label: string;
  tag: string;
}

export interface McqQuestion {
  id: string;
  question: string;
  multi: boolean;
  options: McqOption[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  "Sports & Outdoor": "⚽",
  "Arts & Music": "🎨",
  "Tech & Coding": "💻",
  "Community & Volunteering": "🤝",
  "Academic & STEM": "🔬",
};

export type McqAnswers = Record<string, string | string[]>;

export const Q_DESCRIBE: McqQuestion = {
  id: "describe",
  question: "Which describes you better?",
  multi: false,
  options: [
    { label: "I know what I'm interested in", tag: "know_interests" },
    { label: "I'm not sure yet", tag: "unsure" },
  ],
};

// "Unsure" users get gentler copy on the same real-category question rather
// than a separate invented bucket set that would just be asking the same
// thing twice with different words.
export const Q_CATEGORIES: McqQuestion = {
  id: "categories",
  question: "Pick whichever sounds like you — choose as many as you like",
  multi: true,
  options: CATEGORIES.map((c) => ({
    label: `${CATEGORY_EMOJI[c] ?? ""} ${c}`.trim(),
    tag: c,
  })),
};

export const Q_CATEGORIES_UNSURE: McqQuestion = {
  ...Q_CATEGORIES,
  question: "No worries — what sounds like something you'd enjoy trying?",
};

export function getMcqFlow(answers: McqAnswers): McqQuestion[] {
  return [
    Q_DESCRIBE,
    answers.describe === "unsure" ? Q_CATEGORIES_UNSURE : Q_CATEGORIES,
  ];
}

export const MCQ_CATEGORIES_STORAGE_KEY = "cordy_mcq_categories";
