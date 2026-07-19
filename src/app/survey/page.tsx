"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SurveyForm } from "~/components/SurveyForm";
import { getOrCreateProfileId } from "~/lib/backendProfileSim";
import { submitSurveyLocal } from "~/lib/surveySim";
import type { SurveyAnswers, SurveyModuleConfig } from "~/lib/survey/types";

// CORDY-specific config for the generic SurveyForm module (see
// src/components/SurveyForm.tsx + src/lib/survey/types.ts). To reuse this
// screen for a future project: write a new SurveyModuleConfig here (or in
// a new page) and point AIRTABLE_BASE_ID/AIRTABLE_TABLE_ID at a different
// base — everything else (the form, the API route) is already generic.
const SURVEY_CONFIG: SurveyModuleConfig = {
  id: "cordy-interest-profiler-v1",
  title: "Quick survey",
  subtitle: "~1 minute, totally optional — help us validate if this actually works.",
  avatarSrc: "/cordy-mascot.png",
  submitLabel: "Submit feedback",
  doneTitle: "Thanks so much! 🙏",
  doneMessage: "Your feedback genuinely helps us figure out if this is worth building for real.",
  questions: [
    {
      id: "overallRating",
      type: "choice",
      label: "Overall, how was your experience with CORDY?",
      required: true,
      options: [
        { value: "1", label: "Not great" },
        { value: "2", label: "Meh" },
        { value: "3", label: "Okay" },
        { value: "4", label: "Good" },
        { value: "5", label: "Amazing" },
      ],
    },
    {
      id: "vsBrowsing",
      type: "choice",
      label: "Compared to just browsing/searching for programmes yourself, was chatting with CORDY...",
      required: true,
      highlight: true,
      options: [
        { value: "worse", label: "Worse — I'd rather just browse/search" },
        { value: "same", label: "About the same" },
        { value: "better", label: "Better than browsing myself" },
      ],
    },
    {
      id: "wouldUseForReal",
      type: "choice",
      label: "Would you actually use something like this to find real programmes?",
      required: true,
      highlight: true,
      options: [
        { value: "yes", label: "Yes, definitely" },
        { value: "maybe", label: "Maybe" },
        { value: "no", label: "No" },
      ],
    },
    {
      id: "questionsRelevant",
      type: "choice",
      label: "Did CORDY's questions feel relevant to figuring out your interests?",
      required: true,
      options: [
        { value: "yes", label: "Yes, mostly" },
        { value: "somewhat", label: "Somewhat" },
        { value: "not_really", label: "Not really" },
      ],
    },
    {
      id: "matchQuality",
      type: "choice",
      label: "Were the matched opportunities something you'd actually consider?",
      required: true,
      options: [
        { value: "yes", label: "Yes, I'd consider them" },
        { value: "maybe", label: "Maybe" },
        { value: "no", label: "No, not for me" },
        { value: "no_matches_shown", label: "I didn't get any matches" },
      ],
    },
    {
      id: "nps",
      type: "scale",
      label: "How likely are you to recommend this to a friend?",
      required: true,
      min: 0,
      max: 10,
      minLabel: "Not likely",
      maxLabel: "Very likely",
    },
    {
      id: "likedTags",
      type: "multiChoice",
      label: "What stood out as good?",
      options: [
        { value: "The chat conversation felt natural", label: "The chat conversation felt natural" },
        { value: "I liked the visual design (mascot etc.)", label: "I liked the visual design (mascot etc.)" },
        { value: "It was fast", label: "It was fast" },
        { value: "The questions made sense", label: "The questions made sense" },
        { value: "The matches felt relevant", label: "The matches felt relevant" },
        { value: "The voice input", label: "The voice input" },
        { value: "Nothing really stood out", label: "Nothing really stood out" },
      ],
    },
    {
      id: "dislikedTags",
      type: "multiChoice",
      label: "What stood out as bad, or what would you change?",
      options: [
        { value: "The chat felt robotic/repetitive", label: "The chat felt robotic/repetitive" },
        { value: "Confusing questions", label: "Confusing questions" },
        { value: "Took too long", label: "Took too long" },
        { value: "Didn't trust the matches", label: "Didn't trust the matches" },
        { value: "Visual design / mobile issues", label: "Visual design / mobile issues" },
        { value: "Technical bugs", label: "Technical bugs" },
        { value: "Nothing, it was fine", label: "Nothing, it was fine" },
      ],
    },
    {
      id: "likedMost",
      type: "text",
      label: "ONE thing you liked most?",
      multiline: true,
      placeholder: "Type here...",
    },
    {
      id: "wouldChange",
      type: "text",
      label: "ONE thing you'd change?",
      multiline: true,
      placeholder: "Type here...",
    },
    { id: "name", type: "text", label: "What's your name?", required: true, placeholder: "Type here..." },
    { id: "school", type: "text", label: "What school are you at?", required: true, placeholder: "Type here..." },
  ],
};

export default function SurveyPage() {
  const router = useRouter();

  async function handleSubmit(answers: SurveyAnswers) {
    const meta = { profileId: getOrCreateProfileId() };
    // Local copy first (works even if the network request fails), then the
    // real server-side write (Airtable when configured — see
    // src/app/api/survey/route.ts).
    submitSurveyLocal(SURVEY_CONFIG.id, meta, answers);
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta, answers }),
    });
    if (!res.ok) {
      throw new Error(`/api/survey responded ${res.status}`);
    }
  }

  return (
    <main
      className="min-h-dvh px-4 py-8 sm:px-6 sm:py-12"
      style={{ background: "linear-gradient(180deg, #FFF6E4 0%, #FBEED4 100%)" }}
    >
      <div className="mx-auto mb-4 w-full max-w-2xl">
        <Link
          href="/profile"
          className="text-xs font-semibold text-cordy-ink/50 hover:text-cordy-ink"
        >
          ← Back to profile
        </Link>
      </div>
      <SurveyForm
        config={SURVEY_CONFIG}
        onSubmit={handleSubmit}
        doneAction={{ label: "Back to my profile →", onClick: () => router.push("/profile") }}
      />
    </main>
  );
}
