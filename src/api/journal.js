import { mcpRequestInstance } from "../service/request";

/**
 * 记录 — what a person reports in their own words, on the ICPC-3 axis.
 *
 * Four routes, all on the open-source backend (`server/routers/journal_router.py`):
 *
 *   POST   /api/v1/journal/sentence  log every entry one sentence states
 *   POST   /api/v1/journal           log one entry; answers with its coding
 *   GET    /api/v1/journal           the log, already grouped by day, newest first
 *   DELETE /api/v1/journal/:id       mark one entry entered in error
 *
 * Two things about this endpoint shape the UI and are worth stating here
 * rather than rediscovering in a component:
 *
 * 1. The POST answer carries the coding (`coded`, `code`, `display`, `reason`).
 *    An entry the vocabulary could not place is still SAVED and comes back with
 *    the reason, so the composer shows what it became instead of pretending the
 *    write failed. Do not treat `coded: false` as an error.
 * 2. The GET already groups by local day (`days: [{date, entries}]`). There is
 *    no client-side bucketing to write, and writing one would disagree with the
 *    server about where a day starts.
 *
 * `mcpRequestInstance` unwraps the {code, msg, data} envelope, so these resolve
 * to `data` and reject with the envelope.
 */
const BASE = "/api/v1/journal";

const params = (values) =>
  Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

/**
 * Log what a person typed, e.g. "我头疼，血压150/95，没发烧".
 *
 * The server splits it and writes each entry it states on its own axis: the
 * headache on ICPC-3, the two pressures as readings on LOINC. It answers with
 * `written` (each row with its coding) and `skipped` (each part it did not
 * write, with a reason token: negated, someone_else, ...). A medication goes to
 * the medication record, and the answer's `medications` says what became of
 * each (added, already listed, stopped, ...); anything else is kept as a note.
 *
 * `tz` is the browser's zone: "今早" is the morning where the person is typing,
 * and a record with no zone set would otherwise read it in UTC.
 *
 * A server with no text model answers 503, and one that predates the route
 * answers 404; both mean "log one entry" (`sentenceUnsupported`).
 */
export const logSentence = ({ text, observed_at, tz, target_user_id } = {}, signal) =>
  mcpRequestInstance.post(
    `${BASE}/sentence`,
    params({ text, observed_at, tz, target_user_id }),
    { signal },
  );

/**
 * Log one entry.
 *
 * `text` is the complaint in the person's own words, 1-200 characters — the
 * backend rejects longer. A sentence stating several things goes to
 * `logSentence`; this is the fallback when the server cannot read one.
 *
 * `kind` is the axis, and the two are not interchangeable: "symptom" is what
 * a person feels now and resolves on ICPC-3's S component, "condition" is what
 * they were diagnosed with and resolves on D. See KINDS in journal_router.py.
 */
export const logEntry = (
  { text, kind = "symptom", observed_at, note, target_user_id } = {},
  signal,
) =>
  mcpRequestInstance.post(
    BASE,
    params({ text, kind, observed_at, note, target_user_id }),
    { signal },
  );

/**
 * The log for a date range, grouped by day. Both ends are inclusive and
 * `YYYY-MM-DD`; the backend defaults to the last 30 days and refuses a range
 * longer than 400.
 */
export const listEntries = ({ from, to, kind, target_user_id } = {}, signal) =>
  mcpRequestInstance.get(BASE, {
    params: params({ from, to, kind, target_user_id }),
    signal,
  });

/** Mark one entry entered in error. The row is kept and hidden, not deleted. */
export const retractEntry = ({ id, target_user_id } = {}, signal) =>
  mcpRequestInstance.delete(`${BASE}/${id}`, {
    params: params({ target_user_id }),
    signal,
  });

/**
 * Remove a medication plan a sentence made, as it is listed in the log. The
 * journal's own route, so the grant that let a caregiver log it lets them take
 * it back; the plan is marked entered-in-error, not erased.
 */
export const retractMedication = ({ planId, target_user_id } = {}, signal) =>
  mcpRequestInstance.delete(`${BASE}/medication/${encodeURIComponent(planId)}`, {
    params: params({ target_user_id }),
    signal,
  });
