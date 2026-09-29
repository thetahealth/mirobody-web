import { useEffect, useState } from "react";
import { Empty, Spin, message } from "antd";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { sourceLabelKey } from "./delta";
import styles from "./RecordsList.module.scss";

const PAGE_SIZE = 50;

/**
 * Every visible entry across indicators, newest observed first, one page at a
 * time. With `createdSince` (from "Added since your last visit") it lists
 * exactly the entries that count counted, logged complaints included, which
 * is why that view asks for `kind=all`.
 *
 * Mounted once per person viewed and per filter (the page keys it), so paging
 * starts at the first page whenever either changes.
 */
const RecordsList = ({ userId, createdSince = null, onClearSince, canExport = false }) => {
  const { t } = useTranslation();
  const [page, setPage] = useState({ rows: [], total: 0, loading: true });
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = { target_user_id: userId, limit: PAGE_SIZE, offset };
    if (createdSince) Object.assign(params, { created_since: createdSince, kind: "all" });
    api.getIndicatorRecords(params, controller.signal)
      .then((result) => setPage({ rows: result?.rows || [], total: Number(result?.total) || 0, loading: false }))
      .catch(() => {
        if (!controller.signal.aborted) setPage({ rows: [], total: 0, loading: false });
      });
    return () => controller.abort();
  }, [offset, userId, createdSince]);

  const exportAll = async () => {
    setExporting(true);
    try {
      const blob = await api.exportIndicatorRecords({ target_user_id: userId });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mirobody-indicators.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error(t("records_export_failed"));
    } finally {
      setExporting(false);
    }
  };

  const { rows, total, loading } = page;
  if (loading) return <div className={styles.center}><Spin /></div>;
  if (!rows.length && offset === 0 && !createdSince) {
    return <div className={styles.empty}><Empty description={t("records_empty")} /></div>;
  }
  return (
    <section className={styles.panel} aria-label={t("records_title")}>
      <div className={styles.heading}>
        <div>
          <h2>{t("records_title")}</h2>
          <span>{t("records_count", { count: total })}</span>
        </div>
        <div className={styles.tools}>
          {createdSince && (
            <button type="button" className={styles.filter} onClick={onClearSince}>
              {t("records_since_filter")} ✕
            </button>
          )}
          {canExport && (
            <button type="button" className={styles.export} onClick={exportAll} disabled={exporting}>
              {t("records_export")}
            </button>
          )}
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>{t("indicator")}</th>
              <th>{t("records_value")}</th>
              <th>{t("records_date")}</th>
              <th>{t("records_source")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row_id}>
                <td>{row.indicator || row.name}</td>
                <td>{row.value || row.text || "—"}{row.value && row.unit ? ` ${row.unit}` : ""}</td>
                <td>{row.date}</td>
                <td>{sourceLabelKey(row.source_kind) ? t(sourceLabelKey(row.source_kind)) : row.source_kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pager}>
        <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
          {t("previous")}
        </button>
        <span>{Math.floor(offset / PAGE_SIZE) + 1}</span>
        <button type="button" disabled={offset + rows.length >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
          {t("next")}
        </button>
      </div>
    </section>
  );
};

export default RecordsList;
