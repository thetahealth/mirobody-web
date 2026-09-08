/**
 * Cross-subdomain shared session — opt-in, off by default.
 *
 * Two apps on sibling subdomains share a signed-in session through a cookie on
 * their common parent domain, because localStorage cannot cross subdomains. A
 * single-app install has nobody to share with, and that cookie would hand the
 * access token to every other host under the domain — so it is configuration,
 * and unset makes every function here a no-op:
 *
 *   VITE_SHARED_SESSION_DOMAIN=.example.com
 */

export const COOKIE_NAME = "mb_at";

const configured = (import.meta.env.VITE_SHARED_SESSION_DOMAIN || "").trim();

/** The shared parent domain, normalized to a leading dot. "" when unconfigured. */
export const SHARED_SESSION_DOMAIN = configured
  ? configured.startsWith(".")
    ? configured
    : `.${configured}`
  : "";

export const IS_SHARED_SESSION_ENABLED = SHARED_SESSION_DOMAIN !== "";

/** Hosts a post-login redirect may point at. Empty means "same origin only". */
export const ALLOWED_REDIRECT_SUFFIX = SHARED_SESSION_DOMAIN;

/** Read a single cookie value out of a `document.cookie`-style string. */
export function parseCookie(cookieString, name) {
  if (typeof cookieString !== "string" || cookieString === "") return null;
  const prefix = name + "=";
  for (const part of cookieString.split(";")) {
    const c = part.trim();
    if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length));
  }
  return null;
}

/** Build a Set-Cookie value string. maxAge=0 clears; omit for a session cookie. */
export function buildSetCookie(
  name,
  value,
  { domain = "", secure = true, maxAge } = {},
) {
  let s = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
  if (domain) s += `; Domain=${domain}`;
  if (secure) s += `; Secure`;
  if (typeof maxAge === "number") s += `; Max-Age=${maxAge}`;
  return s;
}

/**
 * Open-redirect guard: absolute http(s) only, host equal to the allowed domain
 * or a subdomain of it (dot boundary enforced). An empty suffix rejects
 * everything but localhost — that case is reachable now, and
 * `hostname.endsWith("")` is true for every host.
 */
export function isAllowedRedirect(
  rawUrl,
  allowedHostSuffix = ALLOWED_REDIRECT_SUFFIX,
) {
  if (typeof rawUrl !== "string" || rawUrl === "") return false;
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  // Local dev: the two apps run on localhost. A localhost target is the user's
  // own machine and cannot read the shared-domain cookie, so nothing leaks.
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  if (!allowedHostSuffix) return false;
  const bare = allowedHostSuffix.startsWith(".")
    ? allowedHostSuffix.slice(1)
    : allowedHostSuffix;
  return u.hostname === bare || u.hostname.endsWith(allowedHostSuffix);
}

/* ---- document.cookie wrappers (no-ops unless the shared domain is set) ---- */

/** @returns {string|null} the shared access token, or null. */
export function readSharedToken() {
  if (!IS_SHARED_SESSION_ENABLED) return null;
  if (typeof document === "undefined") return null;
  return parseCookie(document.cookie, COOKIE_NAME);
}

/** Write the shared session cookie scoped to the configured parent domain. */
export function writeSharedToken(token) {
  if (!IS_SHARED_SESSION_ENABLED) return;
  if (typeof document === "undefined" || !token) return;
  const secure = window.location.protocol === "https:";
  document.cookie = buildSetCookie(COOKIE_NAME, token, {
    domain: SHARED_SESSION_DOMAIN,
    secure,
  });
}

/** Clear the shared session cookie (logout / 401). */
export function clearSharedToken() {
  if (!IS_SHARED_SESSION_ENABLED) return;
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:";
  document.cookie = buildSetCookie(COOKIE_NAME, "", {
    domain: SHARED_SESSION_DOMAIN,
    secure,
    maxAge: 0,
  });
}
