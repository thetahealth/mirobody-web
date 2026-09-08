import { useTranslation } from "react-i18next";

import styles from "./AuthModeTabs.module.scss";

/**
 * Which way in: password, sign-up, or emailed code.
 *
 * Password comes first because it is the one that works everywhere. The code
 * route needs Mandrill or SMTP, and a deployment someone cloned to try out has
 * neither — leading with it means the first button a newcomer presses answers
 * `No SMTP server configured.`
 *
 * Real `<button>`s in a `tablist`, so arrow keys and screen readers behave
 * without re-implementing either.
 */
export default function AuthModeTabs({ mode, onChange }) {
  const { t } = useTranslation();

  const modes = [
    ["password", t("sign_in")],
    ["register", t("sign_up")],
    ["code", t("sign_in_with_code")],
  ];

  return (
    <div className={styles.tabs} role="tablist" aria-label={t("sign_in")}>
      {modes.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={mode === key}
          className={`${styles.tab} ${mode === key ? styles.active : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
