import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./EmailOtpForm.module.scss";
import { isValidEmail, canSubmit } from "../emailOtp";

/**
 * Email + verification-code login form. Self-contained UI state; the parent
 * injects the real backend calls:
 *  - onSendCode(email): Promise        — request an OTP (throws on failure)
 *  - onSubmit({ email, code }): Promise — verify + sign in (parent navigates away)
 */
export default function EmailOtpForm({ onSendCode, onSubmit }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSend = async () => {
    if (!isValidEmail(email)) {
      setError(t("error_enter_email"));
      return;
    }
    try {
      setError("");
      setSending(true);
      await onSendCode(email);
      setCountdown(60);
    } catch (err) {
      console.error("ERROR: Send Code", err);
      setError(t("error_send_code_failed"));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit({ email, code })) return;
    try {
      setError("");
      setVerifying(true);
      await onSubmit({ email, code });
    } catch (err) {
      console.error("ERROR: Email Verify", err);
      setError(t("error_email_verify_failed"));
    } finally {
      setVerifying(false);
    }
  };

  const sendDisabled = countdown > 0 || sending || !isValidEmail(email);

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <input
          type="text"
          placeholder={t("email_placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className={styles.codeRow}>
        <input
          type="text"
          placeholder={t("code_placeholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
        />
        <button type="button" onClick={handleSend} disabled={sendDisabled}>
          {countdown > 0
            ? t("resend_in", { seconds: countdown })
            : t("send_code")}
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <button
        type="submit"
        className={styles.submit}
        disabled={verifying || !canSubmit({ email, code })}
      >
        <span className={verifying ? styles.loading : ""}>
          {verifying ? t("signing_in") : t("sign_in")}
        </span>
      </button>
    </form>
  );
}
