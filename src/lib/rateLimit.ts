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
}

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the Map doesn't grow unbounded between cold
// starts on a long-lived instance.
function pruneStale(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) buckets.delete(key);
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
  if (buckets.size > 5000) pruneStale(now, windowMs);

  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
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
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
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
