/**
 * Browser tag -> shipped language code.
 *
 * `getLanguage()` returned `navigator.language` verbatim. That was invisible
 * while zh-CN was the only non-English bundle — every other tag fell back to
 * English, which was also the right answer. With 繁體中文 and 日本語 shipping,
 * `ja-JP` falling back to English is a bug a Japanese visitor sees immediately.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

describe("getLanguage", () => {
  let getLanguage;

  const load = async ({ url = "https://app.example/", nav = "en-US" } = {}) => {
    vi.stubGlobal("window", { location: { href: url } });
    vi.stubGlobal("navigator", { language: nav });
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());
    vi.resetModules();
    ({ getLanguage } = await import("./index.js"));
    return getLanguage();
  };

  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["ja-JP", "ja"],
    ["ja", "ja"],
    ["en-GB", "en"],
    ["zh-CN", "zh-CN"],
    ["zh-SG", "zh-CN"],
    ["zh-Hans-CN", "zh-CN"],
    ["zh-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["zh-MO", "zh-TW"],
    ["zh-Hant-TW", "zh-TW"],
    ["zh-Hant", "zh-TW"],
  ])("maps browser %s to %s", async (nav, expected) => {
    expect(await load({ nav })).toBe(expected);
  });

  it("falls back to English for a language we do not ship", async () => {
    expect(await load({ nav: "fi-FI" })).toBe("en");
  });

  it("honours ?lang= even when spelled with a region or script", async () => {
    expect(await load({ url: "https://app.example/?lang=ja-JP", nav: "en-US" })).toBe("ja");
    expect(await load({ url: "https://app.example/?lang=zh-Hant", nav: "en-US" })).toBe("zh-TW");
  });

  it("prefers script over region when both are present", async () => {
    // A Simplified-script tag with a Traditional region is contradictory; the
    // explicit script subtag is the one the user or their OS actually set.
    expect(await load({ nav: "zh-Hans-TW" })).toBe("zh-CN");
  });
});
