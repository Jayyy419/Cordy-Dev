// ── Funnel analytics (client) ────────────────────────────────────────────
// Fire-and-forget funnel instrumentation. Without this the only people we
// learn anything about are the ones who finish the whole flow AND fill in
// the survey — which tells us nothing about where everyone else dropped
// out. Each call records one step reached, keyed by the same anonymous
// profileId the survey uses, so the two tables join.
//
// Deliberately best-effort: analytics must never block, slow, or break the
// actual user journey, so every failure is swallowed and `keepalive` lets
// the request survive the page navigation that usually triggers it.

import { getOrCreateProfileId } from "./backendProfileSim";

export type FunnelEvent =
  | "landed"
  | "started_mcq"
  | "started_chat"
  | "completed_chat"
  | "skipped_to_results"
  | "viewed_profile"
  | "compared_real_cordy"
  | "rejected_tag"
  | "started_survey"
  | "completed_survey";

/** Events that should only ever be recorded once per browser, per funnel run. */
const ONCE_PER_SESSION: ReadonlySet<FunnelEvent> = new Set<FunnelEvent>([
  "landed",
  "started_mcq",
  "started_chat",
  "completed_chat",
  "viewed_profile",
  "started_survey",
  "completed_survey",
]);

const SENT_KEY = "cordy_funnel_sent";

function alreadySent(event: FunnelEvent): boolean {
  try {
    const raw = sessionStorage.getItem(SENT_KEY);
    const sent = raw ? (JSON.parse(raw) as string[]) : [];
    if (sent.includes(event)) return true;
    sent.push(event);
    sessionStorage.setItem(SENT_KEY, JSON.stringify(sent));
    return false;
  } catch {
    return false; // storage unavailable — send it, a duplicate is better than a hole
  }
}

export function trackEvent(event: FunnelEvent, detail?: string): void {
  if (typeof window === "undefined") return;
  if (ONCE_PER_SESSION.has(event) && alreadySent(event)) return;

  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: getOrCreateProfileId(), event, detail }),
      keepalive: true,
    }).catch(() => {
      // Analytics is never allowed to surface an error to the user.
    });
  } catch {
    // ignore
  }
}
