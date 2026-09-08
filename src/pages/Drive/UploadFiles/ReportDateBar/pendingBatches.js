// pendingBatches.js — group the extraction verdicts into "which date?" prompts.
//
// One bar per upload SESSION (the files picked together in one multi-select;
// `sessionId` is the upload's WebSocket session, one per selection in
// hooks/useUpload.js). A session needs a bar when at least one of its files
// was filed under the upload day because the document showed no date. The
// default answer is the date another file of the SAME session carries (a
// report photographed as several pages shows its date on the first page only)
// — offered, never applied on its own.
import { needsDateConfirm, reportDateOf } from "../FileTable/reportDate";

export function pendingBatches(pendingDates = {}) {
  const bySession = new Map();
  for (const entry of Object.values(pendingDates)) {
    if (!entry || !entry.file_key) continue;
    const key = entry.sessionId || entry.file_key;
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key).push(entry);
  }
  const batches = [];
  for (const [sessionId, entries] of bySession) {
    const pending = entries.filter((e) => needsDateConfirm(e));
    if (pending.length === 0) continue;
    const candidates = [
      ...new Set(
        entries
          .filter((e) => e.date_source === "extracted" || e.date_source === "manual")
          .map(reportDateOf)
          .filter(Boolean),
      ),
    ].sort().reverse();
    batches.push({
      sessionId,
      pending,
      total: entries.length,
      candidates,
      uploadDay: reportDateOf(pending[0]),
    });
  }
  return batches;
}
