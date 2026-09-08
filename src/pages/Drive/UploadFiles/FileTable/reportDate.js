// reportDate.js — which uploaded documents still owe the user a report date,
// and what the same upload can offer them (issue #53).
//
// The backend labels every extracted file with `date_source`: "extracted" (read
// off the document), "upload_time" (nothing on the document gave a date, the
// upload time stood in) or "manual". It deliberately never copies a date from
// a sibling file: "page 2 of the same report" and "a second report whose date
// did not come out" look identical to it. So the question is asked here, with
// the sibling dates as one-click answers.

export function needsDateConfirm(file) {
  return !!file && file.date_source === "upload_time" && !file.date_confirmed;
}

// "2025-08-15 00:00:00" → "2025-08-15". Empty when the file carries no date
// (extracted before the label existed, or never produced a reading).
export function reportDateOf(file) {
  const s = file?.report_date;
  return typeof s === "string" ? s.slice(0, 10) : "";
}

// Dates the OTHER files of the same upload were filed under — only ones a
// human or the document itself vouched for, never another upload-time fallback.
// "Same upload" is either the same WebSocket upload session (`created_source_id`)
// or an upload within SIBLING_WINDOW_MS of this one: this client opens one
// session per file, so the pages of a report photographed together share a
// minute, not a session id.
export const SIBLING_WINDOW_MS = 15 * 60 * 1000;

function uploadedAt(file) {
  const t = Date.parse(file?.create_time || file?.upload_time || "");
  return Number.isFinite(t) ? t : null;
}

export function siblingReportDates(files = [], file) {
  if (!file) return [];
  const batch = file.created_source_id;
  const at = uploadedAt(file);
  const dates = new Set();
  for (const f of files) {
    if (!f || f.file_key === file.file_key) continue;
    const sameSession = batch && f.created_source_id === batch;
    const other = uploadedAt(f);
    const nearby = at !== null && other !== null && Math.abs(other - at) <= SIBLING_WINDOW_MS;
    if (!sameSession && !nearby) continue;
    if (f.date_source !== "extracted" && f.date_source !== "manual") continue;
    const d = reportDateOf(f);
    if (d) dates.add(d);
  }
  return [...dates].sort().reverse();
}
