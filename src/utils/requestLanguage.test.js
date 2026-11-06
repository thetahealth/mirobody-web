/**
 * The X-Language a request carries is the language the page is drawn in.
 *
 * A page opened as `/login?lang=en` in a Chinese browser kept its English
 * chrome after the first in-app navigation, but `getLanguage()` re-read the
 * now query-less url and fell back to the browser: the server was asked for
 * Chinese indicator names under an English page.
 */
import { describe, it, expect, afterEach, vi } from "vitest";

const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

describe("requestLanguage", () => {
  afterEach(() => vi.unstubAllGlobals());

  const start = async (url, nav) => {
    const location = { href: url };
    vi.stubGlobal("window", { location });
    vi.stubGlobal("navigator", { language: nav });
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());
    vi.resetModules();
    const i18n = (await import("i18next")).default;
    const mod = await import("./i18n.js");
    const { getLanguage } = await import("./index.js");
    mod.initializeI18n();
    return { location, i18n, getLanguage, requestLanguage: mod.requestLanguage };
  };

  it("keeps a ?lang= page's language after navigation drops the query", async () => {
    const { location, getLanguage, requestLanguage } = await start(
      "https://app.example/login?lang=en", "zh-CN");
    expect(requestLanguage()).toBe("en");
    location.href = "https://app.example/indicators";
    expect(getLanguage()).toBe("zh-CN"); // what the header used to say
    expect(requestLanguage()).toBe("en");
  });

  it("follows a language switch", async () => {
    const { i18n, requestLanguage } = await start("https://app.example/", "en-US");
    expect(requestLanguage()).toBe("en");
    await i18n.changeLanguage("ja");
    expect(requestLanguage()).toBe("ja");
  });
});
