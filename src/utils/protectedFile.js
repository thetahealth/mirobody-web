/**
 * Opening a file the backend now protects.
 *
 * `GET /files/<key>` used to be unauthenticated: anyone who knew or guessed a
 * key got the bytes, and the keys are `<second-resolution timestamp>_<8 hex>`.
 * It serves health reports, so that was a PHI leak, and it is fixed on the
 * backend — the route requires a token and checks that the caller owns the
 * file or has care-circle access to it.
 *
 * A bare `<a href="/files/...">` therefore 401s now. A browser cannot put an
 * Authorization header on a navigation, an `<img src>` or a PDF embed, so the
 * file has to be fetched by script and handed to the tab as a blob.
 *
 * **Why not `?access_token=` in the URL.** The backend accepts it, for clients
 * that genuinely cannot do this (embeds, curl). We do not use it here: a token
 * in a URL lands in browser history, in the address bar over someone's
 * shoulder, in `Referer` on any sub-resource the viewer loads, and in every
 * access log between here and the server. That is the same class of leak the
 * backend fix just closed.
 *
 * **Why the MIME type is forced.** A blob: URL inherits the origin of the page
 * that created it, so opening an uploaded `.svg` or `.xml` as its own type
 * would execute its script on our origin with the user's session — turning an
 * upload into stored XSS. Only formats that cannot execute are rendered
 * inline; everything else is handed over as a download.
 */

import { ACCESS_TOKEN } from "../enum/storage";
import { getApiBaseUrl } from "./index";

/** Types safe to render in place. Deliberately excludes svg and xml. */
const INLINE_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tiff: "image/tiff",
  txt: "text/plain",
  md: "text/plain",
  markdown: "text/plain",
  csv: "text/plain",
};

const extensionOf = (name = "") => {
  const clean = String(name).split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
};

/**
 * Resolve a file key or a (possibly relative) URL into an absolute one.
 * `url_full` from the backend is relative when MCP_PUBLIC_URL is unset, which
 * is the default for a self-hosted deployment.
 */
export const resolveFileUrl = (keyOrUrl) => {
  const s = String(keyOrUrl || "");
  if (/^https?:\/\//i.test(s)) return s;
  const base = getApiBaseUrl() || "";
  const path = s.startsWith("/files/") ? s : `/files/${s.replace(/^\/+/, "")}`;
  return `${base}${path}`;
};

/**
 * Fetch a protected file and show it in a new tab.
 *
 * The tab is opened SYNCHRONOUSLY, before the await. Opening it afterwards is
 * a popup-blocker trigger in every browser, because by then the call is no
 * longer attributable to the user's click.
 *
 * @returns {Promise<null|string>} null on success, else a reason key for i18n.
 */
export const openProtectedFile = async (keyOrUrl, fileName = "") => {
  const token = localStorage.getItem(ACCESS_TOKEN);
  if (!token) return "file_view_unauthorized";

  const tab = window.open("", "_blank");

  try {
    const response = await fetch(resolveFileUrl(keyOrUrl), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (tab) tab.close();
      // 404 covers "not yours" as well as "not there" — the backend answers
      // both identically on purpose, so a key cannot be probed for existence.
      return response.status === 401
        ? "file_view_unauthorized"
        : "file_view_unavailable";
    }

    const raw = await response.blob();
    const ext = extensionOf(fileName || keyOrUrl);
    const safeType = INLINE_TYPES[ext] || "application/octet-stream";
    const url = URL.createObjectURL(new Blob([raw], { type: safeType }));

    if (tab) {
      tab.location = url;
    } else {
      // Popup blocked despite the synchronous open: fall back to a download,
      // which does not need a tab.
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download";
      a.click();
    }

    // Long enough for the tab to load; the blob is held by the browser until
    // then and leaks memory for the session if never revoked.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null;
  } catch {
    if (tab) tab.close();
    return "file_view_unavailable";
  }
};
