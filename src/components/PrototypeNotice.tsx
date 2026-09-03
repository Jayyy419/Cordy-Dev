// ── Prototype notice ─────────────────────────────────────────────────────
// This app is a testbed for interest-profiling ideas, not Cordy's real
// product, and every opportunity in it is invented. Testers (and the parents
// they share a profile with) have no way to know that from the UI alone —
// the branding deliberately mirrors cordy.sg — so it has to be said plainly
// wherever someone could mistake the content for real programmes they could
// actually sign up for.
//
// Two variants so the wording matches the risk at each spot:
//   "full"    — the landing page, where the whole app needs framing.
//   "compact" — inline above a list of opportunities, where the specific
//               risk is believing a listed programme exists.

const REAL_CORDY_URL = "https://cordy.sg";

export function PrototypeNotice({ variant = "full" }: { variant?: "full" | "compact" }) {
  if (variant === "compact") {
    return (
      <p className="mt-1 mb-3.5 rounded-xl border-2 border-cordy-ink/15 bg-cordy-cream px-3 py-2 text-xs leading-relaxed text-cordy-ink/70">
        <span className="font-bold text-cordy-ink">⚠️ These are made-up examples.</span> This is a
        prototype, and the programmes below are mock data written to test the matching — they
        aren&apos;t real opportunities and you can&apos;t sign up for them. For the real thing, visit{" "}
        <a
          href={REAL_CORDY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-cordy-red underline"
        >
          cordy.sg
        </a>
        .
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border-2 border-cordy-ink bg-white px-4 py-3 text-left text-xs leading-relaxed text-cordy-ink/75">
      <p className="font-heading text-sm font-bold text-cordy-ink">⚠️ This is a prototype</p>
      <p className="mt-1">
        It isn&apos;t the real Cordy — it&apos;s a test of some new interest-profiling ideas, and{" "}
        <strong className="font-semibold text-cordy-ink">
          every opportunity shown is mock data
        </strong>
        , invented to try out the matching. Nothing here is a real programme you can join. The
        actual Cordy lives at{" "}
        <a
          href={REAL_CORDY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-cordy-red underline"
        >
          cordy.sg
        </a>
        .
      </p>
    </div>
  );
}
