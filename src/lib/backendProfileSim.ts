import { matchOpportunities } from "./opportunities";
import type { Message, OpportunityFilters, ProfileData } from "./types";

// ── Persistent backend-profile simulation ───────────────────────────────
// Stands in for a real backend user-profile record. A real backend would
// issue a stable profile id on account creation and accumulate an
// extensive profile (full transcript, tag history, confidence trend,
// matched opportunities) server-side. Here it's simulated with a
// localStorage-persisted id + record so repeat visits build on the same
// record instead of starting fresh, and the concept is inspectable via
// devtools/console.

const PROFILE_ID_KEY = "cordy_current_profile_id";

export function getOrCreateProfileId(): string {
  try {
    let id = localStorage.getItem(PROFILE_ID_KEY);
    if (!id) {
      id = "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(PROFILE_ID_KEY, id);
    }
    return id;
  } catch {
    return "p_local";
  }
}

export function persistBackendProfile(params: {
  profileId: string;
  tags: string[];
  filters?: OpportunityFilters;
  confidence: number;
  questionsAsked: number;
  messages: Message[];
}): void {
  try {
    const record = {
      profileId: params.profileId,
      updatedAt: new Date().toISOString(),
      tags: params.tags,
      filters: params.filters,
      confidence: params.confidence,
      turnsCompleted: params.questionsAsked,
      transcript: params.messages.map((m) => ({ role: m.role, text: m.content })),
      matchedOpportunities: params.filters
        ? matchOpportunities(params.filters).map((o) => o.title)
        : [],
    };
    localStorage.setItem("cordyProfile_" + params.profileId, JSON.stringify(record));
    console.log("[CORDY backend-profile simulation] extensive interest profile updated:", record);
  } catch {
    // storage unavailable — non-fatal
  }
}

export function buildPartialProfile(tags: string[], filters?: OpportunityFilters): ProfileData {
  const opportunities = filters ? matchOpportunities(filters, 4) : [];
  return {
    tags,
    summary:
      tags.length > 0
        ? "Here's what CORDY's picked up so far — keep chatting any time to sharpen this."
        : "No strong signals yet — that's okay! Chat with CORDY to build your profile.",
    opportunities,
    filters,
  };
}
