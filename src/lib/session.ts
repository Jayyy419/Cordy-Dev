import { randomUUID } from "crypto";
import type { NextResponse } from "next/server";

// ── Anonymous session cookie ─────────────────────────────────────────────
// A second rate-limit key alongside IP (see rateLimit.ts): an httpOnly
// random id, not readable/writable by client JS, so it survives a page
// refresh or a cleared localStorage — the previous rate-limit bypass. It's
// still a soft mitigation, not a hard one: clearing cookies (or a fresh
// real account once auth exists) legitimately gets a new id. The point is
// raising the bar from "reload the tab" to "clear cookies and/or rotate
// IP" — actual protection against many real accounts has to live at the
// signup step itself (verification, CAPTCHA, per-IP signup limits) once
// real accounts exist.

const SESSION_COOKIE = "cordy_sid";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function readSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return match ? match.slice(SESSION_COOKIE.length + 1) : null;
}

/** Attaches a session cookie to `response` if the request didn't already have one. Returns the id in use either way. */
export function ensureSessionCookie(request: Request, response: NextResponse): string {
  const existing = readSessionId(request);
  if (existing) return existing;

  const sid = randomUUID();
  response.cookies.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return sid;
}
