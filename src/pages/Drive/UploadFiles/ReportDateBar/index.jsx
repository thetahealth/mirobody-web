// ReportDateBar — "which date?" asked the moment extraction knows a file
// showed none (#53). Non-blocking, above the file table, one bar per upload
// selection; stays until answered (it is a decision, not a notice). The
// default is the date another file of the same selection carries, shown as
// the primary button — one tap — never applied on its own. Every answer is
// reversible: the toast offers an undo, which files the readings back.
import { useState } from "react";
import { Button, message } from "antd";
import { useTranslation } from "react-i18next";
import consola from "consola";
import api from "../../../../api";
import { useUploadStore } from "../../../../store/upload";
import { pendingBatches } from "./pendingBatches";
import styles from "./index.module.scss";

const today = () => new Date().toISOString().slice(0, 10);

function Batch({ batch }) {
  const { t } = useTranslation();
  const clearPendingDates = useUploadStore((s) => s.clearPendingDates);
  const fetchFileList = useUploadStore((s) => s.fetchFileList);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);

  const keys = batch.pending.map((p) => p.file_key);
  const names = batch.pending.map((p) => p.file_name).filter(Boolean);
  const primary = batch.candidates[0];

  const apply = async (date) => {
    setBusy(true);
    try {
      const results = await Promise.all(
        keys.map((file_key) => api.setFileReportDate({ file_key, report_date: date || undefined })),
      );
      const moved = results.reduce((n, r) => n + (r?.moved ?? 0), 0);
      const skipped = results.reduce((n, r) => n + (r?.skipped ?? 0), 0);
      clearPendingDates(keys);
      fetchFileList();
      if (!date) {
        message.success(t("report_date_kept"));
        return;
      }
      const undo = async () => {
        try {
          await Promise.all(
            keys.map((file_key) =>
              api.setFileReportDate({ file_key, report_date: batch.uploadDay || today() }),
            ),
          );
          fetchFileList();
          message.success(t("report_date_undone", { date: batch.uploadDay || today() }));
        } catch (error) {
          consola.error("ERROR: undo setFileReportDate", error);
          message.error(t("update_failed"));
        }
      };
      message.success({
        duration: 8,
        content: (
          <span>
            {skipped > 0
              ? t("report_date_moved_skipped", { n: moved, skipped, date })
              : t("report_date_moved", { n: moved, date })}
            <Button type="link" size="small" className={styles.undo} onClick={undo}>
              {t("report_date_undo")}
            </Button>
          </span>
        ),
      });
    } catch (error) {
      consola.error("ERROR: setFileReportDate", error);
      message.error(t("update_failed"));
      setBusy(false);
    }
  };

  const text =
    batch.pending.length === 1
      ? t("report_date_bar_one", { name: names[0] || "", date: batch.uploadDay })
      : t("report_date_bar_many", { n: batch.pending.length, total: batch.total, date: batch.uploadDay });

  return (
    <div className={styles.bar} role="status">
      <div className={styles.text}>
        {text}
        {primary && <span className={styles.hint}> {t("report_date_bar_sibling", { date: primary })}</span>}
      </div>
      <div className={styles.actions}>
        {batch.candidates.map((d, i) => (
          <Button key={d} type={i === 0 ? "primary" : "default"} disabled={busy} onClick={() => apply(d)}>
            {t("report_date_bar_use", { date: d })}
          </Button>
        ))}
        <input
          type="date"
          className={styles.dateInput}
          value={picked}
          max={today()}
          aria-label={t("report_date")}
          onChange={(e) => setPicked(e.target.value)}
        />
        <Button type={primary ? "default" : "primary"} disabled={busy || !picked} onClick={() => apply(picked)}>
          {t("report_date_apply")}
        </Button>
        <Button disabled={busy} onClick={() => apply("")}>
          {t("report_date_keep")}
        </Button>
      </div>
    </div>
  );
}

const ReportDateBar = () => {
  const pendingDates = useUploadStore((s) => s.pending_dates);
  const batches = pendingBatches(pendingDates);
  if (batches.length === 0) return null;
  return (
    <div className={styles.wrap}>
      {batches.map((b) => (
        <Batch key={b.sessionId} batch={b} />
      ))}
    </div>
  );
};

export default ReportDateBar;
