import axios from "axios";
import { getLanguage, getApiBaseUrl } from "../utils";
import { ACCESS_TOKEN } from "../enum/storage";
import { consola } from "consola";
import { clearAuthenticationData } from "../utils/auth";
import { isWebAuthnSupported, parseAalFromToken } from "../utils/webauthn";
import { ensureAAL2 } from "../utils/mfa";
import i18n from "i18next";
import Modal from "../components/Modal";
import { sessionManager } from "../utils/sessionManager";

// ============================================================================
// Helper Functions
// ============================================================================

// Helper function to sanitize sensitive data from headers
const sanitizeHeaders = (headers) => {
  if (!headers) return {};
  const sanitized = { ...headers };
  // Axios normalizes to "Authorization", but interceptor-provided configs can
  // carry the lowercase form — filter both.
  if (sanitized.Authorization) {
    sanitized.Authorization = "[Filtered]";
  }
  if (sanitized.authorization) {
    sanitized.authorization = "[Filtered]";
  }
  return sanitized;
};

// Helper function to parse request data
const parseRequestData = (data) => {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  if (data instanceof FormData) {
    // Parse FormData to show field names and file info (without file content)
    const formDataInfo = {};
    for (const [key, value] of data.entries()) {
      if (value instanceof File) {
        formDataInfo[key] = {
          _type: "File",
          name: value.name,
          size: value.size,
          mimeType: value.type,
        };
      } else {
        formDataInfo[key] = value;
      }
    }
    return formDataInfo;
  }
  return data;
};

// handle response
const handleResponse = (response) => {
  const { url } = response.config;

  if (response.data instanceof Blob) {
    // binary endpoints (responseType: "blob") have no {code,data} envelope
    return response.data;
  }
  const { code, data, success, location } = response.data;

  if (url.includes("/mirobody.json")) {
    return response.data;
  }
  if (code === 0 || success) {
    if (location) {
      return {
        ...data,
        location,
      };
    }
    return data;
  }
  return Promise.reject(response.data);
};

// ============================================================================
// AAL2 Session Upgrade (for 403 interceptor)
// ============================================================================

let isUpgrading = false;
let pendingRequests = [];

/**
 * Upgrade current session from AAL1 to AAL2 via WebAuthn.
 * Uses raw axios to avoid circular dependency with mcpRequestInstance.
 */
const upgradeToAAL2 = async () => {
  if (!isWebAuthnSupported()) {
    throw new Error("WebAuthn not supported on this device");
  }

  // Ask user before enabling MFA.
  const userConfirmed = await Modal.confirmAsync({
    title: i18n.t("mfa_enable_title"),
    content: i18n.t("mfa_enable_content"),
    okText: i18n.t("mfa_enable_btn"),
    cancelText: i18n.t("mfa_not_now_btn"),
  });
  if (!userConfirmed) {
    throw new Error("User declined MFA");
  }

  const baseURL = getApiBaseUrl() || import.meta.env.VITE_BASE_URL_MCP;
  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN)}`,
  });
  const unwrap = (res) => res.data?.data || res.data;

  // Shared orchestration (utils/mfa.js): WebAuthn succeeds FIRST, only then is
  // mfa_enabled persisted — the old "enable first" order let a cancelled
  // Touch ID leave mfa_enabled=true + AAL1 token (self-lock). Also handles the
  // first-time registration path (no credential yet), which the previous
  // upgrade-only flow could not. Raw-axios ops because ../api would be a
  // circular import here.
  await ensureAAL2({
    ops: {
      getSettings: () =>
        axios
          .get(`${baseURL}/api/user/settings`, { headers: headers() })
          .then(unwrap),
      registerOptions: () =>
        axios
          .post(
            `${baseURL}/auth/webauthn/register/options`,
            {},
            { headers: headers() },
          )
          .then(unwrap),
      registerVerify: (credential) =>
        axios
          .post(
            `${baseURL}/auth/webauthn/register/verify`,
            { credential },
            { headers: headers() },
          )
          .then(unwrap),
      upgradeOptions: () =>
        axios
          .post(
            `${baseURL}/auth/webauthn/upgrade/options`,
            {},
            { headers: headers() },
          )
          .then(unwrap),
      upgradeVerify: (assertion) =>
        axios
          .post(
            `${baseURL}/auth/webauthn/upgrade/verify`,
            { credential: assertion },
            { headers: headers() },
          )
          .then(unwrap),
      updateSettings: (patch) =>
        axios
          .post(`${baseURL}/api/user/settings`, patch, { headers: headers() })
          .then(unwrap),
    },
  });

  return localStorage.getItem(ACCESS_TOKEN);
};

// ============================================================================
// AAL2 Session Re-auth — delegates to SessionManager.ensureValidToken()
// ============================================================================

/**
 * Handle session expiry for an AAL2 user. All 401/403 callers go through
 * sessionManager.ensureValidToken() which uses a singleton Promise — only
 * one Touch ID prompt regardless of how many requests fail simultaneously.
 */
const reauthenticateSession = (originalError) => {
  return sessionManager
    .ensureValidToken()
    .then((newToken) => {
      // Retry the original request with the new token.
      originalError.config.headers.Authorization = `Bearer ${newToken}`;
      return mcpRequestInstance(originalError.config);
    })
    .catch((reauthError) => {
      const isBackendRejection =
        reauthError?.response?.status === 401 ||
        reauthError?.response?.status === 403;

      if (isBackendRejection) {
        clearAuthenticationData();
        sessionManager.stop();
        window.location.href = "/login";
      }

      consola.warn("Session re-auth failed", reauthError);
      return Promise.reject(reauthError);
    });
};

// MCP Redirect Request Instance
const mcpRequestInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL_MCP,
});

mcpRequestInstance.interceptors.request.use((config) => {
  config.headers["X-Language"] = getLanguage();
  config.headers["X-Timezone"] =
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const access_token = localStorage.getItem(ACCESS_TOKEN);
  if (access_token) {
    config.headers["Authorization"] = `Bearer ${access_token}`;
  }

  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl) {
    config.baseURL = apiBaseUrl;
  }
  return config;
});

mcpRequestInstance.interceptors.response.use(handleResponse, (error) => {
  if (error.name === "CanceledError") {
    return Promise.reject(error);
  }

  // Handle 403 errors with specific codes.
  const detail = error.response?.data?.detail;
  if (error.response?.status === 403 && detail && typeof detail === "object") {
    // Session max lifetime exceeded — trigger WebAuthn re-auth.
    if (detail.code === "ERROR_SESSION_MAX_LIFETIME") {
      return reauthenticateSession(error);
    }
  }

  // Handle 403 AAL2 required — auto-upgrade via WebAuthn.
  if (
    error.response?.status === 403 &&
    detail &&
    typeof detail === "object" &&
    detail.code === "ERROR_AAL2_REQUIRED"
  ) {
    if (isUpgrading) {
      // Queue request until upgrade completes.
      return new Promise((resolve, reject) => {
        pendingRequests.push({ resolve, reject, config: error.config });
      });
    }

    isUpgrading = true;

    return upgradeToAAL2()
      .then((newToken) => {
        // Retry all queued requests with new token.
        pendingRequests.forEach(({ resolve, config }) => {
          config.headers.Authorization = `Bearer ${newToken}`;
          resolve(mcpRequestInstance(config));
        });
        pendingRequests = [];

        // Retry the original request.
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return mcpRequestInstance(error.config);
      })
      .catch((upgradeError) => {
        // User cancelled or failed — wrap with friendly message.
        const friendlyError = new Error(
          "Security verification required. Please enable Two-Step Verification (MFA) in Settings to access this feature."
        );
        friendlyError.name = "AAL2UpgradeError";
        friendlyError.originalError = error;
        pendingRequests.forEach(({ reject }) => reject(friendlyError));
        pendingRequests = [];
        consola.warn("AAL2 upgrade failed or cancelled", upgradeError);
        return Promise.reject(friendlyError);
      })
      .finally(() => {
        isUpgrading = false;
      });
  }

  // Handle 401 — token expired or invalid.
  // Must come BEFORE error logging so that expected auth flows (AAL2 re-auth,
  // non-AAL2 login redirect) don't pollute Sentry with error-level logs.
  if (error.response?.status === 401) {
    // AAL2 users with WebAuthn: try session re-auth.
    // ensureValidToken() is singleton — multiple 401s share one Touch ID prompt.
    const currentToken = localStorage.getItem(ACCESS_TOKEN);
    if (
      currentToken &&
      parseAalFromToken(currentToken) === 2 &&
      isWebAuthnSupported()
    ) {
      return reauthenticateSession(error);
    }

    // Non-AAL2 or no WebAuthn: original behavior — clear auth and redirect.
    clearAuthenticationData();
    sessionManager.stop();
    window.location.href = "/login";
    return Promise.reject(error);
  }

  consola.error("MCP Request Error", error);

  // Log error with request parameters to Sentry via consola
  if (error.config) {
    const fullUrl = error.config.url?.startsWith("http")
      ? error.config.url
      : `${error.config.baseURL || ""}${error.config.url || ""}`;

    consola.error("API Request Failed", {
      url: fullUrl,
      method: error.config.method,
      headers: sanitizeHeaders(error.config.headers),
      data: parseRequestData(error.config.data),
      params: error.config.params,
      statusCode: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      errorMessage: error.message,
    });
  }

  return Promise.reject(error);
});

export { mcpRequestInstance };
