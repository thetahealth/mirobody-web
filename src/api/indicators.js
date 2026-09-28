import { mcpRequestInstance } from "../service/request";

/**
 * Health-indicator lookup. One route, and the parameters decide the grain:
 * `keywords` or `indicators` → readings; neither → the catalog (one row per
 * indicator, which is what makes this a lookup page rather than a search box).
 * `target_user_id` reads a care-circle member.
 *
 * Both grains arrive as `{rows, count, total, truncated, …}`; the envelope is
 * returned untouched because `truncated` and `total` are part of an honest
 * answer. `pages/Indicators/IndicatorsPanel/rows.js` is the only place that knows the
 * row keys.
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

/** Correct ({value}) or soft-delete ({delete: true}) one reading the caller
 *  owns. `id` is the reading's `row_id`. */
export const patchIndicatorReading = ({ id, value, delete: del } = {}, signal) =>
  mcpRequestInstance.post(
    `${BASE}/reading`,
    { id, ...(del ? { delete: true } : { value }) },
    { signal },
  );

/** Cross-indicator rows for the Data review table. */
export const getIndicatorRecords = (params = {}, signal) =>
  mcpRequestInstance.get("/api/v1/health-indicators/records", { params, signal });

/** Logical entries added since the browser's last visit. */
export const getDataDelta = (params = {}, signal) =>
  mcpRequestInstance.get("/api/v1/data/data-delta", { params, signal });

export const exportIndicatorRecords = ({ target_user_id, format = "csv" } = {}, signal) =>
  mcpRequestInstance.get("/api/v1/health-indicators/export", {
    params: { target_user_id, format }, responseType: "blob", signal,
  });
