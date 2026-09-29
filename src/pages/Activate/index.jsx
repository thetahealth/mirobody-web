import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import consola from "consola";

import api from "../../api";
import useAuth from "../../hooks/useAuth";
import { useAccountStore } from "../../store/account";
import AuthShell from "../Login/components/AuthShell";
import LanguageSwitch from "../Login/components/LanguageSwitch";
import styles from "./index.module.scss";

const MIN_PASSWORD = 8;
const ACCESS = ["edit", "view", "none"];

/**
 * Where a virtual member takes over their own account. Someone kept a record
 * for them and sent this link; they prove the address it names (a code sent
 * there, or a password where the server sends no mail) and choose what that
 * person may still see. The token rides in the URL fragment, which the
 * browser never sends to the server.
 */
export default function Activate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { processAuthResponse } = useAuth();
  const userEmail = useAccountStore((s) => s.user_email);
  const [token] = useState(() => window.location.hash.replace(/^#/, ""));
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [access, setAccess] = useState("edit");
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    api
      .activationInfo(token)
      .then((data) => {
        setInfo(data);
        setState("form");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const signedInAsIt = Boolean(info) && (userEmail || "").toLowerCase() === info.email;
  const needsCode = Boolean(info?.sends_mail) && !signedInAsIt;
  const needsPassword = Boolean(info) && !info.sends_mail && !signedInAsIt;
  const ready =
    (!needsCode || code.trim().length > 0) &&
    (!needsPassword || password.length >= MIN_PASSWORD) &&
    (!password || password.length >= MIN_PASSWORD);

  const onSendCode = async () => {
    try {
      setError("");
      await api.emailLogin({ email: info.email });
      setCountdown(60);
    } catch (err) {
      consola.error("ERROR: send activation code", err);
      setError(err?.msg || t("error_send_code_failed"));
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    try {
      setBusy(true);
      setError("");
      const res = await api.completeActivation({ token, code: code.trim(), password, access });
      await processAuthResponse(res);
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/");
    } catch (err) {
      consola.error("ERROR: completeActivation", err);
      setError(err?.msg || t("activate_failed"));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (state === "loading") {
    body = <p className={styles.text}>{t("loading")}</p>;
  } else if (state === "invalid") {
    body = (
      <>
        <h1 className={styles.title}>{t("activate_invalid_title")}</h1>
        <p className={styles.text}>{t("activate_invalid_text")}</p>
      </>
    );
  } else {
    const names = { creator: info.creator_name, member: info.member_name };
    body = (
      <form className={styles.form} onSubmit={onSubmit}>
        <h1 className={styles.title}>{t("activate_title")}</h1>
        <p className={styles.text}>{t("activate_intro", names)}</p>

        <div className={styles.field}>
          <span>{t("activate_email_label")}</span>
          <input type="email" value={info.email} readOnly />
        </div>

        {needsCode && (
          <div className={styles.field}>
            <span>{t("activate_code_label")}</span>
            <div className={styles.codeRow}>
              <input
                type="text"
                value={code}
                placeholder={t("code_placeholder")}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
              />
              <button type="button" onClick={onSendCode} disabled={countdown > 0}>
                {countdown > 0 ? t("resend_in", { seconds: countdown }) : t("send_code")}
              </button>
            </div>
          </div>
        )}

        {!signedInAsIt && (
          <div className={styles.field}>
            <span>
              {needsPassword ? t("activate_password_label") : t("activate_password_optional")}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <small>
              {needsPassword ? t("activate_password_hint") : t("activate_password_optional_hint")}
            </small>
          </div>
        )}

        <fieldset className={styles.access}>
          <legend>{t("activate_access_label", names)}</legend>
          {ACCESS.map((value) => (
            <label key={value} className={styles.option}>
              <input
                type="radio"
                name="access"
                value={value}
                checked={access === value}
                onChange={() => setAccess(value)}
              />
              <span>{t(`activate_access_${value}`)}</span>
            </label>
          ))}
        </fieldset>

        {error && <div className={styles.error}>{error}</div>}
        <button type="submit" className={styles.submit} disabled={!ready || busy}>
          {busy ? t("activate_submitting") : t("activate_submit")}
        </button>
      </form>
    );
  }

  return (
    <AuthShell title="Mirobody" actions={<LanguageSwitch />}>
      <div className={styles.card}>{body}</div>
    </AuthShell>
  );
}
