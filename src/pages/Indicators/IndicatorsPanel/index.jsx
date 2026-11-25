import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Drawer, Spin, Empty, Input, Popconfirm, message } from "antd";
import {
  IconCheck,
  IconFileText,
  IconPencil,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import consola from "consola";
import api from "../../../api";
import { formatUiDate } from "../../../utils/date.js";
import { formatUiNumber } from "../../../utils/number.js";
import { useDriveStore } from "../../../store/Drive";
import { useAccountStore } from "../../../store/account";
import { openProtectedFile } from "../../../utils/protectedFile";
import {
  toTableRows,
  toReadingList,
  truncationOf,
  codeLabel,
  readingSourceKey,
  displayName,
  facetsOf,
  readingsKey,
  isFinding,
  splitByKind,
  kindsOf,
  withKinds,
} from "./rows";
import { flagOf } from "../../Chat/Dialog/Render/Citations/sources";
import useIsMobile from "../../../hooks/useIsMobile";
import TrendChart from "./TrendChart";
import styles from "./index.module.scss";

/**
 * Health-indicator lookup.
 *
 * Two states, one table:
 *  - idle → the CATALOG (every indicator this user has). Answers "what do I
 *    even have" without making the user guess a name first.
 *  - searching → matched indicators, still one row per indicator.
 * Either way a row opens the readings drawer — the per-indicator history.
 *
 * Rows are indicators, not readings: a reading-level table (what the CN app
 * shows) makes 700 rows of "BP 130.0" that the user has to mentally group
 * before it means anything. Grouping is the page's job.
 *
 * Examination findings (imaging, pathology: `心影`, `双肾`, each with a
 * sentence for a value) are listed in their own group after the measured
 * analytes, and show their text, never a value column, unit or chart (#31).
 */
const IndicatorsPanel = ({
  onEmptyUploadClick,
  onEmptyConnectClick,
  // Bumped by the parent when this tab is re-activated. Extraction runs
  // seconds AFTER a file flips to Processed, so a user who uploads and
  // clicks straight back to Indicators would otherwise stare at a stale
  // "no indicators" list until a full page reload.
  refreshTrigger = 0,
}) => {
  const { t, i18n } = useTranslation();
  // Rows carry the server's name for each test in the language of the request
  // that fetched them (`label`, sent only for Chinese). Switching the language in
  // Settings changed the chrome and every later request's X-Language, but this
  // list kept the rows it had, so an English page went on showing Chinese names
  // until a reload. The language is a dependency of the load below for that.
  const language = i18n.language;
  const mobile = useIsMobile();
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  // Distinguishes "backend has no indicator route" from "user has no data" —
  // opensource deployments may not ship the endpoint at all, and a bare empty
  // table would silently misreport that as "you have nothing".
  const [unavailable, setUnavailable] = useState(false);
  // {shown, total} when the server capped the answer, so the summary can say
  // "60 of 244" instead of presenting a slice as the whole.
  const [truncated, setTruncated] = useState(null);

  const [selected, setSelected] = useState(null);
  const [readings, setReadings] = useState([]);
  const [readingsLoading, setReadingsLoading] = useState(false);
  // Inline correction state: which reading row is being edited, and its draft.
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [patching, setPatching] = useState(false);
  // Only the record OWNER may correct readings; viewing a care-circle member
  // is read-only (the backend enforces this — the UI just doesn't offer it).
  const beneficiary_users = useAccountStore((state) => state.beneficiary_users);
  const isOwnRecord = useMemo(() => {
    const me = beneficiary_users?.find?.((u) => u.is_current_user);
    return !me || !current_drive_user_id || me.id === current_drive_user_id;
  }, [beneficiary_users, current_drive_user_id]);

  const abortRef = useRef(null);
  // `series → kind` from the catalogue, for whose record it was read. A search
  // answers in readings, which name no kind, so a finding found by name takes
  // the kind its catalogue row said rather than join the analytes.
  const kindsRef = useRef({ user: null, kinds: new Map() });
  const findingsHeadingId = useId();

  const load = useCallback(
    async (keywords) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = keywords
          ? await api.searchIndicators(
              { keywords, target_user_id: current_drive_user_id },
              controller.signal,
            )
          : await api.getIndicatorCatalog({
              target_user_id: current_drive_user_id,
              signal: controller.signal,
            });

        // Both grains of the answer — the catalog and per-reading rows — are
        // folded into one row model in rows.js, which is also where the two
        // key names live. Reading them inline here is what issue #62 was.
        const known =
          kindsRef.current.user === current_drive_user_id ? kindsRef.current.kinds : new Map();
        const next = withKinds(toTableRows(res), known);
        kindsRef.current = {
          user: current_drive_user_id,
          kinds: new Map([...known, ...kindsOf(next)]),
        };
        setRows(next);
        setTruncated(truncationOf(res));
        setUnavailable(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error?.response?.status === 404 || error?.code === 404) {
          setUnavailable(true);
          setRows([]);
        } else {
          consola.error("ERROR: load indicators", error);
          setRows([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [current_drive_user_id],
  );

  useEffect(() => {
    load(submitted);
    return () => abortRef.current?.abort();
  }, [load, submitted, refreshTrigger, language]);

  // An open drawer holds the row it was opened with, title and standard name in
  // the old language; a language switch closes it rather than show both.
  useEffect(() => {
    setSelected(null);
    setReadings([]);
  }, [language]);

  const onSubmit = (event) => {
    event.preventDefault();
    setSubmitted(query.trim());
  };

  const onClear = () => {
    setQuery("");
    setSubmitted("");
  };

  const openDetail = async (row) => {
    setSelected(row);
    // A search response already carries readings; the catalog doesn't.
    if (Array.isArray(row.readings) && row.readings.length > 0) {
      setReadings(row.readings);
      return;
    }
    setReadingsLoading(true);
    setReadings([]);
    try {
      const res = await api.getIndicatorReadings({
        indicator: readingsKey(row),
        target_user_id: current_drive_user_id,
      });
      setReadings(toReadingList(res));
    } catch (error) {
      consola.error("ERROR: load indicator readings", error);
    } finally {
      setReadingsLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setReadings([]);
    setEditingId(null);
  };

  // Re-pull the open drawer's readings AND the table behind it after a
  // correction — both display the value that just changed.
  const refreshAfterPatch = async () => {
    load(submitted);
    if (!selected) return;
    try {
      const res = await api.getIndicatorReadings({
        indicator: readingsKey(selected),
        target_user_id: current_drive_user_id,
      });
      setReadings(toReadingList(res));
    } catch (error) {
      consola.error("ERROR: refresh readings", error);
    }
  };

  // Opening the source document. `/files/` is authenticated now, so this
  // fetches with the session token and hands the tab a blob rather than
  // navigating to a URL the browser would send without credentials.
  const handleViewSource = async (reading) => {
    const reason = await openProtectedFile(reading.file_key, reading.file_name);
    if (reason) message.error(t(reason));
  };

  const saveEdit = async (reading) => {
    const next = editingValue.trim();
    if (!next || next === reading.value) {
      setEditingId(null);
      return;
    }
    setPatching(true);
    try {
      await api.patchIndicatorReading({ id: reading.id, value: next });
      message.success(t("indicator_reading_saved"));
      setEditingId(null);
      await refreshAfterPatch();
    } catch (error) {
      consola.error("ERROR: patch reading", error);
      message.error(t("indicator_reading_save_failed"));
    } finally {
      setPatching(false);
    }
  };

  const deleteReading = async (reading) => {
    setPatching(true);
    try {
      await api.patchIndicatorReading({ id: reading.id, delete: true });
      message.success(t("indicator_reading_deleted"));
      await refreshAfterPatch();
    } catch (error) {
      consola.error("ERROR: delete reading", error);
      message.error(t("indicator_reading_save_failed"));
    } finally {
      setPatching(false);
    }
  };

  const formatTime = (value) =>
    value ? formatUiDate(value, i18n.language, { time: true }) : "—";
  const formatDate = (value) =>
    value ? formatUiDate(value, i18n.language) : "—";
  // What the report printed beside the value: 偏高 / 偏低, in words, since
  // colour alone does not say which way.
  const flagChip = (flag) => {
    const kind = flagOf(flag);
    if (!kind) return null;
    const label = kind === "high" ? t("cite_flag_high") : kind === "low" ? t("cite_flag_low") : kind;
    return <span className={styles.flag}>{label}</span>;
  };
  // A finding's record is its text: no number, so no range, unit or chart.
  const selectedIsFinding = isFinding(selected);
  const showRef = !selectedIsFinding && readings.some((reading) => reading.ref);

  // Where a reading came from. Document-derived readings carry the source
  // file's key — link straight to the original so the number can be checked
  // against the report it came from.
  //
  // A button, not an <a href>: /files/ requires a token now (it used to serve
  // anyone's health reports to anyone), and a browser cannot put a header on a
  // navigation. See utils/protectedFile.
  const readingSource = (reading) =>
    reading.file_key ? (
      <button
        type="button"
        className={styles.sourceLink}
        onClick={() => handleViewSource(reading)}
      >
        <IconFileText size={14} /> {t("indicator_view_source")}
      </button>
    ) : (
      // Was "—" for every device reading, while the 明细 tab named the same
      // row 设备.
      t(readingSourceKey(reading))
    );

  // Edit and delete, or save and cancel while editing. Only a reading with an
  // id can be corrected.
  const readingActions = (reading) =>
    reading.id == null ? null : editingId === reading.id ? (
      <>
        <button
          type="button"
          disabled={patching}
          onClick={() => saveEdit(reading)}
          aria-label={t("save")}
        >
          <IconCheck size={14} stroke={2} />
        </button>
        <button
          type="button"
          disabled={patching}
          onClick={() => setEditingId(null)}
          aria-label={t("cancel")}
        >
          <IconX size={14} stroke={2} />
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          onClick={() => {
            setEditingId(reading.id);
            setEditingValue(reading.printed?.value ?? reading.value ?? "");
          }}
          aria-label={t(selectedIsFinding ? "indicator_edit_finding" : "indicator_edit_reading")}
        >
          <IconPencil size={14} stroke={1.8} />
        </button>
        <Popconfirm
          title={t("indicator_delete_reading_confirm")}
          okText={t("yes")}
          cancelText={t("cancel")}
          onConfirm={() => deleteReading(reading)}
        >
          <button type="button" aria-label={t("delete")}>
            <IconTrash size={14} stroke={1.8} />
          </button>
        </Popconfirm>
      </>
    );

  const { measurements, findings } = useMemo(() => splitByKind(rows), [rows]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
    [rows],
  );

  // Only worth a column when something actually carries a code — otherwise it
  // is a column of em-dashes taking the width real values need.
  const showCode = useMemo(() => measurements.some((row) => row.code), [measurements]);

  const rowKey = (row) => row.series || `${row.indicator}-${row.code || ""}`;
  // A table row opens its drawer by click or by Enter, in either group.
  const rowProps = (row) => ({
    onClick: () => openDetail(row),
    tabIndex: 0,
    onKeyDown: (event) => {
      if (event.key === "Enter") openDetail(row);
    },
  });

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <form className={styles.search} onSubmit={onSubmit}>
          <input
            type="search"
            name="indicator-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("indicator_search_placeholder")}
            aria-label={t("indicator_search_placeholder")}
          />
          <button type="submit">{t("search")}</button>
          {submitted && (
            <button type="button" className={styles.ghost} onClick={onClear}>
              {t("indicator_show_all")}
            </button>
          )}
        </form>
        {!loading && !unavailable && rows.length > 0 && (
          <div className={styles.summary}>
            {findings.length > 0
              ? t("indicator_summary_findings", {
                  indicators: measurements.length,
                  findings: findings.length,
                  readings: total,
                })
              : t("indicator_summary", {
                  indicators: rows.length,
                  readings: total,
                })}
            {truncated && (
              <span className={styles.partial}>
                {" "}
                {t("indicator_truncated", truncated)}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className={styles.center}>
          <Spin />
        </div>
      ) : unavailable ? (
        <div className={styles.center}>
          <Empty description={t("indicator_unavailable")} />
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>
            {submitted ? t("indicator_no_match") : t("indicator_no_data_title")}
          </div>
          <div className={styles.emptyBody}>
            {submitted ? t("indicator_no_match_hint") : t("indicator_no_data")}
          </div>
          {!submitted && (
            <div className={styles.emptyActions}>
              {onEmptyUploadClick && (
                <button type="button" onClick={onEmptyUploadClick}>
                  {t("upload_files_tab")}
                </button>
              )}
              {onEmptyConnectClick && (
                <button type="button" onClick={onEmptyConnectClick}>
                  {t("connect_data_source")}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {measurements.length > 0 &&
            (mobile ? (
              // A phone gets one card per indicator: the table's five columns
              // overflowed 375px, leaving only the names on screen.
              <ul className={styles.cards}>
                {measurements.map((row) => (
                  <li key={rowKey(row)}>
                    <button type="button" className={styles.card} onClick={() => openDetail(row)}>
                      <span className={styles.cardName} title={row.label ? row.indicator : undefined}>
                        {displayName(row)}
                      </span>
                      <span className={styles.cardValue}>
                        {row.latest_value !== "" ? (
                          <>
                            <span className={styles.value}>{formatUiNumber(row.latest_value, i18n.language)}</span>
                            {row.unit && <span className={styles.unit}>{row.unit}</span>}
                          </>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </span>
                      <span className={styles.cardMeta}>
                        {formatDate(row.latest_time)}
                        {row.count ? ` · ${t("cite_count", { count: row.count })}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  {/* Explicit widths: the name column would otherwise eat half the
                      page and strand the numbers at the far right, where the eye has
                      to travel to connect them back to their row. */}
                  <colgroup>
                    <col style={{ width: "38%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "16%" }} />
                    {showCode && <col style={{ width: "12%" }} />}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>{t("indicator")}</th>
                      <th>{t("indicator_latest_value")}</th>
                      <th>{t("indicator_records")}</th>
                      <th>{t("indicator_last_seen")}</th>
                      {showCode && <th>{t("indicator_code")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((row) => (
                      <tr key={rowKey(row)} {...rowProps(row)}>
                        <td className={styles.name} title={row.label ? row.indicator : undefined}>
                          {displayName(row)}
                        </td>
                        <td>
                          {row.latest_value !== "" ? (
                            <>
                              <span className={styles.value}>{formatUiNumber(row.latest_value, i18n.language)}</span>
                              {row.unit && (
                                <span className={styles.unit}>{row.unit}</span>
                              )}
                            </>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td>{row.count || "—"}</td>
                        <td className={styles.muted}>{formatDate(row.latest_time)}</td>
                        {showCode && (
                          <td className={`${styles.muted} ${styles.code}`}>
                            {codeLabel(row) || "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {/* Imaging and pathology: an organ and what the report saw there,
              in a sentence. Among K and ALT they read as prose "indicators";
              apart, with the sentence where a value would be, they read as
              what they are. No unit and no code column: a finding has neither. */}
          {findings.length > 0 && (
            <section
              className={`${styles.group} ${measurements.length > 0 ? styles.groupAfter : ""}`}
              aria-labelledby={findingsHeadingId}
            >
              <div className={styles.groupHead}>
                <h3 id={findingsHeadingId} className={styles.groupTitle}>
                  {t("indicator_findings")}
                </h3>
                <p className={styles.groupHint}>{t("indicator_findings_hint")}</p>
              </div>
              {mobile ? (
                <ul className={styles.cards}>
                  {findings.map((row) => (
                    <li key={rowKey(row)}>
                      <button
                        type="button"
                        className={`${styles.card} ${styles.findingCard}`}
                        onClick={() => openDetail(row)}
                      >
                        <span className={styles.cardName} title={row.label ? row.indicator : undefined}>
                          {displayName(row)}
                        </span>
                        <span className={styles.cardText}>{formatUiNumber(row.latest_value, i18n.language) || "—"}</span>
                        <span className={styles.cardMeta}>
                          {formatDate(row.latest_time)}
                          {row.count ? ` · ${t("cite_count", { count: row.count })}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={`${styles.table} ${styles.findingTable}`}>
                    <colgroup>
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "48%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "16%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>{t("indicator_finding_item")}</th>
                        <th>{t("indicator_finding")}</th>
                        <th>{t("indicator_records")}</th>
                        <th>{t("indicator_last_seen")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {findings.map((row) => (
                        <tr key={rowKey(row)} {...rowProps(row)}>
                          <td className={styles.name} title={row.label ? row.indicator : undefined}>
                            {displayName(row)}
                          </td>
                          <td className={styles.findingText}>
                            {formatUiNumber(row.latest_value, i18n.language) || <span className={styles.muted}>—</span>}
                          </td>
                          <td>{row.count || "—"}</td>
                          <td className={styles.muted}>{formatDate(row.latest_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <Drawer
        open={!!selected}
        onClose={closeDetail}
        title={displayName(selected)}
        classNames={{ title: styles.drawerTitle }}
        placement={mobile ? "bottom" : "right"}
        size={mobile ? Math.round(window.innerHeight * 0.88) : 480}
        destroyOnHidden
      >
        {selected && (
          <div className={styles.detail}>
            {/* The current value answers the question the user clicked to ask;
                the history table below answers "and how did it get there".
                A finding's answer is a sentence, read as one, not set as a
                32px figure with a unit. */}
            {readings[0] && selectedIsFinding && (
              <p className={styles.latestText}>{readings[0].value || "—"}</p>
            )}
            {readings[0] && !selectedIsFinding && (
              <div className={styles.latest}>
                <span className={styles.latestValue}>{formatUiNumber(readings[0].value, i18n.language)}</span>
                {(readings[0].unit || selected.unit) && (
                  <span className={styles.latestUnit}>
                    {readings[0].unit || selected.unit}
                  </span>
                )}
                {flagChip(readings[0].flag)}
                {readings[0].ref && (
                  <span className={styles.latestUnit}>{t("cite_ref_range", { range: readings[0].ref })}</span>
                )}
              </div>
            )}

            {/* What the test is, one line per axis, in place of LOINC's long
                name: `血红蛋白 [质量/体积]，全血` is a key for systems, not a
                sentence. The code and that long name close the list, so the
                plain name can always be checked and looked up (#231). */}
            {(facetsOf(selected).length > 0 || selected.code) && (
              <dl className={styles.facts}>
                {facetsOf(selected).map(([key, text]) => (
                  <div key={key}>
                    <dt>{t(key)}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
                {selected.code && (
                  <div>
                    <dt>{t("indicator_code")}</dt>
                    <dd>
                      {codeLabel(selected)}
                      {selected.label && selected.label !== selected.indicator && (
                        <div className={styles.longName}>{selected.indicator}</div>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <dl className={styles.meta}>
              <div>
                <dt>{t("indicator_records")}</dt>
                <dd>{selected.count || readings.length}</dd>
              </div>
              {(selected.latest_time || readings[0]?.time) && (
                <div>
                  <dt>{t("indicator_last_seen")}</dt>
                  <dd>{formatDate(selected.latest_time || readings[0]?.time)}</dd>
                </div>
              )}
            </dl>

            {!readingsLoading && !selectedIsFinding && (
              <TrendChart
                readings={readings}
                unit={readings[0]?.unit || selected.unit}
                total={Number(selected.count) || 0}
              />
            )}

            {readingsLoading ? (
              <div className={styles.center}>
                <Spin />
              </div>
            ) : readings.length === 0 ? (
              <Empty description={t("indicator_no_data")} />
            ) : selectedIsFinding ? (
              // A finding's records are sentences: each takes the drawer's
              // width, with its day, source and actions on a line beneath.
              // In table columns beside those, a 327px phone drawer left the
              // sentence three characters a line.
              <ul className={styles.findingRecords}>
                {readings.map((reading, index) => (
                  <li key={`${reading.id ?? reading.time}-${index}`}>
                    <div className={styles.findingText}>
                      {editingId === reading.id ? (
                        // Corrected as text. Enter saves, as in the value
                        // field; Shift+Enter breaks the line.
                        <Input.TextArea
                          autoFocus
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          value={editingValue}
                          disabled={patching}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onPressEnter={(e) => {
                            if (e.shiftKey || e.nativeEvent.isComposing) return;
                            e.preventDefault();
                            saveEdit(reading);
                          }}
                        />
                      ) : (
                        reading.value || <span className={styles.muted}>—</span>
                      )}
                    </div>
                    <div className={styles.findingRecordMeta}>
                      <span className={styles.code}>{formatDate(reading.time)}</span>
                      <span>{readingSource(reading)}</span>
                      {isOwnRecord && <span className={styles.rowActions}>{readingActions(reading)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              // Scrolls on its own, as the list's table does: a document's
              // readings add a range and a source column, 492px in a 327px drawer
              // on a phone, and the whole drawer scrolled sideways with it.
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("indicator_value")}</th>
                      {showRef && <th>{t("indicator_ref_range")}</th>}
                      <th>{t("indicator_measured_at")}</th>
                      <th>{t("source")}</th>
                      {isOwnRecord && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((reading, index) => (
                      <tr key={`${reading.id ?? reading.time}-${index}`}>
                        <td>
                          {editingId === reading.id ? (
                            // A correction is to what the report printed, in
                            // its unit: the value shown may be converted.
                            <Input
                              size="small"
                              autoFocus
                              value={editingValue}
                              disabled={patching}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onPressEnter={() => saveEdit(reading)}
                              suffix={(reading.printed?.unit ?? reading.unit) || undefined}
                              style={{ maxWidth: 140 }}
                            />
                          ) : (
                            <>
                              <span className={styles.value}>{formatUiNumber(reading.value, i18n.language)}</span>
                              {(reading.unit || selected.unit) && (
                                <span className={styles.unit}>
                                  {reading.unit || selected.unit}
                                </span>
                              )}
                              {flagChip(reading.flag)}
                            </>
                          )}
                        </td>
                        {showRef && <td className={styles.muted}>{reading.ref || "—"}</td>}
                        <td className={styles.muted}>
                          {formatTime(reading.time)}
                        </td>
                        <td className={styles.muted}>
                          {readingSource(reading)}
                          {/* The source column is where what the report printed
                              shows: the value column is in the series' unit. */}
                          {reading.converted && reading.printed ? (
                            <div>
                              {t("indicator_printed")}
                              {reading.printed.value} {reading.printed.unit}
                            </div>
                          ) : null}
                        </td>
                        {isOwnRecord && (
                          <td className={styles.rowActions}>{readingActions(reading)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default IndicatorsPanel;
