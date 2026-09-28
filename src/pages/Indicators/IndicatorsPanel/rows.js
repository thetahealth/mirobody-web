/**
 * `GET /api/v1/health-indicators` answers in two grains — catalog rows
 * (one per indicator) without `keywords`/`indicators`, reading rows with them —
 * and folds both into the one row model the table renders.
 *
 * The grain is sniffed per response, not inferred from the request: a search
 * that matches nothing answers with the catalog instead of an empty table, and
 * the envelope does not say which it chose. Only a reading has `row_id`, only a
 * catalog row has `last_date`.
 *
 * The previous client read `res.catalog` / `res.indicators`, keys the route
 * never sends (issue #62). rows.test.js pins every mapping here.
 */

/** A catalog row never has `row_id`; a reading row always does. */
const isCatalogRow = (row) =>
  !!row && row.row_id == null && ("last_date" in row || "latest_value" in row);

// `row_id` → `id`: the key `POST /health-indicators/reading` edits. The UI only
// offers edit/delete when `id != null`, so looking for `id` hid both buttons.
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

// Catalog rows: `last_date` is a date; a reading's `time` is a timestamp.
const fromCatalog = (rows) =>
  rows.map((row) => ({
    ...emptyRow(row),
    count: Number(row.count) || 0,
    latest_value: row.latest_value ?? "",
    latest_time: row.last_date || "",
  }));

// Reading rows → one row per indicator, keeping their readings so the drawer
// needs no second request. `count` is the row's `total` (the server's count over
// the whole series), not the array length, which `limit` caps.
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
    // Latest by timestamp, not by arrival order ("YYYY-MM-DD HH:mm:ss" sorts).
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

// The drawer's readings. A catalog answer carries none, so it yields none
// rather than a blank row per indicator.
export const toReadingList = (res) => {
  const rows = Array.isArray(res?.rows) ? res.rows : [];
  if (rows.length === 0 || isCatalogRow(rows[0])) return [];
  return rows.map(toReading);
};

// `{shown, total}` only when something was actually left out: the server sets
// `truncated` even when `rows == total`.
export const truncationOf = (res) => {
  if (!res?.truncated) return null;
  const shown = Array.isArray(res.rows) ? res.rows.length : 0;
  const total = Number(res.total) || shown;
  return total > shown ? { shown, total } : null;
};

// The server names a code's system by its FHIR URI ("http://loinc.org"); the
// table shows the short name a reader knows. An unknown system shows as sent.
const SYSTEM_NAMES = {
  "http://loinc.org": "LOINC",
  loinc: "LOINC",
  "http://snomed.info/sct": "SNOMED CT",
  "http://terminology.hl7.org/CodeSystem/ICPC-3": "ICPC-3",
};

/** "LOINC 29463-7" for a row with a code, "" for one without. */
export const codeLabel = (row) => {
  if (!row?.code) return "";
  const system = SYSTEM_NAMES[row.system] ?? row.system ?? "";
  return `${system} ${row.code}`.trim();
};
