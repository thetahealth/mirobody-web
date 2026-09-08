import { useEffect, useEffectEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import consola from "consola";
import { getAuth, getRedirectResult } from "firebase/auth";

import api from "../../api";
import useAuth from "../../hooks/useAuth";
import { ACCESS_TOKEN, REDIRECT_LOGIN_TYPE } from "../../enum/storage";
import { OAUTH2_AUTHORIZE_QUERY_KEY } from "../../enum";
import { handleFirebaseResultEffect } from "../../utils/login";
import { isAllowedRedirect } from "../../utils/sharedSession";
import { useAccountStore } from "../../store/account";
import { useSystemStore } from "../../store/system";
import { CDM_URL } from "../../config/cdm";

import AuthShell from "./components/AuthShell";
import LanguageSwitch from "./components/LanguageSwitch";
import AuthCard from "./components/AuthCard";
import EmailOtpForm from "./components/EmailOtpForm";
import PasswordForm from "./components/PasswordForm";
import AuthModeTabs from "./components/AuthModeTabs";
import AlternatePane from "./components/AlternatePane";
import { resolveAltMethods } from "./authMethods";
import styles from "./index.module.scss";

function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const {
    handleGoogleLogin,
    handleAppleLogin,
    handleEmailLogin,
    handlePasswordLogin,
    handleOauthAuthorize,
    processAuthResponse,
  } = useAuth();
  const setUserInfo = useAccountStore((state) => state.setUserInfo);

  // Which way in. Default is `password`: the code form needs a mail provider and
  // a self-hosted deployment usually has none, so leading with codes shows a
  // "Send code" button that answers `No SMTP server configured.`
  const [authMode, setAuthMode] = useState("password");

  const showGoogle = useSystemStore((s) => s.isShowGoogleLogin);
  const showApple = useSystemStore((s) => s.isShowAppleLogin);
  const showDeveloper = useSystemStore((s) => s.isShowDeveloper);
  const methods = resolveAltMethods({ showGoogle, showApple });
  const hasAlt = methods.google || methods.apple;

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
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

  /* Firebase redirect result (mobile Google/Apple) */
  const onRedirectResult = useEffectEvent(async (result) => {
    if (!result) return;
    await handleFirebaseResultEffect(result, async (data) => {
      localStorage.setItem(ACCESS_TOKEN, data.access_token);
      setUserInfo(data);
      await handleLoginSuccess(data);
    });
  });

  useEffect(() => {
    try {
      const redirectLoginType = sessionStorage.getItem(REDIRECT_LOGIN_TYPE);
      if (redirectLoginType === "google") setIsGoogleLoading(true);
      else if (redirectLoginType === "apple") setIsAppleLoading(true);
      const auth = getAuth();
      if (auth) {
        getRedirectResult(auth)
          .then(onRedirectResult)
          .catch((err) => consola.error("ERROR: getRedirectResult", err))
          .finally(() => {
            sessionStorage.removeItem(REDIRECT_LOGIN_TYPE);
            setIsGoogleLoading(false);
            setIsAppleLoading(false);
          });
      } else {
        consola.warn("Firebase Auth not initialized");
      }
    } catch {
      // no firebase initialized in this environment
    }

  }, []);

  /* email OTP */
  const onSendCode = async (email) => {
    await api.emailLogin({ email });
  };
  const onSubmitEmail = async ({ email, code }) => {
    const data = await handleEmailLogin(email, code);
    await handleLoginSuccess(data);
  };

  /* Google / Apple (redirect-type bookkeeping + loading) */
  const onGoogle = async () => {
    try {
      setIsGoogleLoading(true);
      sessionStorage.setItem(REDIRECT_LOGIN_TYPE, "google");
      const data = await handleGoogleLogin();
      sessionStorage.removeItem(REDIRECT_LOGIN_TYPE);
      await handleLoginSuccess(data);
    } catch (err) {
      consola.error("ERROR: Google Login", err);
      sessionStorage.removeItem(REDIRECT_LOGIN_TYPE);
    } finally {
      setIsGoogleLoading(false);
    }
  };
  const onApple = async () => {
    try {
      setIsAppleLoading(true);
      sessionStorage.setItem(REDIRECT_LOGIN_TYPE, "apple");
      const data = await handleAppleLogin();
      sessionStorage.removeItem(REDIRECT_LOGIN_TYPE);
      await handleLoginSuccess(data);
    } catch (err) {
      consola.error("ERROR: Apple Login", err);
      sessionStorage.removeItem(REDIRECT_LOGIN_TYPE);
    } finally {
      setIsAppleLoading(false);
    }
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
      {hasAlt ? (
        <AuthCard
          primary={form}
          alternate={
            <AlternatePane
              methods={methods}
              onGoogle={onGoogle}
              onApple={onApple}
              googleLoading={isGoogleLoading}
              appleLoading={isAppleLoading}
            />
          }
        />
      ) : (
        <div className={styles.soloCard}>{form}</div>
      )}
    </AuthShell>
  );
}

export default Login;
