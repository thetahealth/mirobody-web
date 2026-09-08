/**
 * The indicator endpoint answers in two GRAINS, and this folds both into the
 * one row model the table renders.
 *
 *   GET /api/v1/health-indicators
 *     no keywords / no indicators  → CATALOG rows, one per indicator:
 *       {indicator, system, code, count, unit, latest_value,
 *        first_date, last_date, total, day_known}
 *     keywords=… | indicators=…    → READING rows, one per measurement:
 *       {indicator, time, value, unit, file_key, row_id, system, code,
 *        total, day_known, provenance}
 *
 * Both arrive as `{rows, count, total, truncated, …}`.
 *
 * **Why the grain is sniffed per response rather than decided by the caller.**
 * A search that matches nothing does not come back empty: the server answers
 * with the catalog instead, so the person sees what they actually have rather
 * than a blank table. So "I asked with keywords" does not imply reading rows,
 * and the envelope does not say which grain it chose. The rows themselves do:
 * only a reading carries `row_id`, only a catalog row carries `last_date`.
 *
 * This module exists because the previous client read `res.catalog` and
 * `res.indicators` — keys the server never sent — and then fed the rows through
 * a reading-aggregator that had nothing to aggregate. The list rendered "no
 * indicator data" against a healthy endpoint holding six indicators, and the
 * readings drawer and the edit buttons were broken the same way (issue #62).
 * Every field mapping here is pinned by rows.test.js.
 */

/** A catalog row never has `row_id`; a reading row always does. */
const isCatalogRow = (row) =>
  !!row && row.row_id == null && ("last_date" in row || "latest_value" in row);

/**
 * One reading, as the drawer and the correction buttons want it.
 *
 * `row_id` becomes `id`: it is the `th_series_data` primary key that
 * `POST /health-indicators/reading` edits and soft-deletes. Reading `id` — the
 * name an older response used — left every row's edit and delete button
 * unrendered, because the UI only offers them when `id != null`.
 */
const toReading = (row) => ({
  id: row.row_id ?? null,
  indicator: row.indicator || "",
  value: row.value ?? "",
  unit: row.unit || "",
  time: row.time || "",
  file_key: row.file_key || "",
});

const emptyRow = (row) => ({
  indicator: row.indicator || "",
  system: row.system || "",
  code: row.code || "",
  unit: row.unit || "",
  count: 0,
  latest_value: "",
  latest_time: "",
  readings: [],
});

/** Catalog rows → table rows. `last_date` is a date, `time` on a reading is a timestamp. */
const fromCatalog = (rows) =>
  rows.map((row) => ({
    ...emptyRow(row),
    count: Number(row.count) || 0,
    latest_value: row.latest_value ?? "",
    latest_time: row.last_date || "",
  }));

/**
 * Reading rows → one table row per indicator, carrying the readings that came
 * with them so opening the drawer needs no second request.
 *
 * `count` comes from the row's own `total` (the per-indicator total, computed
 * server-side over the whole series) and NOT from how many readings arrived:
 * the response is capped by `limit`, so counting the array reports "1 record"
 * for an indicator with six.
 */
const fromReadings = (rows) => {
  const byName = new Map();
  for (const row of rows) {
    const name = row.indicator;
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, emptyRow(row));
    const entry = byName.get(name);
    if (!entry.unit && row.unit) entry.unit = row.unit;
    if (!entry.code && row.code) {
      entry.code = row.code;
      entry.system = row.system || entry.system;
    }
    entry.readings.push(toReading(row));
    entry.count = Number(row.total) || entry.readings.length;
    // Pick the latest by comparing timestamps rather than trusting the order
    // rows arrive in — "YYYY-MM-DD HH:mm:ss" sorts lexically.
    if (row.time && row.time > entry.latest_time) {
      entry.latest_time = row.time;
      entry.latest_value = row.value ?? "";
    }
  }
  return [...byName.values()];
};

/** Table rows from either grain. */
export const toTableRows = (res) => {
  const rows = Array.isArray(res?.rows) ? res.rows : [];
  if (rows.length === 0) return [];
  return isCatalogRow(rows[0]) ? fromCatalog(rows) : fromReadings(rows);
};

/**
 * The drawer's readings for one indicator. A catalog answer (what a no-match
 * search falls back to) carries no readings, so it yields none — rather than
 * one blank row per indicator.
 */
export const toReadingList = (res) => {
  const rows = Array.isArray(res?.rows) ? res.rows : [];
  if (rows.length === 0 || isCatalogRow(rows[0])) return [];
  return rows.map(toReading);
};

/**
 * `{shown, total}` when the server capped the answer, else null — so the page
 * can say "60 of 244" instead of quietly presenting a slice as the whole.
 */
export const truncationOf = (res) => {
  if (!res?.truncated) return null;
  const shown = Array.isArray(res.rows) ? res.rows.length : 0;
  const total = Number(res.total) || shown;
  return total > shown ? { shown, total } : null;
};
