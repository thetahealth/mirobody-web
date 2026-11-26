/**
 * Every shipped language carries every key English carries.
 *
 * i18next is configured with `fallbackLng: en`, so a key missing from a
 * language does not throw, does not log and does not render the key name — it
 * silently renders the ENGLISH sentence inside an otherwise translated page.
 * Nothing in lint, test or build notices.
 *
 * That is not hypothetical. The report-date feature (#53) shipped 20 keys into
 * `en.json` and `zh-cn.json` only, and reached the published bundle that way:
 * a 繁體中文 or 日本語 user uploading a report with no date on it read
 * "Keep the upload day" and "12 readings moved to 2026-08-20" in the middle of
 * their own language.
 *
 * `LANGUAGE_LIST` is the authority on which files must keep up — adding a
 * language to the switcher without its bundle is the same bug, so the list
 * drives the table rather than a hardcoded set of filenames.
 */
import { describe, it, expect } from "vitest";
import i18next from "i18next";

import { LANGUAGE_LIST } from "../enum/lang.js";
import en from "./en.json";
import zhCn from "./zh-cn.json";
import zhTw from "./zh-tw.json";
import ja from "./ja.json";
import ru from "./ru.json";

const BUNDLES = { en, "zh-CN": zhCn, "zh-TW": zhTw, ja, ru };

const flatten = (bundle, prefix = "", result = {}) => {
  Object.entries(bundle).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, path, result);
    } else {
      result[path] = value;
    }
  });
  return result;
};

const ENGLISH_STRINGS = flatten(en);

// The count strings: English keys with both a `_one` and an `_other` form.
// A lone `_other` (`gender_other`) is a choice named "other", not a plural.
const PLURAL_BASES = Object.keys(ENGLISH_STRINGS)
  .filter((path) => path.endsWith("_one") && `${path.slice(0, -4)}_other` in ENGLISH_STRINGS)
  .map((path) => path.slice(0, -4));
const pluralCategories = (code) => new Intl.PluralRules(code).resolvedOptions().pluralCategories;
const INTERPOLATION_TOKENS = /{{\s*[^{}]+\s*}}|<\/?\d+>|%(?:\d+\$)?[sdif]|\$\{[^}]+\}/g;
const tokens = (value) => [...String(value).matchAll(INTERPOLATION_TOKENS)].map((m) => m[0]).sort();
const RU_UNCHANGED_ALLOWLIST = new Set([
  "nav_github", // Product name
  "url", // Standard technical label
  "health_drive_for", // Interpolation-only rich text
  "source_kind_api", // API is the established Russian technical abbreviation
  "setup_local_os_mac", // Product name
  "setup_local_os_windows", // Product name
]);

describe("i18n bundles", () => {
  it("ships a bundle for every language the switcher offers", () => {
    expect(LANGUAGE_LIST.map((l) => l.code).sort()).toEqual(
      Object.keys(BUNDLES).sort(),
    );
  });

  it.each(Object.keys(BUNDLES).filter((code) => code !== "en"))(
    "%s has the same nested string paths as en.json",
    (code) => {
      const translated = flatten(BUNDLES[code]);
      const expected = new Set(Object.keys(ENGLISH_STRINGS));
      // A count string carries a form per plural category of ITS language,
      // which English's one/other does not cover (Russian adds few and many).
      for (const base of PLURAL_BASES) {
        for (const category of pluralCategories(code)) expected.add(`${base}_${category}`);
      }
      expect(Object.keys(translated).sort()).toEqual([...expected].sort());
    },
  );

  // i18next picks a count string's form by the language's own plural rules
  // and falls back to English for a form the bundle lacks: Russian shipped
  // with only _one and _other, so "Размышление: 17 сек." rendered as
  // "Thought for 17 seconds · 5 steps" (17 and 5 are `many` in Russian).
  it("renders Russian counts in Russian, never the English fallback", async () => {
    const t = await i18next.createInstance().init({
      lng: "ru",
      fallbackLng: "en",
      resources: { en: { translation: en }, ru: { translation: ru } },
    });
    expect([1, 2, 5, 17].map((count) => t("process_steps", { count }))).toEqual([
      "1 шаг", "2 шага", "5 шагов", "17 шагов",
    ]);
    expect(t("process_thought_for", { count: 17 })).toBe("Размышление: 17 сек.");
  });

  it.each(Object.keys(BUNDLES).filter((code) => code !== "en"))(
    "%s has every plural form its language uses",
    (code) => {
      const translated = flatten(BUNDLES[code]);
      const missing = PLURAL_BASES.flatMap((base) =>
        pluralCategories(code).map((category) => `${base}_${category}`),
      ).filter((path) => !(path in translated));
      expect(missing).toEqual([]);
    },
  );

  // A placeholder the translator dropped renders as the literal "{{date}}" or,
  // worse, as nothing — same class of silent damage, one file away.
  it.each(Object.keys(BUNDLES).filter((code) => code !== "en"))(
    "%s keeps every interpolation placeholder",
    (code) => {
      const translated = flatten(BUNDLES[code]);
      const wrong = Object.keys(ENGLISH_STRINGS)
        .map((path) => [path, tokens(ENGLISH_STRINGS[path]), tokens(translated[path])])
        .filter(([, sourceTokens, translatedTokens]) =>
          sourceTokens.join() !== translatedTokens.join(),
        )
        .map(([path, sourceTokens, translatedTokens]) =>
          `${path}: en has [${sourceTokens}], ${code} has [${translatedTokens}]`,
        );
      expect(wrong).toEqual([]);
    },
  );

  it.each(Object.keys(BUNDLES).filter((code) => code !== "en"))(
    "%s translates every string value",
    (code) => {
      const translated = flatten(BUNDLES[code]);
      const invalid = Object.entries(translated)
        .filter(([, value]) => typeof value !== "string")
        .map(([path]) => path);
      expect(invalid).toEqual([]);
    },
  );

  it("ru translates every user-facing English string", () => {
    const russian = flatten(ru);
    const unchanged = Object.keys(ENGLISH_STRINGS).filter(
      (path) =>
        ENGLISH_STRINGS[path] &&
        ENGLISH_STRINGS[path] === russian[path] &&
        !RU_UNCHANGED_ALLOWLIST.has(path),
    );
    expect(unchanged).toEqual([]);
  });
});
