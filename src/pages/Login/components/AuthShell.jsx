import styles from "./AuthShell.module.scss";
// Inline, not <img>: their ink is currentColor, so the mark is dark on the
// cream page and light on the dark one. An <img> cannot inherit a colour.
import BrandIcon from "../../../assets/mirobody-icon.svg?react";
import Wordmark from "../../../assets/logo-wordmark.svg?react";

/**
 * Auth page chrome — flat warm-cream canvas + centered column with the official
 * Mirobody wordmark lockup. Used by the login page; the entry and second login
 * pages this once claimed to serve are gone, so it has one consumer today.
 *
 * Props:
 *  - title:     alt text for the wordmark (default "Mirobody")
 *  - subtitle:  one line under the wordmark
 *  - brandPill: optional small ink pill beside the wordmark (e.g. a product
 *               name, when a sibling app reuses this shell)
 *  - size:      "hero" (entry) | "compact" (logins, default)
 *  - topbar:    optional node pinned across the top (logo + nav)
 *  - actions:   optional node pinned top-right
 *  - footer:    optional node centered below the content (e.g. a cross-link)
 *  - children:  the auth surface (card / cards)
 */
export default function AuthShell({
  title = "Mirobody",
  subtitle,
  brandPill,
  brandHref,
  size = "compact",
  topbar,
  actions,
  footer,
  children,
}) {
  const brandMark = (
    <span className={styles.brandLock}>
      <BrandIcon className={styles.brandIcon} aria-hidden="true" />
      <Wordmark className={styles.brandWordmark} role="img" aria-label={title} />
      {brandPill && <span className={styles.brandPill}>{brandPill}</span>}
    </span>
  );
  return (
    <div className={styles.shell}>
      {topbar && <header className={styles.topbar}>{topbar}</header>}
      {actions && <div className={styles.actions}>{actions}</div>}
      <main className={styles.inner}>
        <div className={`${styles.brand} ${size === "hero" ? styles.hero : ""}`}>
          {brandHref ? (
            <a href={brandHref} className={styles.brandLink} aria-label={title}>
              {brandMark}
            </a>
          ) : (
            brandMark
          )}
          {subtitle && <p className={styles.brandSubtitle}>{subtitle}</p>}
        </div>
        {children}
        {footer && <div className={styles.footer}>{footer}</div>}
      </main>
    </div>
  );
}
