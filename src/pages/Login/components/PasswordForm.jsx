import { useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./PasswordForm.module.scss";
import { canSubmitPassword, isValidPassword, MIN_PASSWORD_LENGTH } from "../password";

/**
 * Email/username + password form, in sign-in or sign-up mode.
 *
 * This is the route that works on a self-hosted deployment: the code form beside
 * it needs a mail provider to send anything, and most installs have none.
 *
 * Props:
 *  - mode:     "login" | "register"
 *  - onSubmit({ email, password, register }): Promise — parent navigates away
 */
export default function PasswordForm({ mode = "login", onSubmit }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const register = mode === "register";
  const ready = canSubmitPassword({ email, password });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    try {
      setError("");
      setBusy(true);
      await onSubmit({ email, password, register });
    } catch (err) {
      console.error("ERROR: Password Auth", err);
      // The server answers "incorrect email or password" for a wrong password
      // and for an address it has never seen, on purpose — so this cannot be
      // more specific than the server was, and must not guess.
      setError(
        register ? t("error_register_failed") : t("error_password_login_failed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <input
          type="text"
          placeholder={t("email_placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div className={styles.field}>
        <input
          type="password"
          placeholder={t("password_placeholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          // Tells a password manager to offer a new password rather than an
          // existing one, and stops it saving a half-typed sign-up.
          autoComplete={register ? "new-password" : "current-password"}
        />
      </div>
      {register && !isValidPassword(password) && (
        <div className={styles.hint}>
          {t("password_min_length", { count: MIN_PASSWORD_LENGTH })}
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}
      <button type="submit" className={styles.submit} disabled={busy || !ready}>
        <span className={busy ? styles.loading : ""}>
          {busy
            ? t(register ? "signing_up" : "signing_in")
            : t(register ? "sign_up" : "sign_in")}
        </span>
      </button>
    </form>
  );
}
