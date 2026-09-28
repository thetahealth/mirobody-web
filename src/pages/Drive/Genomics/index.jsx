import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import api from "../../../api";
import useUpload from "../../../hooks/useUpload";
import { useDriveStore } from "../../../store/Drive";
import getWebSocketManager from "../../../utils/websocket/WebSocketManager";
import { GENOTYPE_ACCEPT, activeSetFromResponse, callRate, geneticUploadEvent, isGenotypeUpload } from "./model";
import styles from "./index.module.scss";

const Genomics = () => {
  const { t, i18n } = useTranslation();
  const userId = useDriveStore((state) => state.current_drive_user_id);
  const { uploadFiles } = useUpload();
  const inputRef = useRef(null);
  const messageRef = useRef(null);
  const [summary, setSummary] = useState({ phase: "loading", set: null });
  const [upload, setUpload] = useState({ phase: "idle", progress: 0 });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.getActiveGenotypeSet({ target_user_id: userId || undefined, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setSummary({ phase: "ready", set: activeSetFromResponse(response) });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const unavailable = error?.response?.status === 404 || error?.code === 404;
        setSummary({ phase: unavailable ? "unavailable" : "error", set: null });
      });
    return () => controller.abort();
  }, [userId, refreshToken]);

  useEffect(() => {
    const manager = getWebSocketManager();
    const onMessage = (type, event, eventUserId) => {
      if (type !== "message" || eventUserId !== userId) return;
      const next = geneticUploadEvent(event, messageRef.current);
      if (!next) return;
      setUpload(next);
      if (next.phase === "complete") {
        messageRef.current = null;
        setSummary({ phase: "loading", set: null });
        setRefreshToken((token) => token + 1);
      } else if (next.phase === "failed") {
        messageRef.current = null;
      }
    };
    manager.addListener(onMessage);
    return () => manager.removeListener(onMessage);
  }, [userId]);

  const onSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isGenotypeUpload(file)) {
      setUpload({ phase: "invalid", progress: 0 });
      return;
    }
    if (!window.confirm(t("genomics_replace_confirm"))) return;
    const messageId = uuidv4();
    messageRef.current = messageId;
    setUpload({ phase: "sending", progress: 0 });
    const result = await uploadFiles(
      [{ file, file_name: file.name, file_size: file.size, file_type: file.type }],
      { query_user_id: userId, messageId },
    );
    if (!result || result[0] !== messageId) {
      if (messageRef.current === messageId) {
        messageRef.current = null;
        setUpload({ phase: "failed", progress: 0 });
      }
    } else {
      setUpload((current) => current.phase === "sending"
        ? { phase: "processing", progress: current.progress }
        : current);
    }
  };

  const set = summary.set;
  const busy = upload.phase === "sending" || upload.phase === "processing";
  const source = set?.vendor || set?.format_id;
  const build = set?.build_detected && set.build_detected !== "unknown"
    ? set.build_detected
    : set?.build_declared
      ? t("genomics_build_declared_only", { build: set.build_declared })
      : t("genomics_unknown");
  const number = (value) => new Intl.NumberFormat(i18n.language).format(value);

  return (
    <section className={styles.section} aria-labelledby="genomics-title">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{t("genomics_tab")}</p>
        <h2 id="genomics-title">{t("genomics_title")}</h2>
        <p>{t("genomics_intro")}</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.panel}>
          <h3>{t("genomics_upload_title")}</h3>
          <p>{t("genomics_formats")}</p>
          <p className={styles.replacement}>{t("genomics_replace_note")}</p>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            accept={GENOTYPE_ACCEPT}
            onChange={onSelect}
            aria-label={t("genomics_choose_file")}
            disabled={busy || !userId}
          />
          <button
            type="button"
            className={styles.button}
            onClick={() => inputRef.current?.click()}
            disabled={busy || !userId}
          >
            {t("genomics_choose_file")}
          </button>
          <div className={styles.status} role="status" aria-live="polite">
            {upload.phase !== "idle" && (
              <span>
                {t(`genomics_upload_${upload.phase}`)}
                {busy && ` ${Math.round(upload.progress)}%`}
              </span>
            )}
            {busy && (
              <progress
                className={styles.progress}
                value={upload.progress}
                max="100"
                aria-label={t("genomics_upload_progress")}
              />
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.cardHeading}>
            <h3>{t("genomics_active_title")}</h3>
            {set && <span className={styles.badge}>{t("genomics_active")}</span>}
          </div>
          {summary.phase === "loading" && !set && <p role="status">{t("genomics_loading")}</p>}
          {summary.phase === "unavailable" && <p role="status">{t("genomics_pending_endpoint")}</p>}
          {summary.phase === "error" && <p role="alert">{t("genomics_load_error")}</p>}
          {summary.phase === "ready" && !set && <p>{t("genomics_no_data")}</p>}
          {set && (
            <dl className={styles.facts}>
              <div><dt>{t("genomics_source")}</dt><dd>{source || t("genomics_unknown")}</dd></div>
              <div><dt>{t("genomics_build")}</dt><dd>{build}</dd></div>
              <div><dt>{t("genomics_sites")}</dt><dd>{number(set.n_rows)}</dd></div>
              <div><dt>{t("genomics_call_rate")}</dt><dd>{callRate(set)}%</dd></div>
              {set.sex_inferred && set.sex_inferred !== "unknown" && (
                <div><dt>{t("genomics_inferred_sex")}</dt><dd>{t(`genomics_sex_${set.sex_inferred}`)}</dd></div>
              )}
              {Number.isInteger(set.pgx_decidable_genes) && (
                <div><dt>{t("genomics_pgx_genes")}</dt><dd>{number(set.pgx_decidable_genes)}</dd></div>
              )}
            </dl>
          )}
          {busy && set && <p className={styles.replacement}>{t("genomics_old_set_active")}</p>}
        </div>
      </div>
    </section>
  );
};

export default Genomics;
