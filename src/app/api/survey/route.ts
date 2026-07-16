import { NextResponse } from "next/server";
import { env } from "~/env";
import { checkCombinedRateLimit, clientIpFrom } from "~/lib/rateLimit";
import { ensureSessionCookie, readSessionId } from "~/lib/session";
import type { SurveyResponse } from "~/lib/surveySim";

// Generous but real limit — this endpoint is a one-shot submit per user,
// not a chat loop, but still shouldn't be spammable.
const SURVEY_RATE_LIMIT = 10;
const SURVEY_RATE_WINDOW_MS = 5 * 60 * 1000;

interface SurveyApiResponse {
  ok: boolean;
  message?: string;
}

function respond(request: Request, body: SurveyApiResponse, init?: ResponseInit): NextResponse<SurveyApiResponse> {
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

  let body: Omit<SurveyResponse, "submittedAt">;
  try {
    body = (await request.json()) as Omit<SurveyResponse, "submittedAt">;
  } catch {
    return respond(request, { ok: false, message: "Invalid request body" }, { status: 400 });
  }

  const record: SurveyResponse = { ...body, submittedAt: new Date().toISOString() };

  const airtableConfigured = env.AIRTABLE_PAT && env.AIRTABLE_BASE_ID && env.AIRTABLE_TABLE_ID;
  if (!airtableConfigured) {
    // No Airtable configured — log server-side so it's at least visible in
    // deployment logs during local/dev testing.
    console.log("[survey/route] Airtable not configured, response logged only:", record);
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
        body: JSON.stringify({
          records: [
            {
              fields: {
                profileId: record.profileId,
                overallRating: record.overallRating,
                vsBrowsing: record.vsBrowsing,
                wouldUseForReal: record.wouldUseForReal,
                questionsRelevant: record.questionsRelevant,
                matchQuality: record.matchQuality,
                nps: record.nps,
                likedTags: record.likedTags.join(", "),
                dislikedTags: record.dislikedTags.join(", "),
                likedMost: record.likedMost,
                wouldChange: record.wouldChange,
                submittedAt: record.submittedAt,
              },
            },
          ],
        }),
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
