"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InterestTag } from "~/components/InterestTag";
import { OpportunityCard } from "~/components/OpportunityCard";
import type { ProfileData } from "~/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("cordy_profile");
    if (raw) {
      setProfile(JSON.parse(raw) as ProfileData);
    }
    setLoaded(true);
  }, []);

  if (loaded && !profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cordy-cream px-6 text-center">
        <p className="font-heading text-xl font-bold text-cordy-ink">
          No profile found yet
        </p>
        <p className="text-cordy-ink/70">
          Chat with CORDY first to build your interest profile.
        </p>
        <Link
          href="/chat"
          className="rounded-full border-2 border-cordy-ink bg-cordy-red px-6 py-2.5 font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)]"
        >
          Start chatting →
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-dvh bg-cordy-cream">
      <header className="flex items-center justify-center gap-2 border-b-2 border-cordy-ink px-6 py-4">
        <span className="text-2xl">🤖</span>
        <span className="font-heading text-2xl font-extrabold text-cordy-red">
          CORDY
        </span>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
        {/* Summary card */}
        <section className="rounded-2xl border-2 border-cordy-ink bg-white p-6 shadow-[4px_4px_0_0_var(--color-cordy-ink)]">
          <h1 className="font-heading mb-3 text-2xl font-bold text-cordy-ink">
            Your Interest Profile
          </h1>
          <p className="leading-relaxed text-cordy-ink/80">{profile.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <InterestTag key={tag} tag={tag} />
            ))}
          </div>
        </section>

        {/* Opportunities */}
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-bold text-cordy-ink">
            Opportunities for you
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profile.opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </section>

        <Link
          href="/"
          className="self-center rounded-full border-2 border-cordy-ink bg-white px-6 py-2.5 text-sm font-bold text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)]"
        >
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
