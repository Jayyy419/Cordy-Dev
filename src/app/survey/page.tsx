"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getOrCreateProfileId } from "~/lib/backendProfileSim";
import { submitSurvey, type SurveyResponse } from "~/lib/surveySim";

const OVERALL_OPTIONS = [
  { value: 1, label: "Not great" },
  { value: 2, label: "Meh" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Amazing" },
];

const RELEVANT_OPTIONS: { value: SurveyResponse["questionsRelevant"]; label: string }[] = [
  { value: "yes", label: "Yes, mostly" },
  { value: "somewhat", label: "Somewhat" },
  { value: "not_really", label: "Not really" },
];

const MATCH_OPTIONS: { value: SurveyResponse["matchQuality"]; label: string }[] = [
  { value: "yes", label: "Yes, I'd consider them" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No, not for me" },
  { value: "no_matches_shown", label: "I didn't get any matches" },
];

const OBSTACLE_OPTIONS = [
  "Nothing, it was smooth",
  "Took too long",
  "Questions felt confusing",
  "Didn't trust the matches",
  "Technical issues / bugs",
  "Other",
];

type Section = "form" | "done";

export default function SurveyPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("form");

  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [questionsRelevant, setQuestionsRelevant] = useState<SurveyResponse["questionsRelevant"] | null>(
    null,
  );
  const [matchQuality, setMatchQuality] = useState<SurveyResponse["matchQuality"] | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [obstacles, setObstacles] = useState<string[]>([]);
  const [comments, setComments] = useState("");

  const canSubmit = overallRating !== null && questionsRelevant !== null && matchQuality !== null && nps !== null;

  function toggleObstacle(opt: string) {
    setObstacles((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || overallRating === null || questionsRelevant === null || matchQuality === null || nps === null) {
      return;
    }
    submitSurvey({
      profileId: getOrCreateProfileId(),
      overallRating,
      questionsRelevant,
      matchQuality,
      nps,
      obstacles,
      comments: comments.trim(),
    });
    setSection("done");
  }

  return (
    <main
      className="min-h-dvh px-4 py-8 sm:px-6 sm:py-12"
      style={{ background: "linear-gradient(180deg, #FFF6E4 0%, #FBEED4 100%)" }}
    >
      <div className="mx-auto w-full max-w-2xl">
        {section === "done" ? (
          <div className="animate-bounce-in rounded-[32px] border-4 border-cordy-ink bg-white p-6 text-center shadow-[0_30px_60px_rgba(22,33,62,0.22)] sm:rounded-[44px] sm:p-11">
            <div className="animate-mascot-bounce mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-4 border-cordy-red bg-[#ffd28f] sm:h-24 sm:w-24">
              <Image
                src="/cordy-mascot.png"
                alt="CORDY"
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            </div>
            <h1 className="font-heading mt-4 text-xl font-extrabold text-cordy-ink sm:text-2xl">
              Thanks so much! 🙏
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-cordy-ink/70">
              Your feedback genuinely helps us figure out if this is worth building for real.
            </p>
            <button
              onClick={() => router.push("/profile")}
              className="mt-6 w-full rounded-2xl border-2 border-cordy-ink bg-cordy-red py-3 font-heading text-sm font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-8"
            >
              Back to my profile →
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="animate-bounce-in rounded-[32px] border-4 border-cordy-ink bg-white p-6 shadow-[0_30px_60px_rgba(22,33,62,0.22)] sm:rounded-[44px] sm:p-9"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-cordy-red bg-[#ffd28f]">
                <Image src="/cordy-mascot.png" alt="CORDY" width={44} height={44} className="h-full w-full object-cover" />
              </div>
              <div>
                <h1 className="font-heading text-lg font-extrabold text-cordy-ink sm:text-xl">
                  Quick survey
                </h1>
                <p className="text-xs text-cordy-ink/60">
                  ~1 minute, totally optional — help us validate if this actually works.
                </p>
              </div>
            </div>

            {/* Q1: overall rating */}
            <fieldset className="mt-7">
              <legend className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Overall, how was your experience with CORDY?
              </legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Overall experience rating">
                {OVERALL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={overallRating === opt.value}
                    onClick={() => setOverallRating(opt.value)}
                    className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:text-sm ${
                      overallRating === opt.value ? "bg-cordy-teal text-cordy-ink" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Q2: questions relevant */}
            <fieldset className="mt-6">
              <legend className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Did CORDY&apos;s questions feel relevant to figuring out your interests?
              </legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Question relevance">
                {RELEVANT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={questionsRelevant === opt.value}
                    onClick={() => setQuestionsRelevant(opt.value)}
                    className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:text-sm ${
                      questionsRelevant === opt.value ? "bg-cordy-teal text-cordy-ink" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Q3: match quality */}
            <fieldset className="mt-6">
              <legend className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Were the matched opportunities something you&apos;d actually consider?
              </legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Match quality">
                {MATCH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={matchQuality === opt.value}
                    onClick={() => setMatchQuality(opt.value)}
                    className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:text-sm ${
                      matchQuality === opt.value ? "bg-cordy-teal text-cordy-ink" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Q4: NPS */}
            <fieldset className="mt-6">
              <legend className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                How likely are you to recommend this to a friend?
              </legend>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Likelihood to recommend, 0 to 10">
                {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={nps === n}
                    onClick={() => setNps(n)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cordy-ink text-xs font-bold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 ${
                      nps === n ? "bg-cordy-teal text-cordy-ink" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-cordy-ink/50">
                <span>Not likely</span>
                <span>Very likely</span>
              </div>
            </fieldset>

            {/* Q5: obstacles */}
            <fieldset className="mt-6">
              <legend className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                What almost stopped you from finishing? <span className="font-normal text-cordy-ink/50">(pick any)</span>
              </legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Obstacles">
                {OBSTACLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={obstacles.includes(opt)}
                    onClick={() => toggleObstacle(opt)}
                    className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 ${
                      obstacles.includes(opt) ? "bg-cordy-blue-tag text-cordy-ink" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Q6: free text */}
            <fieldset className="mt-6">
              <legend className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Anything else you want to tell us? <span className="font-normal text-cordy-ink/50">(optional)</span>
              </legend>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Type here..."
                className="w-full rounded-2xl border-2 border-cordy-cream bg-cordy-cream px-3.5 py-2.5 text-sm text-cordy-ink placeholder-cordy-ink/40 outline-none focus:border-cordy-teal"
              />
            </fieldset>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-7 w-full rounded-2xl border-2 border-cordy-ink bg-cordy-red py-3.5 font-heading text-sm font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              Submit feedback
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
