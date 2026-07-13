"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildPartialProfile } from "~/lib/backendProfileSim";
import {
  getMcqFlow,
  MCQ_CATEGORIES_STORAGE_KEY,
  type McqAnswers,
} from "~/lib/mcq";

export default function McqPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<McqAnswers>({});

  const flow = getMcqFlow(answers);
  const question = flow[index]!;
  const progressPct = Math.round((index / flow.length) * 100);
  const selected = question.multi
    ? ((answers[question.id] as string[] | undefined) ?? [])
    : undefined;

  function finish(finalAnswers: McqAnswers) {
    const categories = (finalAnswers.categories as string[] | undefined) ?? [];
    if (categories.length > 0) {
      localStorage.setItem(MCQ_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    }
    router.push("/chat");
  }

  function skipToResults() {
    const categories = (answers.categories as string[] | undefined) ?? [];
    const profile = buildPartialProfile(
      categories,
      categories.length === 1 ? { category: categories[0] } : undefined,
    );
    localStorage.setItem("cordy_profile", JSON.stringify(profile));
    router.push("/profile");
  }

  function advance(nextAnswers: McqAnswers) {
    const nextFlow = getMcqFlow(nextAnswers);
    if (index + 1 < nextFlow.length) {
      setAnswers(nextAnswers);
      setIndex(index + 1);
    } else {
      finish(nextAnswers);
    }
  }

  function selectSingle(tag: string) {
    advance({ ...answers, [question.id]: tag });
  }

  function toggleMulti(tag: string) {
    const current = (answers[question.id] as string[] | undefined) ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    setAnswers({ ...answers, [question.id]: next });
  }

  function confirmMulti() {
    advance(answers);
  }

  function goBack() {
    if (index > 0) setIndex(index - 1);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cordy-cream px-4 py-8 sm:px-6 sm:py-16">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex items-center justify-between sm:mb-6">
          <div className="flex items-center gap-3">
            {index > 0 && (
              <button
                onClick={goBack}
                aria-label="Back"
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-cordy-ink bg-white text-sm text-cordy-ink"
              >
                ←
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <span className="font-heading text-lg font-extrabold text-cordy-red">
                CORDY
              </span>
            </div>
          </div>
          <button onClick={skipToResults} className="text-sm font-semibold text-cordy-ink/50">
            Skip for now →
          </button>
        </div>

        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Quiz progress"
          className="mb-6 h-2 overflow-hidden rounded-full bg-white sm:mb-7"
        >
          <div
            className="h-full rounded-full bg-cordy-teal transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <h1 className="font-heading mb-4 text-xl font-bold text-cordy-ink sm:mb-5 sm:text-2xl">
          {question.question}
        </h1>

        <div
          role="group"
          aria-label={question.question}
          className="flex flex-col gap-2.5 sm:gap-3"
        >
          {question.options.map((opt) => {
            const isSelected = question.multi
              ? selected?.includes(opt.tag)
              : answers[question.id] === opt.tag;
            return (
              <button
                key={opt.tag}
                onClick={() =>
                  question.multi ? toggleMulti(opt.tag) : selectSingle(opt.tag)
                }
                aria-pressed={isSelected}
                className="rounded-2xl border-2 border-cordy-ink bg-white px-4 py-3.5 text-left text-sm font-semibold text-cordy-ink shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:px-5 sm:py-4"
              >
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-cordy-teal text-xs text-cordy-ink"
                  >
                    ✓
                  </span>
                )}
                {opt.label}
              </button>
            );
          })}
        </div>

        {question.multi && (
          <button
            onClick={confirmMulti}
            disabled={(selected?.length ?? 0) === 0}
            className="mt-6 w-full rounded-2xl border-2 border-cordy-ink bg-cordy-red py-3 font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] disabled:opacity-40"
          >
            Next →
          </button>
        )}
      </div>
    </main>
  );
}
