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

const VS_BROWSING_OPTIONS: { value: SurveyResponse["vsBrowsing"]; label: string }[] = [
  { value: "worse", label: "Worse — I'd rather just browse/search" },
  { value: "same", label: "About the same" },
  { value: "better", label: "Better than browsing myself" },
];

const WOULD_USE_OPTIONS: { value: SurveyResponse["wouldUseForReal"]; label: string }[] = [
  { value: "yes", label: "Yes, definitely" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
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

const LIKED_OPTIONS = [
  "The chat conversation felt natural",
  "I liked the visual design (mascot etc.)",
  "It was fast",
  "The questions made sense",
  "The matches felt relevant",
  "The voice input",
  "Nothing really stood out",
];

const DISLIKED_OPTIONS = [
  "The chat felt robotic/repetitive",
  "Confusing questions",
  "Took too long",
  "Didn't trust the matches",
  "Visual design / mobile issues",
  "Technical bugs",
  "Nothing, it was fine",
];

type Section = "form" | "done";

export default function SurveyPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("form");
  const [submitting, setSubmitting] = useState(false);

  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [vsBrowsing, setVsBrowsing] = useState<SurveyResponse["vsBrowsing"] | null>(null);
  const [wouldUseForReal, setWouldUseForReal] = useState<SurveyResponse["wouldUseForReal"] | null>(null);
  const [questionsRelevant, setQuestionsRelevant] = useState<SurveyResponse["questionsRelevant"] | null>(
    null,
  );
  const [matchQuality, setMatchQuality] = useState<SurveyResponse["matchQuality"] | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [likedTags, setLikedTags] = useState<string[]>([]);
  const [dislikedTags, setDislikedTags] = useState<string[]>([]);
  const [likedMost, setLikedMost] = useState("");
  const [wouldChange, setWouldChange] = useState("");

  const canSubmit =
    overallRating !== null &&
    vsBrowsing !== null &&
    wouldUseForReal !== null &&
    questionsRelevant !== null &&
    matchQuality !== null &&
    nps !== null;

  function toggleTag(list: string[], setList: (v: string[]) => void, opt: string) {
    setList(list.includes(opt) ? list.filter((o) => o !== opt) : [...list, opt]);
  }

  function clearAll() {
    setOverallRating(null);
    setVsBrowsing(null);
    setWouldUseForReal(null);
    setQuestionsRelevant(null);
    setMatchQuality(null);
    setNps(null);
    setLikedTags([]);
    setDislikedTags([]);
    setLikedMost("");
    setWouldChange("");
  }

  const hasAnyAnswer =
    overallRating !== null ||
    vsBrowsing !== null ||
    wouldUseForReal !== null ||
    questionsRelevant !== null ||
    matchQuality !== null ||
    nps !== null ||
    likedTags.length > 0 ||
    dislikedTags.length > 0 ||
    likedMost.trim() !== "" ||
    wouldChange.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      overallRating === null ||
      vsBrowsing === null ||
      wouldUseForReal === null ||
      questionsRelevant === null ||
      matchQuality === null ||
      nps === null ||
      submitting
    ) {
      return;
    }

    const payload = {
      profileId: getOrCreateProfileId(),
      overallRating,
      vsBrowsing,
      wouldUseForReal,
      questionsRelevant,
      matchQuality,
      nps,
      likedTags,
      dislikedTags,
      likedMost: likedMost.trim(),
      wouldChange: wouldChange.trim(),
    };

    setSubmitting(true);
    // Local copy first (works even if the network request fails), then the
    // real server-side write (Airtable when configured — see
    // src/app/api/survey/route.ts).
    submitSurvey(payload);
    try {
      await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("[survey] failed to reach /api/survey, response is still saved locally:", err);
    }
    setSubmitting(false);
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
            <div className="flex items-start justify-between gap-3">
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
              {hasAnyAnswer && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="shrink-0 text-xs font-semibold text-cordy-ink/50 hover:text-cordy-ink"
                >
                  Clear choices
                </button>
              )}
            </div>

            {/* Q1: overall rating */}
            <div className="mt-7">
              <p className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Overall, how was your experience with CORDY?
              </p>
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
            </div>

            {/* Q2: vs. browsing — THE core concept-validation question */}
            <div className="mt-6 rounded-2xl border-2 border-cordy-red/30 bg-[#fff3f5] p-3.5 sm:p-4">
              <p className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Compared to just browsing/searching for programmes yourself, was chatting with CORDY...
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Chatting vs. browsing comparison">
                {VS_BROWSING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={vsBrowsing === opt.value}
                    onClick={() => setVsBrowsing(opt.value)}
                    className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:text-sm ${
                      vsBrowsing === opt.value ? "bg-cordy-red text-white" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: would actually use for real — distinct from NPS advocacy */}
            <div className="mt-6 rounded-2xl border-2 border-cordy-red/30 bg-[#fff3f5] p-3.5 sm:p-4">
              <p className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Would you actually use something like this to find real programmes?
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Would use for real">
                {WOULD_USE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={wouldUseForReal === opt.value}
                    onClick={() => setWouldUseForReal(opt.value)}
                    className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:text-sm ${
                      wouldUseForReal === opt.value ? "bg-cordy-red text-white" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q4: questions relevant */}
            <div className="mt-6">
              <p className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Did CORDY&apos;s questions feel relevant to figuring out your interests?
              </p>
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
            </div>

            {/* Q5: match quality */}
            <div className="mt-6">
              <p className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                Were the matched opportunities something you&apos;d actually consider?
              </p>
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
            </div>

            {/* Q6: NPS */}
            <div className="mt-6">
              <p className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                How likely are you to recommend this to a friend?
              </p>
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
            </div>

            {/* Q7: what stood out as good */}
            <div className="mt-6">
              <p className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                What stood out as <span className="text-cordy-teal">good</span>?{" "}
                <span className="font-normal text-cordy-ink/50">(pick any)</span>
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="What stood out as good">
                {LIKED_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={likedTags.includes(opt)}
                    onClick={() => toggleTag(likedTags, setLikedTags, opt)}
                    className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 ${
                      likedTags.includes(opt) ? "bg-cordy-teal text-cordy-ink" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q8: what stood out as bad */}
            <div className="mt-6">
              <p className="font-heading mb-2.5 text-sm font-bold text-cordy-ink">
                What stood out as <span className="text-cordy-red">bad</span>, or what would you change?{" "}
                <span className="font-normal text-cordy-ink/50">(pick any)</span>
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="What stood out as bad">
                {DISLIKED_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={dislikedTags.includes(opt)}
                    onClick={() => toggleTag(dislikedTags, setDislikedTags, opt)}
                    className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-2 text-xs font-semibold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 ${
                      dislikedTags.includes(opt) ? "bg-cordy-blue-tag text-cordy-ink" : "bg-white text-cordy-ink"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q9: free text — liked most / would change */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="font-heading mb-2 text-sm font-bold text-cordy-ink">
                  ONE thing you liked most? <span className="font-normal text-cordy-ink/50">(optional)</span>
                </p>
                <textarea
                  value={likedMost}
                  onChange={(e) => setLikedMost(e.target.value)}
                  rows={3}
                  placeholder="Type here..."
                  className="w-full rounded-2xl border-2 border-cordy-cream bg-cordy-cream px-3.5 py-2.5 text-sm text-cordy-ink placeholder-cordy-ink/40 outline-none focus:border-cordy-teal"
                />
              </div>
              <div>
                <p className="font-heading mb-2 text-sm font-bold text-cordy-ink">
                  ONE thing you&apos;d change? <span className="font-normal text-cordy-ink/50">(optional)</span>
                </p>
                <textarea
                  value={wouldChange}
                  onChange={(e) => setWouldChange(e.target.value)}
                  rows={3}
                  placeholder="Type here..."
                  className="w-full rounded-2xl border-2 border-cordy-cream bg-cordy-cream px-3.5 py-2.5 text-sm text-cordy-ink placeholder-cordy-ink/40 outline-none focus:border-cordy-teal"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="mt-7 w-full rounded-2xl border-2 border-cordy-ink bg-cordy-red py-3.5 font-heading text-sm font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit feedback"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
