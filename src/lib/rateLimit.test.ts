import { describe, expect, it, vi } from "vitest";
import { checkCombinedRateLimit, checkRateLimit, clientIpFrom } from "./rateLimit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks the request once the limit is exceeded", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    const result = checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 1000);
    expect(checkRateLimit(key, 3, 1000).allowed).toBe(false);

    vi.advanceTimersByTime(1100);
    expect(checkRateLimit(key, 3, 1000).allowed).toBe(true);
    vi.useRealTimers();
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-${crypto.randomUUID()}`;
    const keyB = `test-${crypto.randomUUID()}`;
    checkRateLimit(keyA, 1, 60_000);
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });
});

describe("checkCombinedRateLimit", () => {
  it("blocks once the IP bucket alone is exhausted, even with a fresh session", () => {
    const ip = `ip-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) checkCombinedRateLimit(ip, `sid-${i}`, 3, 60_000);
    // Same IP, brand-new session id each time (simulates clearing cookies) — still blocked.
    const result = checkCombinedRateLimit(ip, `sid-new-${crypto.randomUUID()}`, 3, 60_000);
    expect(result.allowed).toBe(false);
  });

  it("blocks once the session bucket alone is exhausted, even with a fresh IP", () => {
    const sid = `sid-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) checkCombinedRateLimit(`ip-${i}`, sid, 3, 60_000);
    // Same session, brand-new IP each time (simulates switching networks/VPN) — still blocked.
    const result = checkCombinedRateLimit(`ip-new-${crypto.randomUUID()}`, sid, 3, 60_000);
    expect(result.allowed).toBe(false);
  });

  it("allows the request when both a fresh IP and a fresh session are used", () => {
    const result = checkCombinedRateLimit(
      `ip-${crypto.randomUUID()}`,
      `sid-${crypto.randomUUID()}`,
      3,
      60_000,
    );
    expect(result.allowed).toBe(true);
  });

  it("only checks the IP bucket when there's no session id yet", () => {
    const ip = `ip-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) checkCombinedRateLimit(ip, null, 3, 60_000);
    expect(checkCombinedRateLimit(ip, null, 3, 60_000).allowed).toBe(false);
  });
});

describe("clientIpFrom", () => {
  it("reads the first address from x-forwarded-for", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(clientIpFrom(request)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(clientIpFrom(request)).toBe("203.0.113.9");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const request = new Request("http://localhost/");
    expect(clientIpFrom(request)).toBe("unknown");
  });
});
