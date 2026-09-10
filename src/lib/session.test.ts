import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { ensureSessionCookie, readSessionId } from "./session";

describe("readSessionId", () => {
  it("reads the cordy_sid cookie value", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "other=1; cordy_sid=3f2504e0-4f89-41d3-9a0c-0305e82c3301; another=2" },
    });
    expect(readSessionId(request)).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });

  it("returns null when there's no cookie header", () => {
    expect(readSessionId(new Request("http://localhost/"))).toBeNull();
  });

  it("returns null when the cookie header doesn't include cordy_sid", () => {
    const request = new Request("http://localhost/", { headers: { cookie: "other=1" } });
    expect(readSessionId(request)).toBeNull();
  });

  // The value is attacker-controlled: the cookie is httpOnly so page JS can't
  // set it, but any HTTP client can send whatever it likes. It's used directly
  // as a rate-limiter Map key, so an unbounded/arbitrary value is a memory
  // growth vector — reject anything that isn't a UUID we issued.
  it("rejects a session id that isn't a UUID", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "cordy_sid=not-a-uuid" },
    });
    expect(readSessionId(request)).toBeNull();
  });

  it("rejects an absurdly long session id", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: `cordy_sid=${"a".repeat(10000)}` },
    });
    expect(readSessionId(request)).toBeNull();
  });

  it("accepts a well-formed UUID", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "cordy_sid=3f2504e0-4f89-41d3-9a0c-0305e82c3301" },
    });
    expect(readSessionId(request)).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });
});

describe("ensureSessionCookie", () => {
  it("sets a new cookie when the request has none", () => {
    const request = new Request("http://localhost/");
    const res = NextResponse.json({ ok: true });
    const sid = ensureSessionCookie(request, res);

    expect(sid).toBeTruthy();
    expect(res.cookies.get("cordy_sid")?.value).toBe(sid);
  });

  it("reuses the existing id and doesn't overwrite the cookie", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "cordy_sid=3f2504e0-4f89-41d3-9a0c-0305e82c3301" },
    });
    const res = NextResponse.json({ ok: true });
    const sid = ensureSessionCookie(request, res);

    expect(sid).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    expect(res.cookies.get("cordy_sid")).toBeUndefined();
  });

  it("marks the cookie secure and httpOnly", () => {
    const res = NextResponse.json({ ok: true });
    ensureSessionCookie(new Request("http://localhost/"), res);
    const cookie = res.cookies.get("cordy_sid");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
  });
});
