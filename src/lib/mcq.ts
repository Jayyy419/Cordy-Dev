// ── MCQ bucketing flow ──────────────────────────────────────────────────────
// A short multiple-choice warm-up shown before the free-form chat. It lets
// CORDY bucket a user's broad interests fast (tap-only, no typing) so the
// chat stage can open with a more grounded first question.

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

export const Q_HELPER: McqQuestion = {
  id: "helper",
  question: "No worries — what sounds like something you'd enjoy trying?",
  multi: true,
  options: [
    { label: "🏃 Something active", tag: "Sports & outdoor stuff" },
    { label: "🎨 Something creative", tag: "Art or music" },
    { label: "💻 Something with computers", tag: "Tech & coding" },
    { label: "👥 Something social", tag: "Hanging out with people" },
  ],
};

export const Q_CATEGORIES: McqQuestion = {
  id: "categories",
  question: "Pick whichever sounds like you — choose as many as you like",
  multi: true,
  options: [
    { label: "⚽ Sports & outdoor stuff", tag: "Sports & outdoor stuff" },
    { label: "🎨 Art or music", tag: "Art or music" },
    { label: "💻 Tech & coding", tag: "Tech & coding" },
    { label: "👥 Hanging out with people", tag: "Hanging out with people" },
    { label: "📚 Reading or learning new things", tag: "Reading or learning new things" },
  ],
};

export function getMcqFlow(answers: McqAnswers): McqQuestion[] {
  const flow = [Q_DESCRIBE];
  if (answers.describe === "unsure") flow.push(Q_HELPER);
  flow.push(Q_CATEGORIES);
  return flow;
}

export const MCQ_CATEGORIES_STORAGE_KEY = "cordy_mcq_categories";
