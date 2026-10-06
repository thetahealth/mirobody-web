import { describe, expect, it } from "vitest";

import { inAppPath, loginReturningTo } from "./returnPath";

describe("inAppPath", () => {
  it("returns a path on this origin, with its query and hash", () => {
    expect(inAppPath("/setup")).toBe("/setup");
    expect(inAppPath("/data?tab=files#top")).toBe("/data?tab=files#top");
    expect(inAppPath("/ask/abc-123")).toBe("/ask/abc-123");
  });

  it("refuses what a browser reads as another host", () => {
    expect(inAppPath("//evil.com/x")).toBe("");
    expect(inAppPath("/\\evil.com/x")).toBe("");
    // The URL parser strips tabs and newlines, which makes this `//evil.com`.
    expect(inAppPath("/\t/evil.com")).toBe("");
    expect(inAppPath("/\n/evil.com")).toBe("");
  });

  it("refuses absolute URLs, which isAllowedRedirect handles", () => {
    expect(inAppPath("https://evil.com/setup")).toBe("");
    expect(inAppPath("http://localhost:5173/setup")).toBe("");
    expect(inAppPath("javascript:alert(1)")).toBe("");
  });

  it("refuses the sign-in pages themselves", () => {
    expect(inAppPath("/login")).toBe("");
    expect(inAppPath("/login?redirect=/login")).toBe("");
    expect(inAppPath("/mcplogin")).toBe("");
  });

  it("refuses nothing, a relative path and a non-string", () => {
    expect(inAppPath(null)).toBe("");
    expect(inAppPath("")).toBe("");
    expect(inAppPath("setup")).toBe("");
    expect(inAppPath(["/setup"])).toBe("");
  });
});

describe("loginReturningTo", () => {
  it("round-trips through the query string to the same path", () => {
    const url = new URL(loginReturningTo("/setup"), "http://app.test");
    expect(url.pathname).toBe("/login");
    expect(inAppPath(url.searchParams.get("redirect"))).toBe("/setup");
  });
});
