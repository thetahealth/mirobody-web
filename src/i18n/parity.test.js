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
      expect(Object.keys(translated).sort()).toEqual(Object.keys(ENGLISH_STRINGS).sort());
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
