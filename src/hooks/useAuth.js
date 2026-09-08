import { useAccountStore } from "../store/account";
import device from "current-device";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  OAuthProvider,
} from "firebase/auth";
import { handleFirebaseResultEffect } from "../utils/login";
import api from "../api";
import consola from "consola";
import {
  saveAccessToken,
  getOAuthRedirectInfo,
  isMobileDevice,
  isRedirectError,
} from "../utils/auth";
import {
  isWebAuthnSupported,
  startRegistration,
  startAuthentication,
} from "../utils/webauthn";

/**
 * Hook for authentication operations
 */
const useAuth = () => {
  const setUserInfo = useAccountStore((state) => state.setUserInfo);

  /**
   * Save authentication data (token + user info)
   */
  const saveAuthData = (data) => {
    saveAccessToken(data.access_token);
    setUserInfo(data);
  };

  /**
   * Perform Firebase OAuth login (shared logic for Google/Apple)
   * @param {Object} provider - Firebase auth provider
   * @returns {Promise<Object>} - Auth result data
   */
  const performFirebaseLogin = async (provider) => {
    const auth = getAuth();
    if (!auth) {
      throw new Error("Firebase Auth not initialized");
    }

    // Mobile/tablet: use redirect flow
    if (isMobileDevice(device)) {
      await signInWithRedirect(auth, provider);
      throw new Error("redirect");
    }

    // Desktop: use popup flow.
    // Pass a no-op callback — we handle auth data saving via processAuthResponse.
    const result = await signInWithPopup(auth, provider);
    const res = await handleFirebaseResultEffect(result, () => {});
    return await processAuthResponse(res);
  };

  /**
   * Handle Google login
   */
  const handleGoogleLogin = async () => {
    try {
      return await performFirebaseLogin(new GoogleAuthProvider());
    } catch (error) {
      if (isRedirectError(error)) {
        consola.warn("Google Login: Redirecting");
        return;
      }
      consola.error("ERROR: Google Login", error);
      throw error;
    }
  };

  /**
   * Handle Apple login
   */
  const handleAppleLogin = async () => {
    try {
      return await performFirebaseLogin(new OAuthProvider("apple.com"));
    } catch (error) {
      if (isRedirectError(error)) {
        consola.warn("Apple Login: Redirecting");
        return;
      }
      consola.error("ERROR: Apple Login", error);
      throw error;
    }
  };

  /**
   * Handle Google One Tap callback
   */
  const googleOneTapCallback = async ({ credential }) => {
    try {
      await api.googleVerify({ token: credential });
    } catch (error) {
      consola.error("ERROR: Google One Tap Callback", error);
    }
  };

  /**
   * Complete WebAuthn MFA login flow.
   * Called when first-factor auth returns status: "mfa_required".
   */
  const completeWebAuthnLogin = async (mfaTicket) => {
    const optionsRes = await api.loginOptions(mfaTicket);
    const assertion = await startAuthentication(optionsRes);
    const tokenRes = await api.loginVerify(mfaTicket, assertion);
    saveAuthData(tokenRes);
    return tokenRes;
  };

  /**
   * Process first-factor auth response: handle MFA challenge or save token.
   */
  const processAuthResponse = async (res) => {
    if (res.status === "mfa_required" && res.mfa_ticket) {
      if (!isWebAuthnSupported()) {
        // No WebAuthn support — use fallback AAL1 token if provided.
        if (res.fallback_token) {
          saveAuthData({ ...res, access_token: res.fallback_token });
          return { ...res, access_token: res.fallback_token };
        }
        throw new Error("Your browser does not support biometric authentication.");
      }
      try {
        return await completeWebAuthnLogin(res.mfa_ticket);
      } catch (error) {
        consola.warn("WebAuthn cancelled during login, degrading to AAL1");
        // User cancelled Touch ID — use fallback AAL1 token to enter with degraded access.
        if (res.fallback_token) {
          saveAuthData({ ...res, access_token: res.fallback_token });
          return { ...res, access_token: res.fallback_token };
        }
        throw error;
      }
    }

    // No MFA required — save AAL1 token directly.
    saveAuthData(res);
    return res;
  };

  /**
   * Handle email login
   */
  /**
   * Password sign-in, and sign-up when `register` is true. Both return the same
   * auth payload the code path does, so `processAuthResponse` is shared.
   */
  const handlePasswordLogin = async (email, password, { register = false } = {}) => {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }
    try {
      const call = register ? api.passwordRegister : api.passwordLogin;
      const res = await call({ email, password });
      return await processAuthResponse(res);
    } catch (error) {
      consola.error("ERROR: Password Login", error);
      throw error;
    }
  };

  const handleEmailLogin = async (email, code) => {
    if (!email || !code) {
      throw new Error("Email and code are required");
    }

    try {
      const res = await api.emailVerify({ email, code });
      return await processAuthResponse(res);
    } catch (error) {
      consola.error("ERROR: Email Verify", error);
      throw error;
    }
  };

  /**
   * Register a WebAuthn credential for the current user.
   * Call after login when webauthn_registered is false.
   */
  const registerWebAuthn = async () => {
    if (!isWebAuthnSupported()) return false;

    try {
      const options = await api.registerOptions();
      const credential = await startRegistration(options);
      const res = await api.registerVerify(credential);
      // Registration returns a new AAL2 token — save it to upgrade the session.
      if (res.access_token) {
        saveAuthData(res);
      }
      return true;
    } catch (error) {
      consola.error("ERROR: WebAuthn Registration", error);
      return false;
    }
  };

  /**
   * Handle OAuth2 authorization
   */
  const handleOauthAuthorize = async (oauthParams, accessToken) => {
    if (!oauthParams) {
      throw new Error("Oauth2 Authorize: Oauth params are required");
    }

    try {
      // Build form data from params
      const form = new FormData();
      for (const [key, value] of oauthParams) {
        form.append(key, value || "");
      }
      form.append("action", "allow");

      // Call API and get redirect info
      const data = await api.oauthAuthorize(form, accessToken);
      const redirectInfo = getOAuthRedirectInfo(data, oauthParams);

      // Log fallback case
      if (redirectInfo.type === "fallback") {
        consola.warn(
          "No callback information in response, redirecting to upload page",
        );
      }

      // Perform redirect
      window.location.href = redirectInfo.url;
    } catch (error) {
      consola.error("ERROR: Oauth2 Authorize", error);
    }
  };

  return {
    handleGoogleLogin,
    handleAppleLogin,
    handleEmailLogin,
    handlePasswordLogin,
    handleOauthAuthorize,
    googleOneTapCallback,
    registerWebAuthn,
    processAuthResponse,
    saveAuthData,
  };
};

export default useAuth;
