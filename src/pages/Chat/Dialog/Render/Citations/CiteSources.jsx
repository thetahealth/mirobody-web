import { useState } from "react";
import { message } from "antd";
import { useTranslation } from "react-i18next";
import { useCitationStore } from "./store";
import { useCitationSession } from "./context";
import { flagOf, sectionsOf, spanOf, when } from "./sources";
import { openProtectedFile } from "../../../../../utils/protectedFile";
import styles from "./index.module.scss";

// Readings shown before "show N more": enough for a before-and-after, few
// enough that the claim stays on screen.
const FIRST = 5;
// An aggregate's members shown before the rest: the server sends up to 50.
const MEMBERS = 8;

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

function Flag({ flag }) {
  const { t } = useTranslation();
  const kind = flagOf(flag);
  if (!kind) return null;
  const label = kind === "high" ? t("cite_flag_high") : kind === "low" ? t("cite_flag_low") : kind;
  return <span className={styles.flag}>{label}</span>;
}

function Reading({ row }) {
  const { t } = useTranslation();
  return (
    <li className={styles.reading}>
      <div className={styles.line}>
        <span className={styles.value}>
          {row.value}
          {row.unit ? ` ${row.unit}` : ""}
        </span>
        <Flag flag={row.flag} />
        {row.ref ? <span className={styles.muted}>{t("cite_ref_range", { range: row.ref })}</span> : null}
      </div>
      <div className={styles.muted}>
        {when(row.time)}
        {row.time ? " · " : ""}
        <Source row={row} />
      </div>
    </li>
  );
}

function More({ hidden, onClick }) {
  const { t } = useTranslation();
  if (hidden <= 0) return null;
  return (
    <button type="button" className={styles.more} onClick={onClick}>
      {t("cite_show_more", { count: hidden })}
    </button>
  );
}

function Readings({ section }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const items = all ? section.items : section.items.slice(0, FIRST);
  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <span className={styles.name}>{section.name}</span>
        {section.items.length > 1 ? (
          <span className={styles.muted}>{t("cite_count", { count: section.items.length })}</span>
        ) : null}
      </header>
      <ul className={styles.list}>
        {items.map((row) => (
          <Reading key={row.id} row={row} />
        ))}
      </ul>
      <More hidden={section.items.length - items.length} onClick={() => setAll(true)} />
    </section>
  );
}

// A statistic or a time bucket: what it was computed over, with the
// readings it covered, newest first, the name said once.
function Aggregate({ row }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const readings = row.readings || [];
  const shown = all ? readings : readings.slice(0, MEMBERS);
  const total = row.total ?? readings.length;
  const span = spanOf(row);
  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <span className={styles.name}>{row.indicator}</span>
        <span className={styles.muted}>
          {span ? `${span} · ` : ""}
          {t("cite_readings_n", { count: total })}
        </span>
      </header>
      <ul className={styles.members}>
        {shown.map((r, i) => (
          <li key={i}>
            <span className={styles.muted}>{when(r.time)}</span>
            <span className={styles.value}>
              {r.value}
              {r.unit ? ` ${r.unit}` : ""}
            </span>
            <Flag flag={r.flag} />
          </li>
        ))}
      </ul>
      <More hidden={readings.length - shown.length} onClick={() => setAll(true)} />
      {total > readings.length && shown.length === readings.length ? (
        <div className={styles.muted}>{t("cite_members_shown", { shown: readings.length, total })}</div>
      ) : null}
    </section>
  );
}

// A medical-knowledge passage: public, so it opens in a new tab.
function Reference({ row }) {
  const { t } = useTranslation();
  return (
    <section className={styles.section}>
      <div className={styles.name}>{row.title}</div>
      <div className={styles.muted}>
        {row.source} ·{" "}
        <a className={styles.file} href={row.url} target="_blank" rel="noopener noreferrer">
          {t("cite_open_source")}
        </a>
      </div>
    </section>
  );
}

function Status({ status }) {
  const { t } = useTranslation();
  const text = { loading: t("cite_loading"), gone: t("cite_gone") }[status] || t("cite_unknown");
  return <div className={`${styles.section} ${styles.muted}`}>{text}</div>;
}

/** Everything one group of cites rests on, under the words it was drawn on. */
export default function CiteSources({ ids, quote }) {
  const { t } = useTranslation();
  const sessionId = useCitationSession();
  const resolved = useCitationStore((s) => s.resolved[sessionId]);
  const sections = sectionsOf(ids, resolved);
  return (
    <div className={styles.sources}>
      {quote ? <blockquote className={styles.quote}>{quote}</blockquote> : null}
      {sections.map((section) => {
        if (section.type === "readings") return <Readings key={`n:${section.name}`} section={section} />;
        if (section.type === "aggregate") return <Aggregate key={section.id} row={section.row} />;
        if (section.type === "ref") return <Reference key={section.id} row={section.row} />;
        if (section.type === "lines")
          return (
            <section key={section.id} className={styles.section}>
              <div className={styles.name}>{section.file}</div>
              <div className={styles.muted}>
                {section.end > section.start
                  ? t("cite_lines", { start: section.start, end: section.end })
                  : t("cite_line", { start: section.start })}
              </div>
            </section>
          );
        return <Status key={section.id} status={section.status} />;
      })}
    </div>
  );
}
