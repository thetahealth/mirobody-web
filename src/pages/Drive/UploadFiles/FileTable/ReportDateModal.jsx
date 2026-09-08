// ReportDateModal — "which report date?" for one uploaded document (#53).
// Offered answers: a date the same upload already carries, a typed date, or
// "keep the upload day" (an answer too: it stops the prompt without touching a
// reading). Mount with key={file.file_key} so switching files starts clean.
import { useState } from "react";
import { Button, message } from "antd";
import { useTranslation } from "react-i18next";
import consola from "consola";
import Modal from "../../../../components/Modal";
import api from "../../../../api";
import { needsDateConfirm, reportDateOf, siblingReportDates } from "./reportDate";
import styles from "./ReportDateModal.module.scss";

const ReportDateModal = ({ file, siblings, onClose, onDone }) => {
  const { t } = useTranslation();
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  if (!file) return null;

  const pending = needsDateConfirm(file);
  const candidates = siblingReportDates(siblings, file);
  const today = new Date().toISOString().slice(0, 10);

  const submit = async (date) => {
    setBusy(true);
    try {
      const d = await api.setFileReportDate({
        file_key: file.file_key,
        report_date: date || undefined,
      });
      if (!date) {
        message.success(t("report_date_kept"));
      } else if ((d?.skipped ?? 0) > 0) {
        message.success(t("report_date_moved_skipped", { n: d.moved ?? 0, skipped: d.skipped, date }));
      } else {
        message.success(t("report_date_moved", { n: d?.moved ?? 0, date }));
      }
      onDone?.();
    } catch (error) {
      consola.error("ERROR: setFileReportDate", error);
      message.error(t("update_failed"));
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose}>
      <div className={styles.card}>
        <div className={styles.title}>{t("set_report_date")}</div>
        <div className={styles.fileName}>{file.file_name}</div>
        <p className={styles.text}>
          {pending
            ? t("report_date_ask", { date: reportDateOf(file) })
            : t("report_date_current", { date: reportDateOf(file) || "-" })}
        </p>
        {candidates.length > 0 && (
          <div className={styles.chips}>
            {candidates.map((d) => (
              <Button key={d} disabled={busy} onClick={() => submit(d)}>
                {t("report_date_use_sibling", { date: d })}
              </Button>
            ))}
          </div>
        )}
        <div className={styles.row}>
          <input
            type="date"
            className={styles.dateInput}
            value={picked}
            max={today}
            aria-label={t("report_date")}
            onChange={(e) => setPicked(e.target.value)}
          />
          <Button type="primary" disabled={busy || !picked} onClick={() => submit(picked)}>
            {t("report_date_apply")}
          </Button>
        </div>
        <div className={styles.footer}>
          {pending && (
            <Button disabled={busy} onClick={() => submit("")}>
              {t("report_date_keep")}
            </Button>
          )}
          <Button disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReportDateModal;
