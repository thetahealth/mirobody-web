import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./PasswordForm.module.scss";
import { canSubmitPassword, isValidPassword, MIN_PASSWORD_LENGTH } from "../password";
import { isValidEmail } from "../emailOtp";

/**
 * Email/username + password form, in sign-in or sign-up mode.
 *
 * This is the route that works on a self-hosted deployment: the code form beside
 * it needs a mail provider to send anything, and most installs have none.
 *
 * Props:
 *  - mode:     "login" | "register"
 *  - needsCode: registering takes a code sent to the address (the server sends mail)
 *  - onSendCode(email): Promise — request that code
 *  - onSubmit({ email, password, register, code }): Promise — parent navigates away
 */
export default function PasswordForm({ mode = "login", needsCode = false, onSendCode, onSubmit }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const register = mode === "register";
  const withCode = register && needsCode;
  const ready = canSubmitPassword({ email, password, code, needsCode: withCode });

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    try {
      setError("");
      await onSendCode(email);
      setCountdown(60);
    } catch (err) {
      console.error("ERROR: Send sign-up code", err);
      setError(t("error_send_code_failed"));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    try {
      setError("");
      setBusy(true);
      await onSubmit({ email, password, register, code: withCode ? code.trim() : "" });
    } catch (err) {
      console.error("ERROR: Password Auth", err);
      // The server answers "incorrect email or password" for a wrong password
      // and for an address it has never seen, on purpose — so this cannot be
      // more specific than the server was, and must not guess.
      // A refused sign-up code is the server's to explain.
      setError(
        register
          ? err?.msg || t("error_register_failed")
          : t("error_password_login_failed"),
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
      {withCode && (
        <div className={styles.codeRow}>
          <input
            type="text"
            placeholder={t("code_placeholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
          />
          <button
            type="button"
            onClick={handleSendCode}
            disabled={countdown > 0 || !isValidEmail(email)}
          >
            {countdown > 0 ? t("resend_in", { seconds: countdown }) : t("send_code")}
          </button>
        </div>
      )}
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
