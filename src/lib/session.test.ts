import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { ensureSessionCookie, readSessionId } from "./session";

describe("readSessionId", () => {
  it("reads the cordy_sid cookie value", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "other=1; cordy_sid=abc-123; another=2" },
    });
    expect(readSessionId(request)).toBe("abc-123");
  });

  it("returns null when there's no cookie header", () => {
    expect(readSessionId(new Request("http://localhost/"))).toBeNull();
  });

  it("returns null when the cookie header doesn't include cordy_sid", () => {
    const request = new Request("http://localhost/", { headers: { cookie: "other=1" } });
    expect(readSessionId(request)).toBeNull();
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
      headers: { cookie: "cordy_sid=existing-id" },
    });
    const res = NextResponse.json({ ok: true });
    const sid = ensureSessionCookie(request, res);

    expect(sid).toBe("existing-id");
    expect(res.cookies.get("cordy_sid")).toBeUndefined();
  });
});
