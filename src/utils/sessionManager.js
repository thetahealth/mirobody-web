/**
 * AAL2 Session Manager — NIST 800-63B Section 7
 *
 * Architecture: Proactive Renewal (setTimeout) + Interceptor Queue (singleton reauth Promise)
 *
 * - SessionManager schedules a precise setTimeout to renew the token before expiry.
 * - If renewal fails or token is already expired, interceptor catches 401 and calls
 *   ensureValidToken() which triggers WebAuthn re-auth (single Promise, all 401s queue on it).
 * - visibilitychange handles laptop sleep/wake: checks token on resume.
 * - No polling/setInterval. No competing re-auth paths.
 *
 * Only active for AAL2 users. Non-AAL2 users are unaffected.
 */

import axios from "axios";
import { ACCESS_TOKEN } from "../enum/storage";
import { saveAccessToken } from "./auth";
import { decodeJwtPayload, parseAalFromToken } from "./webauthn";

// ============================================================================
// Constants
// ============================================================================

const RENEW_BUFFER_MS = 5 * 60 * 1000; // Renew 5 min before expiry
const ACTIVITY_THROTTLE_MS = 60 * 1000; // Update activity at most once/min
const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

// ============================================================================
// Token helpers
// ============================================================================

/**
 * Parse exp and session_start from a JWT token string.
 * @returns {{ exp: number, sessionStart: number } | null}
 */
export const parseTokenTimes = (token) => {
  const decoded = decodeJwtPayload(token);
  if (!decoded) return null;
  return {
    exp: decoded.exp || 0,
    sessionStart: decoded.session_start || 0,
  };
};

// ============================================================================
// SessionManager (singleton)
// ============================================================================

class SessionManager {
  constructor() {
    this._lastActivity = Date.now();
    this._renewTimer = null;
    this._enabled = false;
    this._throttledOnActivity = null;
    this._getApiBaseUrl = null;

    // Singleton reauth Promise — all 401 callers wait on the same one.
    this._reauthPromise = null;

    // UI listener for reauth state (Glass Pane overlay).
    this._reauthListeners = new Set();
  }

  /**
   * Subscribe to reauth state changes. Returns unsubscribe function.
   * @param {(isActive: boolean) => void} fn
   */
  onReauthChange(fn) {
    this._reauthListeners.add(fn);
    return () => this._reauthListeners.delete(fn);
  }

  /** @private */
  _notifyReauth(isActive) {
    this._reauthListeners.forEach((fn) => fn(isActive));
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Start session management for an AAL2 user.
   * @param {Function} getApiBaseUrl - Returns the current API base URL.
   */
  start(getApiBaseUrl) {
    if (this._enabled) return;

    this._getApiBaseUrl = getApiBaseUrl;
    this._lastActivity = Date.now();

    // Throttled activity listener.
    let lastUpdate = 0;
    this._throttledOnActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > ACTIVITY_THROTTLE_MS) {
        lastUpdate = now;
        this._lastActivity = now;
      }
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      document.addEventListener(evt, this._throttledOnActivity, {
        passive: true,
      }),
    );

    // visibilitychange: handle laptop sleep/wake.
    document.addEventListener("visibilitychange", this._onVisibilityChange);

    // storage event: sync token across tabs.
    window.addEventListener("storage", this._onStorageChange);

    // Schedule first renewal based on current token.
    this._scheduleRenew();
    this._enabled = true;
  }

  /**
   * Stop session management (on logout or AAL downgrade).
   */
  stop() {
    if (!this._enabled) return;

    ACTIVITY_EVENTS.forEach((evt) =>
      document.removeEventListener(evt, this._throttledOnActivity),
    );
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    window.removeEventListener("storage", this._onStorageChange);

    if (this._renewTimer) {
      clearTimeout(this._renewTimer);
      this._renewTimer = null;
    }

    this._enabled = false;
    this._reauthPromise = null;
  }

  // --------------------------------------------------------------------------
  // Proactive renewal (setTimeout, not setInterval)
  // --------------------------------------------------------------------------

  /**
   * Schedule a single setTimeout to renew the token before it expires.
   * Called after login, after successful renew, and on visibilitychange.
   * @private
   */
  _scheduleRenew() {
    if (this._renewTimer) {
      clearTimeout(this._renewTimer);
      this._renewTimer = null;
    }

    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token || parseAalFromToken(token) !== 2) return;

    const times = parseTokenTimes(token);
    if (!times?.exp) return;

    const now = Math.floor(Date.now() / 1000);
    const msUntilRenew = (times.exp - now) * 1000 - RENEW_BUFFER_MS;

    if (msUntilRenew <= 0) {
      // Token already at or past renewal point — don't auto-renew
      // (may be idle). Let interceptor handle it on next user request.
      return;
    }

    this._renewTimer = setTimeout(() => this._doRenew(), msUntilRenew);
  }

  /**
   * Attempt silent token renewal. If user is idle, skip (let token expire).
   * @private
   */
  async _doRenew() {
    this._renewTimer = null;

    // Check if user was recently active.
    const idleMs = Date.now() - this._lastActivity;
    if (idleMs > RENEW_BUFFER_MS * 2) {
      // User is idle — let token expire naturally. Interceptor will
      // handle re-auth when user comes back and makes a request.
      return;
    }

    try {
      const baseURL = this._getBaseURL();
      const token = localStorage.getItem(ACCESS_TOKEN);
      if (!token) return;

      const res = await axios.post(
        `${baseURL}/auth/session/renew`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const data = res.data?.data || res.data;
      if (data?.access_token) {
        saveAccessToken(data.access_token);
        // Schedule next renewal based on new token.
        this._scheduleRenew();
      }
    } catch {
      // Renew failed (401 expired, 403 max lifetime, network error).
      // Don't try to re-auth here — let the interceptor handle it
      // when the user's next action triggers a 401.
    }
  }

  // --------------------------------------------------------------------------
  // visibilitychange handler
  // --------------------------------------------------------------------------

  /**
   * On page resume (laptop wake, tab switch back), check token immediately.
   * @private
   */
  _onVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;

    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token || parseAalFromToken(token) !== 2) return;

    const times = parseTokenTimes(token);
    if (!times?.exp) return;

    const now = Math.floor(Date.now() / 1000);
    if (times.exp <= now) {
      // Token already expired — interceptor will handle on next request.
      return;
    }

    // Token still valid — reschedule renewal.
    this._scheduleRenew();
  };

  // --------------------------------------------------------------------------
  // Cross-tab sync via storage event
  // --------------------------------------------------------------------------

  /**
   * When another tab updates the token in localStorage, reschedule renewal.
   * This avoids Tab B trying to renew an already-replaced token.
   * @private
   */
  _onStorageChange = (event) => {
    if (event.key !== ACCESS_TOKEN || !event.newValue) return;

    // Another tab updated the token — reschedule based on new exp.
    // Do NOT clear _reauthPromise here: _performReauth has two internal
    // double-checks that will pick up the fresh token from localStorage
    // and resolve naturally. Clearing the field here would break the
    // singleton guarantee (a new 401 could start a second _performReauth
    // in parallel) without actually helping any awaiters.
    if (parseAalFromToken(event.newValue) === 2) {
      this._scheduleRenew();
    }
  };

  // --------------------------------------------------------------------------
  // ensureValidToken — single entry point for all re-auth
  // --------------------------------------------------------------------------

  /**
   * Ensure a valid AAL2 token is available. Called by:
   * - Interceptor on 401 (user just made a request, has gesture)
   * - Returns a Promise that resolves with the new token or rejects.
   *
   * Uses a singleton Promise: if 10 requests all get 401, only ONE
   * WebAuthn prompt appears, and all 10 wait on the same Promise.
   *
   * @returns {Promise<string>} New access token.
   */
  ensureValidToken() {
    // If reauth is already in progress, return the same Promise.
    if (this._reauthPromise) {
      return this._reauthPromise;
    }

    this._notifyReauth(true);
    this._reauthPromise = this._performReauth()
      .finally(() => {
        this._reauthPromise = null;
        this._notifyReauth(false);
      });

    return this._reauthPromise;
  }

  /**
   * Perform WebAuthn re-authentication.
   * @private
   * @returns {Promise<string>} New access token.
   */
  async _performReauth() {
    const baseURL = this._getBaseURL();
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      throw new Error("No token available");
    }

    // Double-check: another tab may have already refreshed the token.
    // If localStorage has a valid (non-expired) AAL2 token, skip WebAuthn.
    const times = parseTokenTimes(token);
    if (times?.exp && times.exp > Math.floor(Date.now() / 1000)) {
      this._scheduleRenew();
      return token;
    }

    const { isWebAuthnSupported, startAuthentication } = await import(
      "./webauthn"
    );
    if (!isWebAuthnSupported()) {
      throw new Error("WebAuthn not supported on this device");
    }

    const headers = { Authorization: `Bearer ${token}` };

    // Step 1: Get WebAuthn challenge (accepts expired token).
    const optionsRes = await axios.post(
      `${baseURL}/auth/session/reauth/options`,
      {},
      { headers },
    );
    const options = optionsRes.data?.data || optionsRes.data;

    // Double-check again before showing Touch ID — another tab may have
    // completed re-auth while we were waiting for the challenge response.
    const freshToken = localStorage.getItem(ACCESS_TOKEN);
    if (freshToken && freshToken !== token) {
      const freshTimes = parseTokenTimes(freshToken);
      if (freshTimes?.exp && freshTimes.exp > Math.floor(Date.now() / 1000)) {
        this._scheduleRenew();
        return freshToken;
      }
    }

    // Step 2: Touch ID / biometric.
    const assertion = await startAuthentication(options);

    // Step 3: Verify and get new AAL2 token.
    const verifyRes = await axios.post(
      `${baseURL}/auth/session/reauth/verify`,
      { credential: assertion },
      { headers },
    );

    // Robust parsing — extract token with try/catch.
    try {
      const result = verifyRes.data?.data || verifyRes.data;
      const newToken = result?.access_token;
      if (newToken) {
        saveAccessToken(newToken);
        this._scheduleRenew();
        return newToken;
      }
    } catch {
      // Parse failed — fall through to error.
    }

    throw new Error("No token in re-auth response");
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  _getBaseURL() {
    return (
      (this._getApiBaseUrl && this._getApiBaseUrl()) ||
      import.meta.env.VITE_BASE_URL_MCP
    );
  }
}

// Singleton instance.
export const sessionManager = new SessionManager();
export default sessionManager;
