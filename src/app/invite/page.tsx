"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MAX_TITLE_CHARS = 120;
const MAX_DESC_CHARS = 400;

function InviteView() {
  const searchParams = useSearchParams();
  const title = searchParams.get("title")?.slice(0, MAX_TITLE_CHARS) ?? null;
  const desc = searchParams.get("desc")?.slice(0, MAX_DESC_CHARS) ?? null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cordy-cream px-4 py-8 sm:px-6 sm:py-12">
      <div className="animate-bounce-in w-full max-w-[480px] rounded-[32px] border-4 border-cordy-ink bg-white p-6 text-center shadow-[0_30px_60px_rgba(22,33,62,0.22)] sm:rounded-[44px] sm:p-11">
        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-4 border-cordy-red bg-[#ffd28f] sm:h-24 sm:w-24">
          <Image
            src="/cordy-mascot.png"
            alt="CORDY"
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        </div>

        {title ? (
          <>
            <h1 className="font-heading mt-4 text-xl font-extrabold text-cordy-ink sm:text-2xl">
              You&apos;re invited to check out
            </h1>
            <p className="font-heading mt-2 text-lg font-bold text-cordy-red">{title}</p>
            {desc && <p className="mt-2 text-sm leading-relaxed text-cordy-ink/70">{desc}</p>}
          </>
        ) : (
          <h1 className="font-heading mt-4 text-xl font-extrabold text-cordy-ink sm:text-2xl">
            A friend thinks you&apos;d like CORDY
          </h1>
        )}

        <p className="mt-4 text-sm leading-relaxed text-cordy-ink/70">
          Chat with CORDY for a minute to build your own interest profile and see if this — or
          something even better suited to you — is a good fit.
        </p>

        <Link
          href="/intro"
          className="mt-6 inline-block w-full rounded-2xl border-2 border-cordy-ink bg-cordy-red px-8 py-3.5 text-center font-heading font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
        >
          Start your own CORDY profile →
        </Link>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteView />
    </Suspense>
  );
}
