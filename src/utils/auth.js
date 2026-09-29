/**
 * Authentication utility functions
 * Pure functions for auth-related operations
 */

import {
  ACCESS_TOKEN,
  USER_EMAIL,
  USER_ID,
  USER_NAME,
  CURRENT_QUERY_USER_ID,
  CURRENT_QUERY_USER_NAME,
  SECURITY_SETTINGS,
} from "../enum/storage";
import { useAccountStore } from "../store/account";
import { parseAalFromToken } from "./webauthn";
import { sessionManager } from "./sessionManager";
import { getApiBaseUrl } from "./index";
import { readSharedToken, writeSharedToken, clearSharedToken } from "./sharedSession";

// Note on circular dependency:
// sessionManager.js imports `saveAccessToken` from this file. The cycle is safe
// because the usage is inside function bodies (runtime), not at module
// top-level — by the time `saveAccessToken` or `sessionManager.*` is called,
// both modules are fully initialized.

/**
 * Save authentication data to localStorage
 * @param {string} accessToken - Access token to save
 */
export const saveAccessToken = (accessToken) => {
  localStorage.setItem(ACCESS_TOKEN, accessToken);
  // Mirror to the shared cross-subdomain cookie so a sibling app can consume
  // the same session. Single chokepoint — covers login, renewal and WebAuthn
  // upgrade. No-op unless VITE_SHARED_SESSION_DOMAIN is set.
  writeSharedToken(accessToken);
  // Update global AAL state.
  useAccountStore.getState().updateAAL(accessToken);

  // Start/stop session manager based on AAL level.
  // Both start() and stop() are idempotent — safe to call repeatedly.
  if (parseAalFromToken(accessToken) === 2) {
    sessionManager.start(getApiBaseUrl);
  } else {
    sessionManager.stop();
  }
};

/**
 * Adopt a shared cross-subdomain session on app boot.
 *
 * The `mb_at` cookie on the shared parent domain is the cross-subdomain source
 * of truth; localStorage is per-origin. This site used to only WRITE that cookie
 * (for the sibling app to consume) and never read it — so a visitor who
 * authenticated on the sibling app and then came here, or returned here from it,
 * arrived with only the cookie and no localStorage, and got bounced to /login.
 * That made SSO one-way.
 *
 * Calling this once at startup hydrates our localStorage session from the shared
 * cookie, so every existing check (ProtectedLayout, request interceptor, AAL,
 * session manager) sees the user as logged in. Idempotent: no-op when we already
 * have a native token or there's no shared cookie. A stale/expired adopted token
 * self-heals — the first API 401 clears it and redirects to /login as usual.
 */
export const adoptSharedSession = () => {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(ACCESS_TOKEN)) return; // already have a native session
  const shared = readSharedToken();
  if (shared) saveAccessToken(shared); // hydrate localStorage + AAL + session mgr from the cookie
};

/**
 * Build OAuth callback URL with authorization code
 * @param {string} redirectUri - Base redirect URI
 * @param {string} code - Authorization code
 * @param {string|null} state - Optional state parameter
 * @returns {string} - Complete callback URL
 */
export const buildOAuthCallbackUrl = (redirectUri, code, state = null) => {
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) {
    callbackUrl.searchParams.set("state", state);
  }
  return callbackUrl.toString();
};

/**
 * Determine OAuth redirect URL based on response data
 * @param {Object} data - OAuth response data
 * @param {URLSearchParams} oauthParams - OAuth request parameters
 * @returns {{ url: string, type: string } | null} - Redirect info or null
 */
export const getOAuthRedirectInfo = (data, oauthParams) => {
  // Direct location redirect
  if (data.location) {
    return { url: data.location, type: "location" };
  }

  // Authorization code flow
  if (data.code) {
    const url = buildOAuthCallbackUrl(
      oauthParams.get("redirect_uri"),
      data.code,
      oauthParams.get("state"),
    );
    return { url, type: "code" };
  }

  // Backend provided redirect
  if (data.redirect) {
    return { url: data.redirect, type: "redirect" };
  }

  // Fallback to drive page
  return { url: `${window.location.origin}/data`, type: "fallback" };
};

/**
 * Get all localStorage keys as array
 * @returns {string[]}
 */
const getLocalStorageKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));

/**
 * Clear authentication data from localStorage
 */
export const clearAuthenticationData = () => {
  // Stop session manager before clearing tokens.
  sessionManager.stop();

  // Clear known auth keys and user-scoped settings
  const authKeys = [
    ACCESS_TOKEN,
    USER_EMAIL,
    USER_ID,
    USER_NAME,
    CURRENT_QUERY_USER_ID,
    CURRENT_QUERY_USER_NAME,
    SECURITY_SETTINGS,
  ];
  authKeys.forEach((key) => localStorage.removeItem(key));

  // Clear the shared cross-subdomain session cookie so cdm logs out too.
  clearSharedToken();

  // Clear all WebSocket connectionIds (format: WEBSOCKET_CONNECTION_ID_${user_id})
  getLocalStorageKeys()
    .filter((key) => key?.startsWith("WEBSOCKET_CONNECTION_ID_"))
    .forEach((key) => localStorage.removeItem(key));
};
