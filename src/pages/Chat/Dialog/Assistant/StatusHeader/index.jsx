import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";
import { LINE_ERROR, statusLineFor } from "./statusLine";

/**
 * The line above an answer. What it says lives in `statusLine.js`, a pure
 * function of the messages tested there; most of the time it says nothing.
 */
const StatusHeader = ({ datasource }) => {
  const { t } = useTranslation();
  const { kind, key } = statusLineFor(datasource);
  if (!key) return null;

  return (
    <div className={kind === LINE_ERROR ? `${styles.line} ${styles.line_error}` : styles.line} role="status">
      {kind === LINE_ERROR ? (
        <IconAlertTriangle size={14} stroke={1.8} className={styles.errorIcon} aria-hidden="true" />
      ) : (
        <span className={styles.pulse} aria-hidden="true" />
      )}
      <span className={kind === LINE_ERROR ? styles.text : `${styles.text} ${styles.shimmer}`}>{t(key)}</span>
    </div>
  );
};

export default StatusHeader;
