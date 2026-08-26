import { NextResponse } from "next/server";
import { env } from "~/env";
import { checkCombinedRateLimit, clientIpFrom } from "~/lib/rateLimit";
import { ensureSessionCookie, readSessionId } from "~/lib/session";

// ── Funnel event ingestion ───────────────────────────────────────────────
// Records one anonymous funnel step per call into the Funnel Events table,
// so drop-off between landing and survey completion is measurable. Carries
// no PII: an anonymous profileId, the step name, and an optional short
// detail string. Timestamps are always set server-side.

// Generous compared to the chat/survey limits — a single genuine run through
// the funnel legitimately fires ~8 of these, and they cost nothing but an
// Airtable row.
const EVENTS_RATE_LIMIT = 60;
const EVENTS_RATE_WINDOW_MS = 5 * 60 * 1000;

const ALLOWED_EVENTS = new Set([
  "landed",
  "started_mcq",
  "started_chat",
  "completed_chat",
  "skipped_to_results",
  "viewed_profile",
  "compared_real_cordy",
  "rejected_tag",
  "started_survey",
  "completed_survey",
]);

const MAX_PROFILE_ID_CHARS = 100;
const MAX_DETAIL_CHARS = 200;

interface EventBody {
  profileId?: unknown;
  event?: unknown;
  detail?: unknown;
}

interface EventApiResponse {
  ok: boolean;
}

function respond(
  request: Request,
  body: EventApiResponse,
  init?: ResponseInit,
): NextResponse<EventApiResponse> {
  const res = NextResponse.json(body, init);
  ensureSessionCookie(request, res);
  return res;
}

export async function POST(request: Request): Promise<NextResponse<EventApiResponse>> {
  const { allowed } = checkCombinedRateLimit(
    clientIpFrom(request),
    readSessionId(request),
    EVENTS_RATE_LIMIT,
    EVENTS_RATE_WINDOW_MS,
  );
  // Analytics is not worth a retry storm — drop silently over the limit and
  // still report ok so the client never surfaces anything to the user.
  if (!allowed) return respond(request, { ok: true });

  let body: EventBody;
  try {
    body = (await request.json()) as EventBody;
  } catch {
    return respond(request, { ok: false }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!ALLOWED_EVENTS.has(event)) {
    return respond(request, { ok: false }, { status: 400 });
  }

  const profileId =
    typeof body.profileId === "string" ? body.profileId.slice(0, MAX_PROFILE_ID_CHARS) : "unknown";
  const detail =
    typeof body.detail === "string" ? body.detail.slice(0, MAX_DETAIL_CHARS) : undefined;

  const configured =
    env.AIRTABLE_PAT && env.AIRTABLE_BASE_ID && env.AIRTABLE_EVENTS_TABLE_ID;
  if (!configured) {
    // Local dev without Airtable — accept and move on, don't log the payload.
    return respond(request, { ok: true });
  }

  const fields: Record<string, string> = {
    profileId,
    event,
    at: new Date().toISOString(),
  };
  if (detail) fields.detail = detail;

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_EVENTS_TABLE_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }], typecast: true }),
      },
    );
    if (!res.ok) {
      console.error("[events/route] Airtable write failed with status", res.status);
    }
  } catch (err) {
    console.error("[events/route] Airtable write error:", err);
  }

  // Always ok — a failed analytics write is never the user's problem.
  return respond(request, { ok: true });
}
