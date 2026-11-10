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
// `ref` and `flag` are what the report printed beside the value; the route
// sent them and the drawer dropped them, so an out-of-range result looked
// like any other.
//
// `value`, `unit` and `ref` are in the series' one unit: the server converts a
// reading printed in another (212 mg/dL arrives as 5.48 mmol/L and `converted`,
// thetahealth/mirobody#271). `printed` is what the report said, for the
// source column and for an edit, which corrects the reading as printed. One
// the server could not convert keeps its own unit and is `unit_differs`.
const toPrinted = (printed) =>
  printed && typeof printed === "object"
    ? { value: printed.value ?? "", unit: printed.unit || "", ref: printed.ref || "" }
    : null;

const toReading = (row) => ({
  id: row.row_id ?? null,
  indicator: row.indicator || "",
  value: row.value ?? "",
  unit: row.unit || "",
  printed: toPrinted(row.printed),
  converted: !!row.converted,
  unit_differs: !!row.unit_differs,
  time: row.time || "",
  ref: row.ref || "",
  flag: row.flag || "",
  modality: row.modality || "",
  file_key: row.file_key || "",
  file_name: row.file || "",
});

/** The i18n key for where a reading came from when it has no file to open:
 *  a device sensed it, or the person entered it. */
export const readingSourceKey = (reading) =>
  /device/.test(reading.modality || "") ? "source_kind_device" : "source_kind_manual";

// `indicator` is LOINC's long name, what the drawer selects by; `label` is the
// name a person reads, in the request's language, and `facets` what the code
// measures, axis by axis (#231). The server sends each only when it has one.
const emptyRow = (row) => ({
  indicator: row.indicator || "",
  label: row.label || "",
  facets: row.facets && typeof row.facets === "object" ? row.facets : {},
  series: row.series || "",
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

// Reading rows → one row per series, keeping their readings so the drawer
// needs no second request. `count` is the row's `total` (the server's count over
// the whole series), not the array length, which `limit` caps. Grouped by
// `series`, not by name: two series can share a translated name (serum and
// whole-blood glucose are both 葡萄糖), and one series spans sibling codes.
const fromReadings = (rows) => {
  const bySeries = new Map();
  for (const row of rows) {
    if (!row.indicator) continue;
    const key = row.series || row.indicator;
    if (!bySeries.has(key)) bySeries.set(key, emptyRow(row));
    const entry = bySeries.get(key);
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
  return [...bySeries.values()];
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

/** The axes a drawer lists, in its order, with the i18n key of each one's title. */
export const FACET_AXES = [
  ["specimen", "indicator_facet_specimen"],
  ["property", "indicator_facet_property"],
  ["timing", "indicator_facet_timing"],
  ["method", "indicator_facet_method"],
];

/** `[[titleKey, text]]` for the facets a row has, in `FACET_AXES` order. */
export const facetsOf = (row) =>
  FACET_AXES.filter(([axis]) => row?.facets?.[axis]).map(([axis, key]) => [key, row.facets[axis]]);

/** The name a row is shown under: the reader's language when the server sent one. */
export const displayName = (row) => row?.label || row?.indicator || "";

/** What the drawer asks the server for. A code names its whole series (the
 *  server expands it to every sibling code); the English name is only a
 *  fallback for an uncoded row, which has no code to send. */
export const readingsKey = (row) => row?.code || row?.indicator || "";
