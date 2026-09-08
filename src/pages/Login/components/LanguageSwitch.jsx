import { useTranslation } from "react-i18next";

import { LANGUAGE_LIST } from "../../../enum/lang";
import { LANGUAGE } from "../../../enum/storage";
import styles from "./LanguageSwitch.module.scss";

/**
 * Language picker for the auth pages.
 *
 * Before this, language could only be changed from Settings — which is behind
 * the login. A visitor whose UI resolved to a language they do not read had no
 * way to fix it without signing in first.
 *
 * Writes the same `LANGUAGE` key `SettingModal` writes, so the choice survives
 * the redirect into the app and the two controls never disagree.
 *
 * A native `<select>` on purpose: the auth pages use plain elements + CSS
 * modules and pull in no component library, so this keeps antd out of the login
 * bundle and gets keyboard and screen-reader behaviour for free.
 *
 * Options stay in their own language (English / 简体中文 / 繁體中文 / 日本語).
 * Translating them would hide the option a reader is looking for behind a name
 * they cannot read.
 */
export default function LanguageSwitch() {
  const { i18n } = useTranslation();

  // `resolvedLanguage` is what i18next actually rendered — `language` can hold
  // a region form ("ja-JP") that matches no option and blanks the select.
  const current = i18n.resolvedLanguage || i18n.language;

  const onChange = (event) => {
    const code = event.target.value;
    i18n.changeLanguage(code);
    localStorage.setItem(LANGUAGE, code);
  };

  return (
    <div className={styles.wrap}>
      <select
        className={styles.select}
        value={current}
        onChange={onChange}
        aria-label="Language"
      >
        {LANGUAGE_LIST.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
