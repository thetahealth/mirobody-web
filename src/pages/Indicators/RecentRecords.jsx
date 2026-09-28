import { useEffect, useState } from "react";
import { Spin } from "antd";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { useDriveStore } from "../../store/Drive";
import styles from "./RecentRecords.module.scss";

const cursorKey = (userId) => `mirobody:last-data-visit:${userId || "self"}`;

const RecentRecords = () => {
  const { t } = useTranslation();
  const userId = useDriveStore((state) => state.current_drive_user_id);
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const now = new Date().toISOString();
    const since = localStorage.getItem(cursorKey(userId));
    const params = { target_user_id: userId, limit: 25 };
    if (since) params.created_since = since;
    Promise.all([
      since ? api.getDataDelta({ target_user_id: userId, since }) : Promise.resolve(null),
      api.getIndicatorRecords(params),
    ]).then(([delta, records]) => {
      if (cancelled) return;
      setData(delta);
      setRows(records?.rows || []);
      localStorage.setItem(cursorKey(userId), now);
    }).catch(() => {
      if (!cancelled) setRows([]);
    });
    return () => { cancelled = true; };
  }, [userId]);

  if (!data && rows.length === 0) return null;
  return (
    <section className={styles.panel} aria-label={t("data_delta_title")}>
      <div className={styles.header}>
        <div><h2>{t("data_delta_title")}</h2><p>{t("data_delta_subtitle")}</p></div>
        {!data && <Spin size="small" />}
      </div>
      {data && <div className={styles.summary}>{t("data_delta_summary", { count: data.total_new })}</div>}
      {rows.length > 0 && <div className={styles.rows}>{rows.map((row) => <div className={styles.row} key={`${row.row_id}-${row.created_at}`}><span>{row.indicator || row.name}</span><span>{row.value || row.text || "—"}{row.unit ? ` ${row.unit}` : ""}</span><time>{row.date}</time></div>)}</div>}
    </section>
  );
};

export default RecentRecords;
