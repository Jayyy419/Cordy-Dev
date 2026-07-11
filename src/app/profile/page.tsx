"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InterestTag } from "~/components/InterestTag";
import { OpportunityCard } from "~/components/OpportunityCard";
import type { ProfileData } from "~/lib/types";

const RESUME_KEYS = ["cordy_chat_transcript", "cordy_questions_asked", "cordy_max_override"];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("cordy_profile");
    if (raw) {
      setProfile(JSON.parse(raw) as ProfileData);
    }
    setLoaded(true);
  }, []);

  function restart() {
    localStorage.removeItem("cordy_profile");
    for (const key of RESUME_KEYS) localStorage.removeItem(key);
    router.push("/intro");
  }

  function keepChatting() {
    // The chat page persists cordy_chat_transcript/questions_asked/max_override
    // every time it hands off to this results screen — resuming just means
    // going back to /chat and letting it pick those markers up.
    router.push("/chat");
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

  const hasMatches = profile.opportunities.length > 0;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cordy-cream px-4 py-8 sm:px-6 sm:py-12">
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
          {profile.tags.length > 0 ? (
            profile.tags.map((tag) => <InterestTag key={tag} tag={tag} />)
          ) : (
            <span className="rounded-2xl bg-[#f3ecda] px-3.5 py-2 text-sm text-cordy-ink/60 italic">
              No strong signals yet — that&apos;s okay!
            </span>
          )}
        </div>

        {hasMatches && (
          <div className="mt-7 border-t-2 border-cordy-cream pt-6 text-left">
            <h2 className="font-heading text-base font-bold text-cordy-ink">Matched for you</h2>
            <p className="mt-1 mb-3.5 text-xs text-cordy-ink/60">
              Sample matches from CORDY&apos;s opportunities list, based on what you shared.
            </p>
            <div className="flex flex-col gap-3">
              {profile.opportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          </div>
        )}

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
          onClick={restart}
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

