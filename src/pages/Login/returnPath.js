// Where a sign-in returns to when a page of this app sent the person to log in
// (`/login?redirect=/setup`). Framework-free so it unit-tests under the repo's
// node-env vitest setup, like `password.js` beside it.
//
// `isAllowedRedirect` (utils/sharedSession.js) takes absolute URLs to a
// sibling app only, and refuses a bare path by design; this takes the bare
// path. Only one on this origin: to a browser `//host/x` and `/\host/x` are
// URLs on another host, so the path is resolved against a placeholder origin
// and anything that leaves it is refused.

const HERE = "http://in-app.invalid";

// Signing in and landing on the sign-in page again is a loop, not a return.
const SIGN_IN_PATHS = ["/login", "/mcplogin"];

/**
 * @param {unknown} raw - the `redirect` query value
 * @returns {string} a path (with its query and hash) on this origin, or ""
 */
export function inAppPath(raw) {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "";
  let url;
  try {
    url = new URL(raw, HERE);
  } catch {
    return "";
  }
  if (url.origin !== HERE || SIGN_IN_PATHS.includes(url.pathname)) return "";
  return url.pathname + url.search + url.hash;
}

/** The login page, returning to `path` once signed in. */
export const loginReturningTo = (path) => `/login?redirect=${encodeURIComponent(path)}`;
