import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Drawer, Spin, Empty, Input, Popconfirm, message } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import consola from "consola";
import api from "../../../api";
import { useDriveStore } from "../../../store/Drive";
import { useAccountStore } from "../../../store/account";
import { openProtectedFile } from "../../../utils/protectedFile";
import { toTableRows, toReadingList, truncationOf } from "./rows";
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
  const { t } = useTranslation();
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
        setRows(toTableRows(res));
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
  }, [load, submitted, refreshTrigger]);

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
        indicator: row.indicator,
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
        indicator: selected.indicator,
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
    value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "—";
  const formatDate = (value) => (value ? dayjs(value).format("YYYY-MM-DD") : "—");

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
    [rows],
  );

  // Only worth a column when something actually carries a code — otherwise it
  // is a column of em-dashes taking the width real values need.
  const showCode = useMemo(() => rows.some((row) => row.code), [rows]);

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
            {t("indicator_summary", {
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
              {rows.map((row) => (
                  <tr
                    key={`${row.indicator}-${row.code || ""}`}
                    onClick={() => openDetail(row)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openDetail(row);
                    }}
                  >
                    <td className={styles.name}>{row.indicator}</td>
                    <td>
                      {row.latest_value !== "" ? (
                        <>
                          <span className={styles.value}>{row.latest_value}</span>
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
                      <td className={styles.muted}>
                        {row.code
                          ? `${row.system || ""} ${row.code}`.trim()
                          : "—"}
                      </td>
                    )}
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={!!selected}
        onClose={closeDetail}
        title={selected?.indicator}
        width={480}
        destroyOnClose
      >
        {selected && (
          <div className={styles.detail}>
            {/* The current value answers the question the user clicked to ask;
                the history table below answers "and how did it get there". */}
            {readings[0] && (
              <div className={styles.latest}>
                <span className={styles.latestValue}>{readings[0].value}</span>
                {(readings[0].unit || selected.unit) && (
                  <span className={styles.latestUnit}>
                    {readings[0].unit || selected.unit}
                  </span>
                )}
              </div>
            )}

            <dl className={styles.meta}>
              {selected.code && (
                <div>
                  <dt>{t("indicator_code")}</dt>
                  <dd>{`${selected.system || ""} ${selected.code}`.trim()}</dd>
                </div>
              )}
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

            {readingsLoading ? (
              <div className={styles.center}>
                <Spin />
              </div>
            ) : readings.length === 0 ? (
              <Empty description={t("indicator_no_data")} />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("indicator_value")}</th>
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
                          <Input
                            size="small"
                            autoFocus
                            value={editingValue}
                            disabled={patching}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onPressEnter={() => saveEdit(reading)}
                            style={{ maxWidth: 120 }}
                          />
                        ) : (
                          <>
                            <span className={styles.value}>{reading.value}</span>
                            {(reading.unit || selected.unit) && (
                              <span className={styles.unit}>
                                {reading.unit || selected.unit}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className={styles.muted}>
                        {formatTime(reading.time)}
                      </td>
                      <td className={styles.muted}>
                        {/* Document-derived readings carry the source file's
                            key — link straight to the original so the number
                            can be checked against the report it came from.

                            A button, not an <a href>: /files/ requires a token
                            now (it used to serve anyone's health reports to
                            anyone), and a browser cannot put a header on a
                            navigation. See utils/protectedFile. */}
                        {reading.file_key ? (
                          <button
                            type="button"
                            className={styles.sourceLink}
                            onClick={() => handleViewSource(reading)}
                          >
                            <FileTextOutlined /> {t("indicator_view_source")}
                          </button>
                        ) : (
                          reading.file_name || reading.source || "—"
                        )}
                      </td>
                      {isOwnRecord && (
                        <td className={styles.rowActions}>
                          {reading.id != null &&
                            (editingId === reading.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={patching}
                                  onClick={() => saveEdit(reading)}
                                  aria-label={t("save")}
                                >
                                  <CheckOutlined />
                                </button>
                                <button
                                  type="button"
                                  disabled={patching}
                                  onClick={() => setEditingId(null)}
                                  aria-label={t("cancel")}
                                >
                                  <CloseOutlined />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(reading.id);
                                    setEditingValue(reading.value ?? "");
                                  }}
                                  aria-label={t("indicator_edit_reading")}
                                >
                                  <EditOutlined />
                                </button>
                                <Popconfirm
                                  title={t("indicator_delete_reading_confirm")}
                                  okText={t("yes")}
                                  cancelText={t("cancel")}
                                  onConfirm={() => deleteReading(reading)}
                                >
                                  <button
                                    type="button"
                                    aria-label={t("delete")}
                                  >
                                    <DeleteOutlined />
                                  </button>
                                </Popconfirm>
                              </>
                            ))}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default IndicatorsPanel;
