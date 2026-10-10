import { useTranslation } from "react-i18next";
import { IconActivity, IconFileText, IconBook2, IconAlertCircle } from "@tabler/icons-react";
import consola from "consola";
import styles from "./index.module.scss";
import { classifyCiteToken, refSourceShort, rowLabel } from "./parse";
import { resolveFileKey, useCiteRegistry } from "./registry";
import { openProtectedFile } from "../../../../../utils/protectedFile";

const KIND_ICON = {
  rid: IconActivity,
  file: IconFileText,
  ref: IconBook2,
  unknown: IconAlertCircle,
};

/** One pipe-table row as a readable tooltip: `key=value` pairs, rid first. */
function rowTooltip(row) {
  return Object.entries(row)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join("  ");
}

function describe(token, registry, t) {
  const c = classifyCiteToken(token);
  if (c.kind === "rid") {
    const row = registry.rids[c.rid];
    if (!row) {
      return { label: `${c.rid} · ${t("cite_unverified")}`, title: c.raw, unverified: true };
    }
    return { label: rowLabel(row) || c.rid, title: rowTooltip(row), row };
  }
  if (c.kind === "file") {
    const span = c.lineEnd > c.lineStart ? `L${c.lineStart}-L${c.lineEnd}` : `L${c.lineStart}`;
    const fileName = c.file.replace(/^\/?(library|uploads)\//, "");
    return { label: fileName, title: `${fileName} · ${span}`, file: c };
  }
  if (c.kind === "ref") {
    const passage = registry.refs[c.ref];
    const label = passage?.title
      ? `${refSourceShort(c.ref)} · ${passage.title}`
      : `${refSourceShort(c.ref)} · ${t("cite_unverified")}`;
    return {
      label,
      title: passage ? `${passage.source}\n${passage.title}\n${passage.url}`.trim() : c.raw,
      url: passage?.url || "",
      unverified: !passage,
    };
  }
  // classified unknown: shown, never dropped — the chip is the place a
  // fabricated-looking citation becomes visible instead of silent.
  return { label: t("cite_unverified"), title: c.raw, unverified: true };
}

const CitationChip = ({ token }) => {
  const { t } = useTranslation();
  const registry = useCiteRegistry();
  const info = describe(token, registry, t);
  const Icon = KIND_ICON[classifyCiteToken(token).kind] || IconAlertCircle;
  const clickable = Boolean(info.file || info.url);

  const onClick = async () => {
    if (info.url) {
      window.open(info.url, "_blank", "noreferrer");
      return;
    }
    if (info.file) {
      // The name→key map is one lazy list call (see registry.resolveFileKey);
      // there is deliberately no citation-resolve endpoint on the backend.
      const key = await resolveFileKey(info.file.file);
      if (key) {
        const reason = await openProtectedFile(key, info.file.file);
        if (reason) consola.warn(`[CitationChip] file open failed: ${reason}`);
      }
    }
  };

  return (
    <button
      type="button"
      className={`${styles.chip} ${info.unverified ? styles.chip_unverified : ""} ${
        clickable ? styles.chip_clickable : ""
      }`}
      title={info.title}
      onClick={clickable ? onClick : undefined}
    >
      <Icon size={12} stroke={1.8} aria-hidden="true" />
      <span className={styles.chip_label}>{info.label}</span>
    </button>
  );
};

export default CitationChip;
