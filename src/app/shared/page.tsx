"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { InterestTag } from "~/components/InterestTag";
import { OpportunityCard } from "~/components/OpportunityCard";
import { LIMITS } from "~/lib/apiLimits";
import { explainMatch } from "~/lib/opportunities";
import type { ProfileData } from "~/lib/types";

function isProfileData(value: unknown): value is ProfileData {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.summary === "string" &&
    Array.isArray(v.tags) &&
    v.tags.every((t) => typeof t === "string") &&
    Array.isArray(v.opportunities)
  );
}

function decodeProfile(data: string | null): ProfileData | null {
  if (!data || data.length > LIMITS.MAX_SHARED_PAYLOAD_CHARS) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(atob(data)));
    return isProfileData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function SharedProfileView() {
  const searchParams = useSearchParams();
  const profile = useMemo(() => decodeProfile(searchParams.get("data")), [searchParams]);

  if (!profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cordy-cream px-6 text-center">
        <p className="font-heading text-xl font-bold text-cordy-ink">Link looks broken</p>
        <p className="text-cordy-ink/70">This shared profile link couldn&apos;t be read.</p>
        <Link
          href="/intro"
          className="mt-2 inline-block rounded-2xl border-2 border-cordy-ink bg-cordy-red px-6 py-3 font-heading text-sm font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
        >
          Build your own CORDY profile →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cordy-cream px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-[560px] rounded-[32px] border-4 border-cordy-ink bg-white p-6 text-center shadow-[0_30px_60px_rgba(22,33,62,0.22)] sm:rounded-[44px] sm:p-11">
        <span className="mb-4 inline-block rounded-2xl border-2 border-cordy-ink bg-cordy-blue-tag px-3 py-1.5 text-xs font-bold text-cordy-ink">
          👀 Shared profile — view only
        </span>

        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-4 border-cordy-red bg-[#ffd28f] sm:h-24 sm:w-24">
          <Image
            src="/cordy-mascot.png"
            alt="CORDY"
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        </div>

        <h1 className="font-heading mt-4 text-xl font-extrabold text-cordy-ink sm:text-2xl">
          Their Interest Profile
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-cordy-ink/70">{profile.summary}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {profile.tags.map((tag) => (
            <InterestTag key={tag} tag={tag} />
          ))}
        </div>

        {profile.opportunities.length > 0 && (
          <div className="mt-7 border-t-2 border-cordy-cream pt-6 text-left">
            <h2 className="font-heading text-base font-bold text-cordy-ink">Matched opportunities</h2>
            <div className="mt-3.5 flex flex-col gap-3">
              {profile.opportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  matchReasons={explainMatch(opp, profile.filters ?? {})}
                  readOnly
                />
              ))}
            </div>
          </div>
        )}

        <Link
          href="/intro"
          className="mt-7 inline-block rounded-2xl border-2 border-cordy-ink bg-cordy-red px-6 py-3 font-heading text-sm font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
        >
          Build your own CORDY profile →
        </Link>
      </div>
    </div>
  );
}

export default function SharedPage() {
  return (
    <Suspense fallback={null}>
      <SharedProfileView />
    </Suspense>
  );
}
