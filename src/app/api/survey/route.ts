import { NextResponse } from "next/server";
import { env } from "~/env";
import { LIMITS } from "~/lib/apiLimits";
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

  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return respond(request, { ok: false, message: "Missing answers" }, { status: 400 });
  }

  // Sanitize before forwarding to Airtable: cap the number of fields, drop
  // anything that isn't a string/number/null (so arrays get joined and
  // objects/functions can't slip through), and truncate long values. This
  // bounds both storage abuse and cost, and prevents `meta` from being used
  // to spam arbitrary huge fields into a DB holding minors' data. Note:
  // Airtable rejects unknown field NAMES (422) rather than creating them,
  // and the table is text/number only (no select fields), so `typecast`
  // can only coerce values, not pollute the schema — but we still cap
  // aggressively as defense in depth.
  const rawEntries = [...Object.entries(body.meta ?? {}), ...Object.entries(body.answers)];
  const fields: Record<string, string | number> = {};
  let fieldCount = 0;
  for (const [key, value] of rawEntries) {
    if (fieldCount >= LIMITS.MAX_SURVEY_FIELDS) break;
    if (typeof key !== "string" || key.length === 0 || key.length > 200) continue;
    let out: string | number;
    if (Array.isArray(value)) {
      out = value.filter((v) => typeof v === "string").join(", ");
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out = value;
    } else if (typeof value === "string") {
      out = value;
    } else {
      continue; // drop booleans, objects, null, undefined
    }
    if (typeof out === "string" && out.length > LIMITS.MAX_SURVEY_VALUE_CHARS) {
      out = out.slice(0, LIMITS.MAX_SURVEY_VALUE_CHARS);
    }
    fields[key] = out;
    fieldCount++;
  }
  // submittedAt is set server-side and always wins over any client-sent copy.
  fields.submittedAt = new Date().toISOString();

  const airtableConfigured = env.AIRTABLE_PAT && env.AIRTABLE_BASE_ID && env.AIRTABLE_TABLE_ID;
  if (!airtableConfigured) {
    // Do NOT log field contents — they can include minors' name/school/answers.
    console.log("[survey/route] Airtable not configured; response accepted but not persisted.");
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
      // Log only the status, not the response body (which can echo submitted values).
      console.error("[survey/route] Airtable write failed with status", airtableRes.status);
      return respond(request, { ok: false, message: "Failed to save response" }, { status: 502 });
    }
  } catch (err) {
    console.error("[survey/route] Airtable write error:", err);
    return respond(request, { ok: false, message: "Failed to save response" }, { status: 502 });
  }

  return respond(request, { ok: true });
}
