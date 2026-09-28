import { useCallback, useEffect, useState } from "react";
import { Empty, Spin } from "antd";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { useDriveStore } from "../../store/Drive";
import styles from "./RecordsList.module.scss";

const PAGE_SIZE = 50;

const RecordsList = ({ canExport = false }) => {
  const { t } = useTranslation();
  const userId = useDriveStore((state) => state.current_drive_user_id);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getIndicatorRecords({ target_user_id: userId, limit: PAGE_SIZE, offset });
      setRows(result?.rows || []);
      setTotal(Number(result?.total) || 0);
    } finally {
      setLoading(false);
    }
  }, [offset, userId]);

  useEffect(() => { load().catch(() => setRows([])); }, [load]);

  const exportAll = async () => {
    const blob = await api.exportIndicatorRecords({ target_user_id: userId });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mirobody-indicators.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className={styles.center}><Spin /></div>;
  if (!rows.length && offset === 0) return <div className={styles.empty}><Empty description={t("records_empty")} /></div>;
  return (
    <section className={styles.panel} aria-label={t("records_title")}>
      <div className={styles.heading}>
        <div><h2>{t("records_title")}</h2><span>{t("records_count", { count: total })}</span></div>
        {canExport && <button className={styles.export} onClick={exportAll}>{t("records_export")}</button>}
      </div>
      <div className={styles.tableWrap}><table><thead><tr><th>{t("indicator")}</th><th>{t("records_value")}</th><th>{t("records_date")}</th><th>{t("records_source")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.row_id}><td>{row.indicator || row.name}</td><td>{row.value || row.text || "—"}{row.unit ? ` ${row.unit}` : ""}</td><td>{row.date}</td><td>{row.source_kind}</td></tr>)}</tbody></table></div>
      <div className={styles.pager}><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{t("previous")}</button><span>{Math.floor(offset / PAGE_SIZE) + 1}</span><button disabled={offset + rows.length >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>{t("next")}</button></div>
    </section>
  );
};

export default RecordsList;
