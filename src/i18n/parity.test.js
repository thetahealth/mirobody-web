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

const BUNDLES = { en, "zh-CN": zhCn, "zh-TW": zhTw, ja };

describe("i18n bundles", () => {
  it("ships a bundle for every language the switcher offers", () => {
    expect(LANGUAGE_LIST.map((l) => l.code).sort()).toEqual(
      Object.keys(BUNDLES).sort(),
    );
  });

  it.each(Object.keys(BUNDLES).filter((code) => code !== "en"))(
    "%s translates every key en.json has",
    (code) => {
      const missing = Object.keys(en).filter((k) => !(k in BUNDLES[code]));
      expect(missing).toEqual([]);
    },
  );

  it.each(Object.keys(BUNDLES).filter((code) => code !== "en"))(
    "%s carries no key en.json has dropped",
    (code) => {
      const stale = Object.keys(BUNDLES[code]).filter((k) => !(k in en));
      expect(stale).toEqual([]);
    },
  );

  // A placeholder the translator dropped renders as the literal "{{date}}" or,
  // worse, as nothing — same class of silent damage, one file away.
  it.each(Object.keys(BUNDLES).filter((code) => code !== "en"))(
    "%s keeps every interpolation placeholder",
    (code) => {
      const vars = (s) => [...String(s).matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
      const wrong = Object.keys(en)
        .filter((k) => k in BUNDLES[code])
        .map((k) => [k, vars(en[k]), vars(BUNDLES[code][k])])
        .filter(([, a, b]) => a.join() !== b.join())
        .map(([k, a, b]) => `${k}: en has [${a}], ${code} has [${b}]`);
      expect(wrong).toEqual([]);
    },
  );
});
