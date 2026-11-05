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
 *
 * **Why a 200 is checked.** Because the type comes from the file name and not
 * from the response, a 200 that is not the file still opened: a reverse proxy
 * that answers `/files/` with the app's own index.html, or with a login page,
 * showed an empty PDF viewer and no error. The body is checked against what
 * the file should be before a tab is pointed at it.
 *
 * **Why there is a timeout.** The tab is open before the request starts, so a
 * request that never finishes left it on about:blank for good, with no toast.
 */

import { ACCESS_TOKEN } from "../enum/storage";
import { getApiBaseUrl } from "./index";

/**
 * The longest a file may take, headers and body together. The upload limit is
 * 20 MB (`MAX_FILE_SIZE`), which needs about 2.8 Mbit/s to arrive in a minute,
 * and a minute is nginx's default `proxy_read_timeout`: behind a proxy, a
 * request with no answer by then is not going to get one.
 */
export const FILE_FETCH_TIMEOUT_MS = 60_000;

/**
 * Viewers accept a PDF whose header is anywhere in its first 1024 bytes (PDF
 * 1.7 reference, Appendix H, note 13), so a check at offset 0 would refuse
 * files that open fine.
 */
const PDF_HEADER_WINDOW = 1024;

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
 * Whether a 200 body is the file asked for, or a page standing in for it.
 *
 * A PDF is checked by its bytes. An image by the declared type, which the
 * backend derives from the stored key's extension; any `image/` is accepted
 * because the browser sniffs the format, and the forced blob type, not this
 * check, is what keeps an svg from running. Anything else only has to not be
 * HTML, so a `.csv` does not open as the app's own markup or a `.docx` does
 * not download as a login page.
 */
const isTheFile = (ext, contentType, bytes) => {
  if (ext === "pdf") {
    const head = String.fromCharCode(...bytes.subarray(0, PDF_HEADER_WINDOW));
    return head.includes("%PDF-");
  }
  if (INLINE_TYPES[ext]?.startsWith("image/")) return contentType.startsWith("image/");
  return ext === "html" || ext === "htm" || !contentType.startsWith("text/html");
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FILE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(resolveFileUrl(keyOrUrl), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (tab) tab.close();
      // 404 covers "not yours" as well as "not there" — the backend answers
      // both identically on purpose, so a key cannot be probed for existence.
      return response.status === 401
        ? "file_view_unauthorized"
        : "file_view_unavailable";
    }

    // Still under the signal: a body that stalls after the headers leaves the
    // tab as blank as headers that never come.
    const bytes = new Uint8Array(await response.arrayBuffer());
    const ext = extensionOf(fileName || keyOrUrl);
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!isTheFile(ext, contentType, bytes)) {
      if (tab) tab.close();
      return "file_view_not_file";
    }

    const safeType = INLINE_TYPES[ext] || "application/octet-stream";
    const url = URL.createObjectURL(new Blob([bytes], { type: safeType }));

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
    // A timeout lands here too: the abort rejects the pending fetch or read.
    if (tab) tab.close();
    return "file_view_unavailable";
  } finally {
    clearTimeout(timer);
  }
};
