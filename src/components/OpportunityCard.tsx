"use client";

import { useState } from "react";
import { getOrCreateProfileId } from "~/lib/backendProfileSim";
import { copyToClipboard } from "~/lib/clipboard";
import { hasSubmittedFeedback, submitAttendanceFeedback } from "~/lib/feedbackSim";
import { estimatedRecentJoins } from "~/lib/opportunities";
import type { Opportunity } from "~/lib/types";
import { InterestTag } from "./InterestTag";

interface OpportunityCardProps {
  opportunity: Opportunity;
  /** Human-readable reasons this opportunity matched (see lib/opportunities.ts explainMatch) */
  matchReasons?: string[];
  /** Hide invite/feedback actions that only make sense for the profiled user themselves (e.g. a guardian's read-only shared view) */
  readOnly?: boolean;
}

export function OpportunityCard({ opportunity, matchReasons, readOnly = false }: OpportunityCardProps) {
  const [inviteCopied, setInviteCopied] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(() =>
    typeof window === "undefined"
      ? false
      : hasSubmittedFeedback(getOrCreateProfileId(), opportunity.id),
  );
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  const recentJoins = estimatedRecentJoins(opportunity.id);
  const isTeam = opportunity.groupSize === "team";

  async function inviteAFriend() {
    const url = `${window.location.origin}/invite?title=${encodeURIComponent(
      opportunity.title,
    )}&desc=${encodeURIComponent(opportunity.description)}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  }

  function submitFeedback() {
    if (rating === 0) return;
    submitAttendanceFeedback({
      profileId: getOrCreateProfileId(),
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      rating,
      note,
    });
    setFeedbackDone(true);
    setFeedbackOpen(false);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-cordy-ink bg-white p-4 text-left shadow-[4px_4px_0_0_var(--color-cordy-ink)] sm:gap-3 sm:p-5">
      <h3 className="font-heading text-lg font-bold text-cordy-ink">{opportunity.title}</h3>
      <p className="text-sm leading-relaxed text-cordy-ink/70">{opportunity.description}</p>

      <div className="flex flex-wrap gap-2">
        {opportunity.tags.map((tag) => (
          <InterestTag key={tag} tag={tag} />
        ))}
      </div>

      {matchReasons && matchReasons.length > 0 && (
        <div className="rounded-xl bg-cordy-cream px-3 py-2 text-xs text-cordy-ink/70">
          <span className="font-semibold text-cordy-ink">Why this matched: </span>
          {matchReasons.join(" · ")}
        </div>
      )}

      <p className="text-xs text-cordy-ink/50">
        🎉 {recentJoins} people with a similar profile joined this recently
      </p>

      <div className="flex flex-wrap gap-2">
        {opportunity.url && (
          <a
            href={opportunity.url}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-full border-2 border-cordy-ink bg-cordy-teal px-4 py-1.5 text-xs font-bold text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
          >
            Learn more →
          </a>
        )}
        {isTeam && !readOnly && (
          <button
            onClick={() => void inviteAFriend()}
            className="self-start rounded-full border-2 border-cordy-ink bg-white px-4 py-1.5 text-xs font-bold text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
          >
            {inviteCopied ? "Link copied! ✓" : "Invite a friend →"}
          </button>
        )}
      </div>

      {!readOnly && (
      <div className="border-t border-cordy-cream pt-2.5">
        {feedbackDone ? (
          <p className="text-xs font-semibold text-cordy-teal">✓ Thanks for your feedback!</p>
        ) : feedbackOpen ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                  className={`text-lg ${n <= rating ? "opacity-100" : "opacity-30"}`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional: how was it?"
              className="rounded-full border-2 border-cordy-cream bg-cordy-cream px-3 py-1.5 text-xs text-cordy-ink placeholder-cordy-ink/40 outline-none focus:border-cordy-teal"
            />
            <button
              onClick={submitFeedback}
              disabled={rating === 0}
              className="self-start rounded-full border-2 border-cordy-ink bg-cordy-ink px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            >
              Submit feedback
            </button>
          </div>
        ) : (
          <button
            onClick={() => setFeedbackOpen(true)}
            className="text-xs font-semibold text-cordy-ink/50 hover:text-cordy-ink"
          >
            Went to this? Rate it →
          </button>
        )}
      </div>
      )}
    </div>
  );
}
