"use client";

import Image from "next/image";
import { useState } from "react";
import {
  DEFAULT_SURVEY_THEME,
  hasAnyAnswer,
  isSurveyComplete,
  type SurveyAnswers,
  type SurveyModuleConfig,
} from "~/lib/survey/types";

// ── Generic, config-driven survey screen ─────────────────────────────────
// Reusable across products: pass a SurveyModuleConfig (questions + copy +
// optional theme colors) and an onSubmit handler. Colors are applied via
// inline styles rather than project-specific Tailwind theme tokens
// (bg-cordy-*, etc.) specifically so this file can be copied into a
// different project's src/components/ and just work with that project's
// own SurveyModuleConfig — no dependency on CORDY's Tailwind theme.

interface SurveyFormProps {
  config: SurveyModuleConfig;
  onSubmit: (answers: SurveyAnswers) => Promise<void> | void;
  onDone?: () => void;
  doneAction?: { label: string; onClick: () => void };
}

export function SurveyForm({ config, onSubmit, doneAction }: SurveyFormProps) {
  const theme = { ...DEFAULT_SURVEY_THEME, ...config.theme };
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isSurveyComplete(config.questions, answers);
  const canClear = hasAnyAnswer(config.questions, answers);

  function setAnswer(id: string, value: SurveyAnswers[string]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMulti(id: string, value: string) {
    const existing = answers[id];
    const current = Array.isArray(existing) ? existing : [];
    setAnswer(id, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  function clearAll() {
    setAnswers({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(answers);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong submitting your answers — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: `4px solid ${theme.ink}`,
    boxShadow: "0 30px 60px rgba(22,33,62,0.22)",
    color: theme.ink,
  };

  if (done) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-[32px] p-6 text-center sm:rounded-[44px] sm:p-11" style={cardStyle}>
        {config.avatarSrc && (
          <div
            className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full sm:h-24 sm:w-24"
            style={{ border: `4px solid ${theme.primary}`, background: "#ffd28f" }}
          >
            <Image src={config.avatarSrc} alt="" width={96} height={96} className="h-full w-full object-cover" />
          </div>
        )}
        <h1 className="text-xl font-extrabold sm:text-2xl">{config.doneTitle ?? "Thanks so much! 🙏"}</h1>
        <p className="mt-2 text-sm leading-relaxed opacity-70">
          {config.doneMessage ?? "Your feedback genuinely helps."}
        </p>
        {doneAction && (
          <button
            type="button"
            onClick={doneAction.onClick}
            className="mt-6 w-full rounded-2xl py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-8"
            style={{ border: `2px solid ${theme.ink}`, background: theme.primary, boxShadow: `3px 3px 0 0 ${theme.ink}` }}
          >
            {doneAction.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-2xl rounded-[32px] p-6 sm:rounded-[44px] sm:p-9"
      style={cardStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {config.avatarSrc && (
            <div
              className="h-11 w-11 shrink-0 overflow-hidden rounded-full"
              style={{ border: `2px solid ${theme.primary}`, background: "#ffd28f" }}
            >
              <Image src={config.avatarSrc} alt="" width={44} height={44} className="h-full w-full object-cover" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-extrabold sm:text-xl">{config.title}</h1>
            {config.subtitle && <p className="text-xs opacity-60">{config.subtitle}</p>}
          </div>
        </div>
        {canClear && (
          <button type="button" onClick={clearAll} className="shrink-0 text-xs font-semibold opacity-50 hover:opacity-100">
            Clear choices
          </button>
        )}
      </div>

      {config.questions.map((q, qIndex) => {
        const highlightStyle: React.CSSProperties | undefined = q.highlight
          ? { background: theme.highlightBg, border: `2px solid ${theme.primary}55`, borderRadius: 16, padding: 14 }
          : undefined;

        return (
          <div key={q.id} className="mt-6" style={highlightStyle}>
            <p className="mb-2.5 text-sm font-bold">
              {q.label}
              {!q.required && <span className="ml-1 font-normal opacity-50">(optional)</span>}
            </p>

            {q.type === "text" &&
              (q.multiline ? (
                <textarea
                  value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  rows={3}
                  placeholder={q.placeholder}
                  autoFocus={qIndex === 0}
                  className="w-full rounded-2xl px-3.5 py-2.5 text-sm outline-none"
                  style={{ background: theme.cream, border: `2px solid ${theme.cream}` }}
                />
              ) : (
                <input
                  value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder}
                  autoFocus={qIndex === 0}
                  className="w-full rounded-2xl px-3.5 py-2.5 text-sm outline-none"
                  style={{ background: theme.cream, border: `2px solid ${theme.cream}` }}
                />
              ))}

            {q.type === "choice" && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={q.label}>
                {q.options.map((opt) => {
                  const selected = answers[q.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setAnswer(q.id, opt.value)}
                      className="rounded-2xl px-3.5 py-2 text-xs font-semibold transition-transform hover:-translate-y-0.5 sm:text-sm"
                      style={{
                        border: `2px solid ${theme.ink}`,
                        boxShadow: `2px 2px 0 0 ${theme.ink}`,
                        background: selected ? theme.accent : "#fff",
                        color: theme.ink,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "multiChoice" && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={q.label}>
                {q.options.map((opt) => {
                  const selected = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleMulti(q.id, opt.value)}
                      className="rounded-2xl px-3.5 py-2 text-xs font-semibold transition-transform hover:-translate-y-0.5"
                      style={{
                        border: `2px solid ${theme.ink}`,
                        boxShadow: `2px 2px 0 0 ${theme.ink}`,
                        background: selected ? theme.accent : "#fff",
                        color: theme.ink,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "scale" && (
              <>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={q.label}>
                  {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => {
                    const selected = answers[q.id] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setAnswer(q.id, n)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-transform hover:-translate-y-0.5"
                        style={{
                          border: `2px solid ${theme.ink}`,
                          boxShadow: `2px 2px 0 0 ${theme.ink}`,
                          background: selected ? theme.accent : "#fff",
                          color: theme.ink,
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                {(q.minLabel ?? q.maxLabel) && (
                  <div className="mt-1 flex justify-between text-[10px] opacity-50">
                    <span>{q.minLabel}</span>
                    <span>{q.maxLabel}</span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {error && <p className="mt-4 text-xs font-semibold text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="mt-7 w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40"
        style={{ border: `2px solid ${theme.ink}`, background: theme.primary, boxShadow: `3px 3px 0 0 ${theme.ink}` }}
      >
        {submitting ? "Submitting…" : (config.submitLabel ?? "Submit")}
      </button>
    </form>
  );
}
