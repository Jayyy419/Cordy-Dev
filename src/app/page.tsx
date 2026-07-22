"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProfileData } from "~/lib/types";

function readSavedProfile(): ProfileData | null {
  try {
    const raw = localStorage.getItem("cordy_profile");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { tags?: unknown }).tags)
    ) {
      return null;
    }
    return parsed as ProfileData;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const [savedProfile, setSavedProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    setSavedProfile(readSavedProfile());
  }, []);

  const tagCount = savedProfile?.tags.length ?? 0;

  return (
    <div className="flex min-h-dvh flex-col bg-cordy-cream">
      {/* Header — mirrors cordy.sg's top bar */}
      <header className="flex items-center justify-between gap-2 border-b-2 border-cordy-ink px-4 py-3 sm:px-6 sm:py-4">
        <span className="hidden text-xs font-bold tracking-wide whitespace-nowrap text-cordy-ink/50 sm:inline">
          LOCATION: SG
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl">🤖</span>
          <span className="font-heading text-xl font-extrabold whitespace-nowrap text-cordy-red sm:text-2xl">
            CORDY
          </span>
        </div>
        {/* No real accounts/signup flow exists yet — a chip that looked
            clickable but did nothing was a dead-end affordance, so it's
            replaced with an invisible spacer (keeps the logo centered)
            rather than left as fake decoration. */}
        <span
          aria-hidden
          className="pointer-events-none invisible rounded-full border-2 px-3 py-1.5 text-xs font-bold whitespace-nowrap sm:px-4 sm:text-sm"
        >
          SIGN UP
        </span>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <span className="rounded-full border-2 border-cordy-ink bg-cordy-blue-tag px-4 py-1 text-xs font-bold whitespace-nowrap text-cordy-ink">
          NEW · INTEREST PROFILER
        </span>
        <h1 className="font-heading max-w-lg text-4xl font-extrabold text-cordy-ink">
          Let&apos;s find opportunities made for you
        </h1>
        <p className="max-w-md text-cordy-ink/70">
          Chat with CORDY for a few minutes and get a personalised profile with
          opportunities picked just for you — no guessing, no scrolling.
        </p>
        {savedProfile ? (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/profile"
              className="rounded-2xl border-2 border-cordy-ink bg-cordy-red px-8 py-3 text-center font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
            >
              Continue where you left off ({tagCount} thing{tagCount === 1 ? "" : "s"} spotted) →
            </Link>
            <Link
              href="/intro"
              className="text-xs font-semibold text-cordy-ink/50 hover:text-cordy-ink"
            >
              or start a fresh profile
            </Link>
          </div>
        ) : (
          <Link
            href="/intro"
            className="rounded-2xl border-2 border-cordy-ink bg-cordy-red px-8 py-3 text-center font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
          >
            Start chatting with CORDY →
          </Link>
        )}
      </main>
    </div>
  );
}
