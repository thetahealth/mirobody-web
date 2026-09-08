import { describe, it, expect } from "vitest";
import {
  COOKIE_NAME,
  parseCookie,
  buildSetCookie,
  isAllowedRedirect,
} from "./sharedSession";

describe("sharedSession.parseCookie", () => {
  it("returns the value for a present cookie among many", () => {
    const jar = `foo=1; ${COOKIE_NAME}=abc.def.ghi; bar=2`;
    expect(parseCookie(jar, COOKIE_NAME)).toBe("abc.def.ghi");
  });

  it("returns null when the cookie is absent", () => {
    expect(parseCookie("foo=1; bar=2", COOKIE_NAME)).toBeNull();
  });

  it("returns null for empty / non-string jars", () => {
    expect(parseCookie("", COOKIE_NAME)).toBeNull();
    expect(parseCookie(undefined, COOKIE_NAME)).toBeNull();
  });

  it("url-decodes the stored value", () => {
    expect(parseCookie(`${COOKIE_NAME}=a%20b`, COOKIE_NAME)).toBe("a b");
  });

  it("does not match a cookie whose name is a prefix of another", () => {
    expect(parseCookie(`${COOKIE_NAME}_x=nope`, COOKIE_NAME)).toBeNull();
  });
});

describe("sharedSession.buildSetCookie", () => {
  it("encodes value and sets Path + SameSite=Lax + Secure by default", () => {
    const s = buildSetCookie(COOKIE_NAME, "tok en", { secure: true });
    expect(s).toContain(`${COOKIE_NAME}=tok%20en`);
    expect(s).toContain("Path=/");
    expect(s).toContain("SameSite=Lax");
    expect(s).toContain("Secure");
  });

  it("includes Domain when provided", () => {
    const s = buildSetCookie(COOKIE_NAME, "x", { domain: ".example.com" });
    expect(s).toContain("Domain=.example.com");
  });

  it("omits Domain when empty (host-only cookie)", () => {
    const s = buildSetCookie(COOKIE_NAME, "x", { domain: "" });
    expect(s).not.toContain("Domain=");
  });

  it("emits Max-Age=0 for clearing", () => {
    const s = buildSetCookie(COOKIE_NAME, "", { maxAge: 0 });
    expect(s).toContain("Max-Age=0");
  });
});

describe("sharedSession.isAllowedRedirect", () => {
  const SUFFIX = ".example.com";

  it("allows subdomains of the registrable domain", () => {
    expect(isAllowedRedirect("https://developer.example.com/x", SUFFIX)).toBe(
      true,
    );
    expect(isAllowedRedirect("https://app.example.com/", SUFFIX)).toBe(true);
  });

  it("allows the bare registrable domain itself", () => {
    expect(isAllowedRedirect("https://example.com/x", SUFFIX)).toBe(true);
  });

  it("allows localhost / 127.0.0.1 for local dev (any port)", () => {
    expect(isAllowedRedirect("http://localhost:5174/x", SUFFIX)).toBe(true);
    expect(isAllowedRedirect("http://localhost:5173/", SUFFIX)).toBe(true);
    expect(isAllowedRedirect("http://127.0.0.1:5174/x", SUFFIX)).toBe(true);
  });

  it("does not treat suffixed-localhost spoofs as local", () => {
    expect(isAllowedRedirect("https://localhost.evil.com/x", SUFFIX)).toBe(
      false,
    );
    expect(isAllowedRedirect("https://notlocalhost/x", SUFFIX)).toBe(false);
  });

  it("rejects foreign hosts", () => {
    expect(isAllowedRedirect("https://evil.com/x", SUFFIX)).toBe(false);
  });

  it("rejects suffix-spoofing hosts (no dot boundary)", () => {
    expect(isAllowedRedirect("https://evilexample.com/x", SUFFIX)).toBe(false);
    expect(isAllowedRedirect("https://example.com.evil.com/x", SUFFIX)).toBe(
      false,
    );
  });

  it("rejects relative, protocol-relative, and javascript: urls", () => {
    expect(isAllowedRedirect("/x", SUFFIX)).toBe(false);
    expect(isAllowedRedirect("//evil.com", SUFFIX)).toBe(false);
    expect(isAllowedRedirect("javascript:alert(1)", SUFFIX)).toBe(false);
  });

  it("rejects credential-embedding tricks", () => {
    expect(isAllowedRedirect("https://example.com@evil.com/x", SUFFIX)).toBe(
      false,
    );
  });

  it("rejects empty / non-string input", () => {
    expect(isAllowedRedirect("", SUFFIX)).toBe(false);
    expect(isAllowedRedirect(null, SUFFIX)).toBe(false);
  });

  // The default when no shared domain is configured. `"".endsWith("")` is true
  // for every host, so without a short-circuit an unconfigured install would
  // accept any redirect target at all.
  it("rejects every remote host when no suffix is configured", () => {
    expect(isAllowedRedirect("https://evil.com/x", "")).toBe(false);
    expect(isAllowedRedirect("https://example.com/x", "")).toBe(false);
    expect(isAllowedRedirect("http://localhost:5173/", "")).toBe(true);
  });
});
