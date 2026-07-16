import { NextResponse } from "next/server";
import { env } from "~/env";
import { checkCombinedRateLimit, clientIpFrom } from "~/lib/rateLimit";
import { ensureSessionCookie, readSessionId } from "~/lib/session";
import type { SurveyAnswers } from "~/lib/survey/types";

// ── Generic survey-submission endpoint ───────────────────────────────────
// Deliberately has no CORDY-specific field names in it — the request body
// carries `meta` + `answers`, both plain key/value objects, and every key
// becomes an Airtable field name it's written to as-is. To reuse this for
// a different survey (a different product, a different question set),
// nothing here needs to change — just point AIRTABLE_BASE_ID/
// AIRTABLE_TABLE_ID at a different base/table whose columns match your new
// question ids, same as SurveyModuleConfig.questions[].id does on the
// client (see src/components/SurveyForm.tsx).

const SURVEY_RATE_LIMIT = 10;
const SURVEY_RATE_WINDOW_MS = 5 * 60 * 1000;

interface SurveySubmitBody {
  meta?: Record<string, string>;
  answers: SurveyAnswers;
}

interface SurveyApiResponse {
  ok: boolean;
  message?: string;
}

function respond(
  request: Request,
  body: SurveyApiResponse,
  init?: ResponseInit,
): NextResponse<SurveyApiResponse> {
  const res = NextResponse.json(body, init);
  ensureSessionCookie(request, res);
  return res;
}

export async function POST(request: Request): Promise<NextResponse<SurveyApiResponse>> {
  const { allowed, retryAfterSeconds } = checkCombinedRateLimit(
    clientIpFrom(request),
    readSessionId(request),
    SURVEY_RATE_LIMIT,
    SURVEY_RATE_WINDOW_MS,
  );
  if (!allowed) {
    return respond(
      request,
      { ok: false, message: "Too many submissions — try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  let body: SurveySubmitBody;
  try {
    body = (await request.json()) as SurveySubmitBody;
  } catch {
    return respond(request, { ok: false, message: "Invalid request body" }, { status: 400 });
  }

  if (!body.answers || typeof body.answers !== "object") {
    return respond(request, { ok: false, message: "Missing answers" }, { status: 400 });
  }

  // Airtable's Long text fields want a plain string, not an array — join
  // any multi-choice answers before sending.
  const flatAnswers: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(body.answers)) {
    flatAnswers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  const fields = { ...body.meta, ...flatAnswers, submittedAt: new Date().toISOString() };

  const airtableConfigured = env.AIRTABLE_PAT && env.AIRTABLE_BASE_ID && env.AIRTABLE_TABLE_ID;
  if (!airtableConfigured) {
    console.log("[survey/route] Airtable not configured, response logged only:", fields);
    return respond(request, { ok: true });
  }

  try {
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }], typecast: true }),
      },
    );

    if (!airtableRes.ok) {
      const errText = await airtableRes.text();
      console.error("[survey/route] Airtable write failed:", airtableRes.status, errText);
      return respond(request, { ok: false, message: "Failed to save response" }, { status: 502 });
    }
  } catch (err) {
    console.error("[survey/route] Airtable write error:", err);
    return respond(request, { ok: false, message: "Failed to save response" }, { status: 502 });
  }

  return respond(request, { ok: true });
}
