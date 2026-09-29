import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { sourceChips, sourceLabelKey, visitCursor } from "./delta";
import styles from "./RecentRecords.module.scss";

/**
 * "Added since your last visit": a count by source, and a way into the rows.
 *
 * Mounted once per person viewed (the page keys it on the person), so the
 * cursor is read once per mount and a re-render cannot use it up. The first
 * visit has nothing to compare with: it records the cursor and shows nothing.
 * The block also stays hidden when nothing is new.
 */
const RecentRecords = ({ userId, onViewDetails }) => {
  const { t } = useTranslation();
  const [{ since, record }] = useState(() => visitCursor(userId));
  const [delta, setDelta] = useState(null);

  useEffect(() => {
    if (!since) {
      record();
      return undefined;
    }
    const controller = new AbortController();
    api.getDataDelta({ target_user_id: userId, since }, controller.signal)
      .then((data) => {
        setDelta(data);
        record();
      })
      .catch(() => {
        // Leave the cursor where it was: a failed count must not hide what is new.
      });
    return () => controller.abort();
  }, [since, record, userId]);

  const chips = sourceChips(delta?.by_source);
  if (!delta || !delta.total_new) return null;
  return (
    <section className={styles.panel} aria-label={t("data_delta_title")}>
      <div className={styles.header}>
        <div>
          <h2>{t("data_delta_title")}</h2>
          <p>{t("data_delta_subtitle")}</p>
        </div>
        {onViewDetails && (
          <button type="button" className={styles.details} onClick={() => onViewDetails(since)}>
            {t("data_delta_view_details")}
          </button>
        )}
      </div>
      <div className={styles.summary}>{t("data_delta_summary", { count: delta.total_new })}</div>
      <div className={styles.chips}>
        {chips.map((c) => (
          <span className={styles.chip} key={c.name}>
            {sourceLabelKey(c.name) ? t(sourceLabelKey(c.name)) : c.name} · {c.count}
          </span>
        ))}
      </div>
    </section>
  );
};

export default RecentRecords;
