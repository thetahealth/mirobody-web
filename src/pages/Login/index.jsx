import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import consola from "consola";

import api from "../../api";
import useAuth from "../../hooks/useAuth";
import { OAUTH2_AUTHORIZE_QUERY_KEY } from "../../enum";
import { isAllowedRedirect } from "../../utils/sharedSession";
import { useSystemStore } from "../../store/system";
import { CDM_URL } from "../../config/cdm";

import AuthShell from "./components/AuthShell";
import LanguageSwitch from "./components/LanguageSwitch";
import EmailOtpForm from "./components/EmailOtpForm";
import PasswordForm from "./components/PasswordForm";
import AuthModeTabs from "./components/AuthModeTabs";
import styles from "./index.module.scss";

function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { handleEmailLogin, handlePasswordLogin, handleOauthAuthorize } =
    useAuth();

  // Which way in. Default is `password`: the code form needs a mail provider and
  // a self-hosted deployment usually has none, so leading with codes shows a
  // "Send code" button that answers `No SMTP server configured.`
  const [authMode, setAuthMode] = useState("password");

  const showDeveloper = useSystemStore((s) => s.isShowDeveloper);
  const [error, setError] = useState("");

  /* oauth2 authorize → cross-app redirect whitelist → home */
  const handleLoginSuccess = async (authData) => {
    const { access_token } = authData || {};
    try {
      const oauthParams = searchParams.get(OAUTH2_AUTHORIZE_QUERY_KEY);
      if (oauthParams) {
        const urlParams = new URLSearchParams(decodeURIComponent(oauthParams));
        await handleOauthAuthorize(urlParams, access_token);
        return;
      }
      // Cross-app SSO bounce-back to the originating app (e.g. cdm); the shared
      // cookie is already written, so the target picks up the session on load.
      const redirect = searchParams.get("redirect");
      if (redirect && isAllowedRedirect(redirect)) {
        window.location.href = redirect;
        return;
      }
      navigate("/");
    } catch (err) {
      consola.error("ERROR: Oauth2 Authorize", err);
      throw err;
    }
  };

  /* email OTP */
  const onSendCode = async (email) => {
    await api.emailLogin({ email });
  };
  const onSubmitEmail = async ({ email, code }) => {
    const data = await handleEmailLogin(email, code);
    await handleLoginSuccess(data);
  };

  const onSubmitPassword = async ({ email, password, register }) => {
    const data = await handlePasswordLogin(email, password, { register });
    await handleLoginSuccess(data);
  };

  const form = (
    <>
      <AuthModeTabs mode={authMode} onChange={setAuthMode} />
      {authMode === "code" ? (
        <EmailOtpForm onSendCode={onSendCode} onSubmit={onSubmitEmail} />
      ) : (
        <PasswordForm
          mode={authMode === "register" ? "register" : "login"}
          onSubmit={onSubmitPassword}
        />
      )}
      {error && <div className={styles.pageError}>{error}</div>}
    </>
  );

  // The developer platform is a separate deployment (cdm) that opensource
  // installs don't have — only link out when this build ships with it.
  const footer = showDeveloper && (
    <a className={styles.crossLink} href={`${CDM_URL}/login`}>
      {t("login_to_developer")}
      <span aria-hidden>→</span>
    </a>
  );

  return (
    <AuthShell title="Mirobody" actions={<LanguageSwitch />} footer={footer}>
      <div className={styles.soloCard}>{form}</div>
    </AuthShell>
  );
}

export default Login;
