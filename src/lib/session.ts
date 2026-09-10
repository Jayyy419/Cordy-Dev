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

/** Ids we issue are randomUUID() output; anything else was made up by a caller. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;

  // httpOnly stops page JS writing this, but any HTTP client can send an
  // arbitrary value, and it goes straight into the rate limiter as a Map key.
  // Accepting only the UUID shape we issue means a caller can't mint unbounded
  // distinct keys (or one enormous one) to grow that map.
  const value = match.slice(SESSION_COOKIE.length + 1);
  return UUID_RE.test(value) ? value : null;
}

/** Attaches a session cookie to `response` if the request didn't already have one. Returns the id in use either way. */
export function ensureSessionCookie(request: Request, response: NextResponse): string {
  const existing = readSessionId(request);
  if (existing) return existing;

  const sid = randomUUID();
  response.cookies.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    // The site is HTTPS-only in every deployed environment; without this the
    // cookie would still be sent over a plaintext connection if one occurred.
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return sid;
}
