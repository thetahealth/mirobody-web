import { useEffect } from "react";
import { Popover, message } from "antd";
import { useTranslation } from "react-i18next";
import { useCitationStore } from "./store";
import { useCitationSession } from "./context";
import { citeKind, linesOf } from "./markup";
import { openProtectedFile } from "../../../../../utils/protectedFile";
import styles from "./index.module.scss";

const day = (time) => (time || "").slice(0, 10);

function Source({ row }) {
  const { t } = useTranslation();
  if (row.source_kind === "file" && row.file_key) {
    // `/files/` needs the session token: fetched and opened as a blob, the way
    // the readings page opens a source document.
    const open = async () => {
      const reason = await openProtectedFile(row.file_key, row.file);
      if (reason) message.error(t(reason));
    };
    return (
      <button type="button" className={styles.file} onClick={open}>
        {row.file || t("cite_open_file")}
      </button>
    );
  }
  if (row.source_kind === "device") return <span>{t("cite_device")}</span>;
  if (row.record_kind && row.record_kind !== "measurement") return <span>{t("cite_reported")}</span>;
  return <span>{t("cite_manual")}</span>;
}

function Reading({ row }) {
  return (
    <div className={styles.reading}>
      {/* A device row's `name` is the vendor's field name; the indicator reads better. */}
      <div className={styles.name}>{row.source_kind === "device" ? row.indicator || row.name : row.name || row.indicator}</div>
      <div className={styles.value}>
        {row.value} {row.unit}
        {row.ref ? <span className={styles.muted}> · {row.ref}</span> : null}
        {row.flag ? <span className={styles.flag}> {row.flag}</span> : null}
      </div>
      <div className={styles.muted}>
        {day(row.time)} · <Source row={row} />
      </div>
    </div>
  );
}

function Details({ id, row }) {
  const { t } = useTranslation();
  const kind = citeKind(id);
  if (kind === "lines") {
    const lines = linesOf(id);
    return (
      <div className={styles.reading}>
        <div className={styles.name}>{lines.path.split("/").pop()}</div>
        <div className={styles.muted}>{t("cite_lines", { start: lines.start, end: lines.end })}</div>
      </div>
    );
  }
  if (kind === "ref") return <div className={styles.muted}>{t("cite_reference", { id })}</div>;
  // `r0` or a made-up form: nothing to look up, so it never resolves.
  if (kind === "unknown") return <div className={styles.muted}>{t("cite_unknown")}</div>;
  if (row === null) return <div className={styles.muted}>{t("cite_private")}</div>;
  if (!row) return <div className={styles.muted}>{t("cite_loading")}</div>;
  if (row.status === "gone") return <div className={styles.muted}>{t("cite_gone")}</div>;
  if (row.status !== "ok") return <div className={styles.muted}>{t("cite_unknown")}</div>;
  if (row.kind === "aggregate") {
    const readings = row.readings || [];
    const span =
      row.period ||
      [row.from || row.first_day, row.to || row.last_day].filter(Boolean).join(" – ");
    return (
      <div className={styles.aggregate}>
        <div className={styles.name}>{row.indicator}</div>
        <div className={styles.muted}>
          {span ? `${span} · ` : ""}
          {t("cite_readings_n", { count: row.total ?? readings.length })}
        </div>
        <div className={styles.members}>
          {readings.slice(0, 8).map((r, i) => (
            <Reading key={i} row={r} />
          ))}
        </div>
      </div>
    );
  }
  return <Reading row={row} />;
}

// One cite in an answer: a numbered chip; what it points at on click.
export default function CiteChip({ id, label }) {
  const sessionId = useCitationSession();
  const row = useCitationStore((s) => s.resolved[sessionId]?.[id]);
  const request = useCitationStore((s) => s.request);
  const isRow = citeKind(id) === "row";
  useEffect(() => {
    if (isRow && sessionId) request(sessionId, id);
  }, [isRow, sessionId, id, request]);
  const gone = citeKind(id) === "unknown" || (row && row.status !== "ok");
  return (
    <Popover
      trigger="click"
      placement="top"
      content={<div className={styles.popover}><Details id={id} row={isRow && !sessionId ? null : row} /></div>}
    >
      <sup
        className={`${styles.chip} ${gone ? styles.chip_gone : ""}`}
        role="button"
        tabIndex={0}
        aria-label={id}
        data-cite={id}
      >
        {label}
      </sup>
    </Popover>
  );
}
