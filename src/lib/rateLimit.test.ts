import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, clientIpFrom } from "./rateLimit";

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
