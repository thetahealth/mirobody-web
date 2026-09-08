import { mcpRequestInstance } from "../service/request";

/**
 * Health-indicator lookup.
 *
 * One route, and the parameters decide the grain of the answer:
 *
 *   GET /api/v1/health-indicators
 *     keywords        fuzzy terms → readings for what matched
 *     indicators      exact names (as returned by a previous call) → their readings
 *     start_time      inclusive "YYYY-MM-DD"
 *     end_time        inclusive "YYYY-MM-DD"
 *     limit           max readings per indicator (server caps at 500)
 *     target_user_id  care-circle member whose data to read
 *     (none of the above) → the CATALOG: one row per indicator this user has
 *
 * Either grain comes back in one envelope — the server's `render_rest`:
 *
 *   { rows, count, total, truncated, window, resolution, aggregate, status }
 *
 * `pages/Drive/Indicators/rows.js` turns `rows` into what the table renders,
 * and is the only place that knows the row keys. These functions deliberately
 * return the envelope untouched: `truncated` and `total` are as much part of an
 * honest answer as the rows are.
 *
 * The catalog is what makes this a *lookup* page rather than a search box: it
 * answers "what do I even have" without the user guessing a name first.
 *
 * This module used to carry a fallback to `POST /api/v1/health-indicator/watch`
 * for deployments predating this route. That route no longer exists on any
 * supported server — and the fallback could not fire anyway, because the main
 * request answers 200. It went with the rest of issue #62.
 */
const BASE = "/api/v1/health-indicators";

const params = (values) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== ""));

/** Every indicator this user has: name, code, unit, count, date range, latest value. */
export const getIndicatorCatalog = ({ target_user_id, signal } = {}) =>
  mcpRequestInstance.get(BASE, { params: params({ target_user_id }), signal });

/** Search by fuzzy keyword; answers with the matches' readings. */
export const searchIndicators = (
  { keywords, indicators, start_time, end_time, limit, target_user_id } = {},
  signal,
) =>
  mcpRequestInstance.get(BASE, {
    params: params({ keywords, indicators, start_time, end_time, limit, target_user_id }),
    signal,
  });

/** Readings for ONE indicator, by its exact name — the detail drawer's source. */
export const getIndicatorReadings = (
  { indicator, start_time, end_time, limit = 200, target_user_id } = {},
  signal,
) => searchIndicators({ indicators: indicator, start_time, end_time, limit, target_user_id }, signal);

/**
 * Correct or soft-delete one reading the CURRENT USER owns (extraction
 * mis-reads a value now and then; this is the fix-in-place). `id` is the
 * reading's `row_id` from the readings payload. Pass {value} to correct,
 * {delete: true} to remove.
 */
export const patchIndicatorReading = ({ id, value, delete: del } = {}, signal) =>
  mcpRequestInstance.post(
    `${BASE}/reading`,
    { id, ...(del ? { delete: true } : { value }) },
    { signal },
  );
