"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function IntroPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cordy-cream px-4 py-8 sm:px-6 sm:py-12">
      <div className="animate-bounce-in w-full max-w-[520px] rounded-[32px] border-4 border-cordy-ink bg-white p-6 text-center shadow-[0_30px_60px_rgba(22,33,62,0.22)] sm:rounded-[44px] sm:p-11">
        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-4 border-cordy-red bg-[#ffd28f] sm:mb-5 sm:h-24 sm:w-24">
          <Image
            src="/cordy-mascot.png"
            alt="CORDY"
            width={96}
            height={96}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        <h1 className="font-heading text-xl font-extrabold text-cordy-ink sm:text-2xl">
          Let&apos;s find your thing
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-cordy-ink/70">
          CORDY will ask a few quick questions — tap or type, whatever&apos;s easier. Takes about a
          minute.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-2xl border-2 border-[#f0ddb3] bg-[#fff3da] px-3 py-1.5 text-xs font-semibold text-[#8a5a1f]">
            ⏱ ~1 min
          </span>
          <span className="rounded-2xl border-2 border-[#f0ddb3] bg-[#fff3da] px-3 py-1.5 text-xs font-semibold text-[#8a5a1f]">
            💬 A few quick questions
          </span>
        </div>
        <button
          onClick={() => router.push("/mcq")}
          className="mt-6 w-full rounded-2xl border-2 border-cordy-ink bg-cordy-red py-3.5 font-heading text-base font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 sm:mt-7"
        >
          Let&apos;s go →
        </button>
      </div>
    </div>
  );
}
