// What a cite group opens: its sources, arranged for reading rather than in
// cite order. One sentence can rest on nineteen fasting-glucose readings
// (TH-2134's sample); listed one by one with the indicator's name on each,
// that is a column of the same word. Readings of one indicator are one
// section, the name said once.

import { citeKind, linesOf } from "./markup";

/** The status a cite resolves to before its row says otherwise. */
export function statusOf(id, row) {
  const kind = citeKind(id);
  if (kind === "unknown") return "unknown";
  if (kind === "lines") return "ok";
  if (!row) return "loading";
  return row.status === "ok" ? "ok" : row.status === "gone" ? "gone" : "unknown";
}

/** Whether every source behind an anchor is gone (deleted, or never was). */
export function allGone(ids, resolved) {
  return ids.length > 0 && ids.every((id) => ["gone", "unknown"].includes(statusOf(id, resolved?.[id])));
}

// A reading's name: a device row's `name` is the vendor's field
// ("bodyMasss"), so its indicator reads better; a report's own wording is
// what the person can find on the page.
export const readingName = (row) =>
  (row.source_kind === "device" ? row.indicator || row.name : row.name || row.indicator) || "";

/**
 * Sections for a group's ids: `{type: "readings", name, items}`,
 * `{type: "aggregate", row}`, `{type: "ref", id, row}`,
 * `{type: "lines", id, file, start, end}` or `{type: "status", id, status}`,
 * in the order their first id appears.
 */
export function sectionsOf(ids, resolved = {}) {
  const sections = [];
  const byName = new Map();
  const seen = new Set();
  const addReading = (row, id) => {
    const name = readingName(row);
    if (!byName.has(name)) {
      const section = { type: "readings", name, items: [] };
      byName.set(name, section);
      sections.push(section);
    }
    byName.get(name).items.push({ ...row, id });
  };
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const kind = citeKind(id);
    const row = resolved[id];
    const status = statusOf(id, row);
    if (kind === "lines") {
      const lines = linesOf(id);
      sections.push({ type: "lines", id, file: lines.path.split("/").pop(), start: lines.start, end: lines.end });
    } else if (status !== "ok") {
      sections.push({ type: "status", id, status });
    } else if (kind === "ref") {
      sections.push({ type: "ref", id, row });
    } else if (row.kind === "aggregate") {
      const readings = row.readings || [];
      // A day's bucket holding one reading is that reading.
      if ((row.total ?? readings.length) === 1 && readings.length === 1) {
        addReading({ ...readings[0], indicator: row.indicator || readings[0].indicator }, id);
      } else {
        sections.push({ type: "aggregate", id, row });
      }
    } else {
      addReading(row, id);
    }
  }
  return sections;
}

/** "2026-10-30" when only the day is known (a journal entry, a lab slip at
 *  00:00), "2026-10-30 08:10" when the clock was recorded. */
export function when(time) {
  if (!time) return "";
  const text = String(time).replace("T", " ");
  const day = text.slice(0, 10);
  const clock = text.slice(11, 16);
  return !clock || clock === "00:00" ? day : `${day} ${clock}`;
}

/** "high" | "low" for the flags a report prints, "" for normal or none, the
 *  flag itself for anything else. */
export function flagOf(flag) {
  const text = String(flag || "").trim();
  const key = text.toLowerCase();
  if (["high", "h", "hh", "↑", "偏高", "高", "above"].includes(key)) return "high";
  if (["low", "l", "ll", "↓", "偏低", "低", "below"].includes(key)) return "low";
  if (["", "normal", "n", "正常", "in range"].includes(key)) return "";
  return text;
}

/** The days an aggregate covers. A month's bucket is named by its first day
 *  ("2025-09-01"), which reads as that one day, so its bounds come first. */
export function spanOf(row) {
  const from = row.from || row.first_day;
  const to = row.to || row.last_day;
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || row.period || "";
}
