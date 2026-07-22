// ── Rate limiting (placeholder) ─────────────────────────────────────────
// PLACEHOLDER — an in-memory fixed-window limiter keyed by client IP. This
// protects the Anthropic key from unauthenticated abuse (unlimited fresh
// sessions, not just long ones — MAX_QUESTIONS in prompts.ts caps cost
// *within* one conversation, but nothing stops someone spinning up new
// conversations in a loop). In-memory state doesn't survive a serverless
// cold start and isn't shared across instances/regions, so it's a soft
// limit, not a hard guarantee — swap for a real store (Upstash Redis,
// Vercel KV, or rate limiting on real authenticated users) once the real
// backend exists.

interface Bucket {
  count: number;
  windowStart: number;
  windowMs: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the Map doesn't grow unbounded between cold
// starts on a long-lived instance. Prunes each bucket against ITS OWN
// window, not the caller's — different routes use different windows, so
// pruning chat's 5-min buckets with the survey route's window would reset
// live counters (a limit-bypass exactly under load).
function pruneStale(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > bucket.windowMs) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 5000) pruneStale(now);

  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now, windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.ceil((existing.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIpFrom(request: Request): string {
  // On Vercel, `x-real-ip` is set by the edge to the true connecting IP and
  // cannot be overridden by the client, so it's the trustworthy key. The
  // LEFT-most `x-forwarded-for` value is client-supplied and trivially
  // spoofed (send a random IP per request → fresh rate-limit bucket every
  // time), so we must NOT trust it. Fall back to the RIGHT-most XFF hop (the
  // one appended by the trusted proxy nearest us) only when x-real-ip is
  // absent (e.g. local dev), and to a single shared "unknown" bucket as a
  // last resort so header-less clients are collectively limited, not exempt.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1]!;
  }
  return "unknown";
}

// ── Combined IP + session check ─────────────────────────────────────────
// Requires the request to pass BOTH independent buckets. Clearing cookies
// alone still falls back to the IP bucket (already consumed by the same
// browser); switching IP (VPN, mobile network) alone still falls back to
// the session-cookie bucket. Defeating both at once is the realistic
// ceiling of any anonymous-only mitigation — see session.ts for why a real
// fix requires per-authenticated-user limiting once accounts exist.

export function checkCombinedRateLimit(
  ip: string,
  sessionId: string | null,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const ipResult = checkRateLimit(`ip:${ip}`, limit, windowMs);
  const sessionResult = sessionId
    ? checkRateLimit(`sid:${sessionId}`, limit, windowMs)
    : { allowed: true, retryAfterSeconds: 0 };

  return {
    allowed: ipResult.allowed && sessionResult.allowed,
    retryAfterSeconds: Math.max(ipResult.retryAfterSeconds, sessionResult.retryAfterSeconds),
  };
}
