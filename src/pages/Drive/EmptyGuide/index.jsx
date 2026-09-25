import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";

/**
 * What /data puts above its tabs while the record is empty.
 *
 * Someone with no data lands here instead of on 指标 (router/Landing.jsx), so
 * this is the first thing a new account sees. It names the ways in and each
 * one opens the tab that does it — the tabs below are the same doors, but a
 * row of tab labels does not say "start here".
 *
 * A report and a photo are two entries even though both are the upload tab:
 * people think of a PDF from the clinic and a phone picture of a lab sheet as
 * different things, and the upload takes both. An entry whose tab is switched
 * off (journal flag, no device providers configured) is left out rather than
 * shown disabled.
 */
const EmptyGuide = ({ showJournal, showSources, onOpen }) => {
  const { t } = useTranslation();
  const entries = [
    { key: "report", tab: "upload_files" },
    { key: "image", tab: "upload_files" },
    ...(showJournal ? [{ key: "journal", tab: "records" }] : []),
    ...(showSources ? [{ key: "device", tab: "connect_data_source" }] : []),
  ];

  return (
    <section className={styles.guide} aria-labelledby="drive-empty-guide-title">
      <h2 id="drive-empty-guide-title" className={styles.title}>
        {t("drive_empty_title")}
      </h2>
      <p className={styles.body}>{t("drive_empty_body")}</p>
      <div className={styles.entries}>
        {entries.map(({ key, tab }) => (
          <button
            key={key}
            type="button"
            className={styles.entry}
            onClick={() => onOpen(tab)}
          >
            <span className={styles.entry_label}>{t(`drive_empty_${key}`)}</span>
            <span className={styles.entry_hint}>
              {t(`drive_empty_${key}_hint`)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default EmptyGuide;
