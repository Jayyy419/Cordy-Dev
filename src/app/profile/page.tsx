"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InterestTag } from "~/components/InterestTag";
import { OpportunityCard } from "~/components/OpportunityCard";
import { trackEvent } from "~/lib/analytics";
import { copyToClipboard } from "~/lib/clipboard";
import { browseByCategory, explainMatch, matchOpportunities } from "~/lib/opportunities";
import { clearComparisonOutcome, updateComparisonOutcome } from "~/lib/studyContext";
import type { Opportunity, OpportunityFilters, ProfileData } from "~/lib/types";

const RESUME_KEYS = ["cordy_chat_transcript", "cordy_questions_asked", "cordy_max_override"];
const NOTIFY_STORAGE_KEY = "cordy_notify_signups";
const REAL_CORDY_URL = "https://cordy.sg";

/** Drop a rejected interest tag out of the structured filters so matches can be recomputed without it. */
function filtersWithoutTag(filters: OpportunityFilters, tag: string): OpportunityFilters {
  const norm = tag.toLowerCase().replace(/[-\s]+/g, " ").trim();
  const next: OpportunityFilters = { ...filters };
  if (next.subTags?.length) {
    next.subTags = next.subTags.filter(
      (t) => t.toLowerCase().replace(/[-\s]+/g, " ").trim() !== norm,
    );
    if (next.subTags.length === 0) delete next.subTags;
  }
  if (next.category?.toLowerCase() === norm) delete next.category;
  return next;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySubmitted, setNotifySubmitted] = useState(false);
  const [rejectedTags, setRejectedTags] = useState<string[]>([]);
  const [liveMatches, setLiveMatches] = useState<Opportunity[] | null>(null);
  const [comparedRealCordy, setComparedRealCordy] = useState(false);
  const [preferred, setPreferred] = useState<"cordy" | "browse" | "same" | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("cordy_profile");
    if (raw) {
      setProfile(JSON.parse(raw) as ProfileData);
    }
    setLoaded(true);
    trackEvent("viewed_profile");
  }, []);

  function restart() {
    localStorage.removeItem("cordy_profile");
    for (const key of RESUME_KEYS) localStorage.removeItem(key);
    clearComparisonOutcome();
    router.push("/intro");
  }

  function keepChatting() {
    // The chat page persists cordy_chat_transcript/questions_asked/max_override
    // every time it hands off to this results screen — resuming just means
    // going back to /chat and letting it pick those markers up.
    router.push("/chat");
  }

  async function shareWithGuardian() {
    if (!profile) return;
    // No real backend to persist a shareable record against, so the profile
    // snapshot itself is encoded into the URL — genuinely shareable and
    // read-only without needing server storage. A production version would
    // instead mint a short server-side link against a stored record.
    const encoded = btoa(encodeURIComponent(JSON.stringify(profile)));
    const url = `${window.location.origin}/shared?data=${encoded}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  }

  // ── Tag correction ─────────────────────────────────────────────────────
  // Tapping "not me" on a tag does two jobs at once: it immediately re-ranks
  // the matches (so the user sees their correction take effect rather than
  // being told it was noted), and it records a gold-standard negative label —
  // a case where the inference was demonstrably wrong — which is exactly the
  // data needed to evaluate and improve the real matcher.
  function rejectTag(tag: string) {
    if (!profile) return;
    const nextRejected = [...rejectedTags, tag];
    const nextFilters = nextRejected.reduce(
      (acc, t) => filtersWithoutTag(acc, t),
      profile.filters ?? {},
    );

    setRejectedTags(nextRejected);
    setLiveMatches(matchOpportunities(nextFilters, 4));
    updateComparisonOutcome({ rejectedTags: nextRejected });
    trackEvent("rejected_tag", tag);
  }

  function openRealCordy() {
    setComparedRealCordy(true);
    updateComparisonOutcome({ triedRealCordy: "yes" });
    trackEvent("compared_real_cordy");
    window.open(REAL_CORDY_URL, "_blank", "noopener,noreferrer");
  }

  function choosePreferred(choice: "cordy" | "browse" | "same") {
    setPreferred(choice);
    updateComparisonOutcome({ preferredList: choice });
  }

  function submitNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!notifyEmail.trim()) return;
    // PLACEHOLDER — no real email/SMS provider is wired up here. This just
    // records the opt-in locally so the concept is demonstrable; swap for a
    // real notification job once a backend exists.
    try {
      const raw = localStorage.getItem(NOTIFY_STORAGE_KEY);
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      list.push(notifyEmail.trim());
      localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // storage unavailable — non-fatal
    }
    setNotifySubmitted(true);
  }

  if (loaded && !profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cordy-cream px-6 text-center">
        <p className="font-heading text-xl font-bold text-cordy-ink">No profile found yet</p>
        <p className="text-cordy-ink/70">Chat with CORDY first to build your interest profile.</p>
        <Link
          href="/intro"
          className="rounded-full border-2 border-cordy-ink bg-cordy-red px-6 py-2.5 font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)]"
        >
          Start chatting →
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  const shownTags = profile.tags.filter((t) => !rejectedTags.includes(t));
  const shownMatches = liveMatches ?? profile.opportunities;
  const hasMatches = shownMatches.length > 0;
  const browseList = browseByCategory(profile.filters?.category, 4);

  return (
    <div className="flex min-h-dvh flex-col items-center bg-cordy-cream px-4 py-8 sm:px-6 sm:py-12">

      <div className="animate-bounce-in w-full max-w-[560px] rounded-[32px] border-4 border-cordy-ink bg-white p-6 text-center shadow-[0_30px_60px_rgba(22,33,62,0.22)] sm:rounded-[44px] sm:p-11">
        <div className="animate-mascot-bounce mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-4 border-cordy-red bg-[#ffd28f] sm:mb-5 sm:h-24 sm:w-24">
          <Image
            src="/cordy-mascot.png"
            alt="CORDY"
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        </div>

        <h1 className="font-heading text-xl font-extrabold text-cordy-ink sm:text-2xl">
          Your Interest Profile
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-cordy-ink/70">{profile.summary}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {shownTags.length > 0 ? (
            shownTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1">
                <InterestTag tag={tag} />
                <button
                  onClick={() => rejectTag(tag)}
                  aria-label={`Remove "${tag}" — this isn't me`}
                  title="Not me"
                  className="-ml-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-cordy-ink bg-white text-[10px] font-bold text-cordy-ink transition-transform hover:-translate-y-0.5"
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <span className="rounded-2xl bg-[#f3ecda] px-3.5 py-2 text-sm text-cordy-ink/60 italic">
              No strong signals yet — that&apos;s okay!
            </span>
          )}
        </div>
        {shownTags.length > 0 && (
          <p className="mt-2 text-xs text-cordy-ink/50">
            Got one wrong? Tap × and your matches update straight away.
          </p>
        )}
        {rejectedTags.length > 0 && (
          <p className="mt-1.5 text-xs font-semibold text-cordy-teal">
            ✓ Updated — removed {rejectedTags.length} thing{rejectedTags.length === 1 ? "" : "s"} that
            wasn&apos;t you.
          </p>
        )}

        {/* Promoted from a muted text link: a read-only profile a young person
            can hand to a parent is one of the few things here the real Cordy
            can't already do, so it shouldn't be the least visible thing on the
            screen. */}
        <button
          onClick={() => void shareWithGuardian()}
          className="mt-5 w-full rounded-2xl border-2 border-cordy-ink bg-white px-5 py-3 font-heading text-sm font-bold text-cordy-ink shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-6"
        >
          {shareCopied ? "Link copied! ✓" : "👪 Share this with a parent or guardian"}
        </button>

        {hasMatches && (
          <div id="matched-opportunities" className="mt-7 border-t-2 border-cordy-cream pt-6 text-left">
            <h2 className="font-heading text-base font-bold text-cordy-ink">Matched for you</h2>
            <p className="mt-1 mb-3.5 text-xs text-cordy-ink/60">
              Sample matches from CORDY&apos;s opportunities list, based on what you shared.
            </p>
            <div className="flex flex-col gap-3">
              {shownMatches.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  matchReasons={explainMatch(opp, profile.filters ?? {})}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Did this actually beat browsing? ──────────────────────────────
            The survey's headline question asks people to compare CORDY with
            browsing themselves. Asked cold, that's a memory test. Shown here,
            side by side and in context, it's a real choice — and we record
            both the answer and whether they went and checked the real Cordy,
            so the survey response can be segmented on it later. */}
        {hasMatches && (
          <div className="mt-7 border-t-2 border-cordy-cream pt-6 text-left">
            <h2 className="font-heading text-base font-bold text-cordy-ink">
              Was this better than browsing yourself?
            </h2>
            <p className="mt-1 mb-3.5 text-xs leading-relaxed text-cordy-ink/60">
              On the left is what CORDY picked from your chat. On the right is what you&apos;d see
              just clicking the category and scrolling.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-cordy-teal bg-white p-3">
                <p className="mb-2 text-xs font-bold text-cordy-ink">🤖 CORDY picked</p>
                <ul className="flex flex-col gap-1.5">
                  {shownMatches.map((o) => (
                    <li key={o.id} className="text-xs leading-snug text-cordy-ink/80">
                      • {o.title}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border-2 border-cordy-cream bg-cordy-cream/50 p-3">
                <p className="mb-2 text-xs font-bold text-cordy-ink/70">📋 Just browsing</p>
                <ul className="flex flex-col gap-1.5">
                  {browseList.map((o) => (
                    <li key={o.id} className="text-xs leading-snug text-cordy-ink/60">
                      • {o.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-3.5 text-xs font-semibold text-cordy-ink">
              Which list would you actually act on?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["cordy", "CORDY's picks"],
                  ["same", "About the same"],
                  ["browse", "Just browsing"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => choosePreferred(value)}
                  aria-pressed={preferred === value}
                  className={`rounded-2xl border-2 border-cordy-ink px-3.5 py-1.5 text-xs font-bold shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 ${
                    preferred === value ? "bg-cordy-teal text-cordy-ink" : "bg-white text-cordy-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {preferred && (
              <p className="mt-2 text-xs font-semibold text-cordy-teal">✓ Thanks — noted!</p>
            )}
          </div>
        )}

        {/* ── What next ─────────────────────────────────────────────────────
            The two things we actually want from someone at this point, offered
            as one explicit choice rather than scattered around the screen:
            go look at the real Cordy, or tell us how this went. Both are
            recorded — the real-Cordy route sets triedRealCordy, which is what
            lets the survey's "better than browsing?" answer be segmented by
            whether they genuinely compared. */}
        <div className="mt-8 border-t-2 border-cordy-cream pt-6">
          <h2 className="font-heading text-base font-bold text-cordy-ink">What next?</h2>
          <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={openRealCordy}
              className="rounded-2xl border-2 border-cordy-ink bg-white p-4 text-left shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
            >
              <p className="font-heading text-sm font-bold text-cordy-ink">
                {comparedRealCordy ? "✓ Opened the real Cordy" : "Visit the real Cordy ↗"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-cordy-ink/65">
                {comparedRealCordy
                  ? "Thanks! Come back and tell us how it compared."
                  : "Opens in a new tab — your profile stays right here."}
              </p>
            </button>

            <button
              onClick={() => router.push("/survey")}
              className="rounded-2xl border-2 border-cordy-ink bg-cordy-teal p-4 text-left shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
            >
              <p className="font-heading text-sm font-bold text-cordy-ink">📝 Take a short survey</p>
              <p className="mt-1 text-xs leading-relaxed text-cordy-ink/70">
                About a minute. It genuinely decides whether we build this properly.
              </p>
            </button>
          </div>
        </div>

        <div className="mt-7 border-t-2 border-cordy-cream pt-6 text-left">
          <h2 className="font-heading text-sm font-bold text-cordy-ink">Nothing quite right yet?</h2>
          {notifySubmitted ? (
            <p className="mt-1 text-xs font-semibold text-cordy-teal">
              ✓ We&apos;ll ping you when something new matches!
            </p>
          ) : (
            <>
              <p className="mt-1 mb-2.5 text-xs leading-relaxed text-cordy-ink/70">
                Get an email when a new opportunity matches your profile.
              </p>
              <form onSubmit={submitNotify} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="min-w-0 flex-1 rounded-full border-2 border-cordy-cream bg-cordy-cream px-3.5 py-2 text-xs text-cordy-ink placeholder-cordy-ink/40 outline-none focus:border-cordy-teal"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full border-2 border-cordy-ink bg-cordy-teal px-3.5 py-2 text-xs font-bold text-cordy-ink"
                >
                  Notify me
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-7 border-t-2 border-cordy-cream pt-6 text-left">
          <h2 className="font-heading text-sm font-bold text-cordy-ink">
            Want an even sharper profile?
          </h2>
          <p className="mt-1 mb-3.5 text-xs leading-relaxed text-cordy-ink/70">
            Keep chatting with CORDY — every extra detail you share builds a fuller picture of your
            interests, so future matches get more accurate over time.
          </p>
          <button
            onClick={keepChatting}
            className="w-full rounded-2xl border-2 border-cordy-ink bg-cordy-ink py-3 font-heading text-sm font-bold text-[#ffd28f] shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
          >
            Keep chatting with CORDY →
          </button>
        </div>

        <button
          onClick={
            hasMatches
              ? () =>
                  document
                    .getElementById("matched-opportunities")
                    ?.scrollIntoView({ behavior: "smooth" })
              : restart
          }
          className="mt-3.5 w-full rounded-2xl border-2 border-cordy-ink bg-cordy-red py-3 font-heading text-sm font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
        >
          {hasMatches ? "See recommended opportunities" : "Start over"}
        </button>
        {hasMatches && (
          <button
            onClick={restart}
            className="mt-3.5 text-sm font-semibold text-cordy-ink/60 hover:text-cordy-ink"
          >
            Start over
          </button>
        )}
      </div>
    </div>
  );
}
