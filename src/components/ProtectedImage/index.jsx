import { useEffect, useState } from "react";
import { ACCESS_TOKEN } from "../../enum/storage";
import { resolveFileUrl } from "../../utils/protectedFile";

/**
 * An <img> for a source that may be behind authentication.
 *
 * `GET /files/<key>` requires a token now — it used to hand anyone's health
 * reports to anyone who named the key. A browser sends no Authorization header
 * on an `<img src>`, so a plain img against `/files/` renders as a broken
 * image. This fetches the bytes with the session token and points the img at
 * an object URL instead.
 *
 * Anything that is NOT a `/files/` URL — a `data:` chart, a `blob:`, an
 * absolute URL to some other host — is passed straight through. Chart images
 * arrive as data URLs, so routing them through fetch would be pure overhead.
 *
 * The blob is created with an explicit image MIME type. A blob: URL inherits
 * this page's origin, and `.svg` is an uploadable extension, so handing one
 * back as `image/svg+xml` would run its script here with the user's session.
 * `<img>` cannot execute what it is given, but the type is pinned anyway so a
 * future caller that opens this URL in a tab does not inherit the hole.
 */
const PASSTHROUGH = /^(data:|blob:)/i;

const ProtectedImage = ({ src, alt = "", className, onClick, ...rest }) => {
  const [resolved, setResolved] = useState(() =>
    PASSTHROUGH.test(src || "") ? src : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) return undefined;
    if (PASSTHROUGH.test(src)) {
      setResolved(src);
      return undefined;
    }

    let objectUrl = null;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(resolveFileUrl(src), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN)}`,
          },
        });
        if (!response.ok) throw new Error(String(response.status));
        const raw = await response.blob();
        // Never trust the stored type for rendering; see the note above.
        const type = raw.type.startsWith("image/") && raw.type !== "image/svg+xml"
          ? raw.type
          : "image/png";
        objectUrl = URL.createObjectURL(new Blob([raw], { type }));
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setResolved(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      // Revoked on unmount, not on a timer: an unrevoked object URL holds the
      // decoded bytes for the lifetime of the document, and a long chat
      // scrollback is exactly where that adds up.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src || failed || !resolved) {
    // No placeholder box: these sit inline in a chat bubble and a grey square
    // that never resolves is worse than nothing.
    return null;
  }

  return (
    <img src={resolved} alt={alt} className={className} onClick={onClick} {...rest} />
  );
};

export default ProtectedImage;
