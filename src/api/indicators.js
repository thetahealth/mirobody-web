import { mcpRequestInstance } from "../service/request";

/**
 * Health-indicator lookup.
 *
 * Shape mirrors the backend's `query_health_indicators` service (the one the
 * agent calls as an MCP tool) so the REST route is a thin wrapper over logic
 * that already exists rather than a second implementation:
 *
 *   GET /api/v1/health-indicators
 *     keywords        fuzzy terms; omit to get the CATALOG instead
 *     indicators      exact names (as returned by a previous call)
 *     start_time      inclusive "YYYY-MM-DD"
 *     end_time        inclusive "YYYY-MM-DD"
 *     limit           max readings per indicator (server caps at 500)
 *     target_user_id  care-circle member whose data to read
 *
 *   → { catalog: [{indicator, system, code, unit, count, first_time, last_time}] }
 *        when neither keywords nor indicators is given, and
 *     { indicators: [{indicator, system, code, unit, count, readings: [
 *         {value, unit, time, source, file_key, file_name}]}],
 *       truncated: {<indicator>: total} }
 *        when a query was made.
 *
 * `catalog` is what makes this a *lookup* page: it answers "what do I even
 * have" without the user guessing a name first.
 */
const BASE = "/api/v1/health-indicators";

const isNotFound = (error) =>
  error?.response?.status === 404 || error?.code === 404;

/**
 * Legacy fallback: deployments that predate `/api/v1/health-indicators` serve
 * a flat, paginated reading list at `/api/v1/health-indicator/watch`. Group it
 * into the same indicator-major shape so the page has one contract to render,
 * and one place (here) to delete once every deployment has the new route.
 */
const groupLegacyRows = (rows = []) => {
  const byName = new Map();
  for (const row of rows) {
    // `standard_indicator` is the normalized name; `indicator` is what the
    // source document actually called it. Group on the normalized one so the
    // same test from three sources is one row, not three.
    const name = row.standard_indicator || row.indicator;
    if (!name) continue;
    const unit = row.parsed_unit || row.unit || "";
    if (!byName.has(name)) {
      byName.set(name, {
        indicator: name,
        code: "",
        system: "",
        unit,
        count: 0,
        readings: [],
        last_time: null,
      });
    }
    const entry = byName.get(name);
    if (!entry.unit && unit) entry.unit = unit;
    const time = row.start_time || row.created_at || row.end_time || null;
    entry.count += 1;
    entry.readings.push({
      value: row.parsed_value ?? row.value,
      unit,
      time,
      source: row.source || "",
      file_name: row.category || "",
    });
    if (time && (!entry.last_time || time > entry.last_time)) {
      entry.last_time = time;
    }
  }
  // Newest reading first, so the table's "latest" column is actually latest.
  for (const entry of byName.values()) {
    entry.readings.sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));
  }
  return [...byName.values()];
};

// The legacy endpoint caps a page at 200 rows whatever you ask for, and it is
// reading-major — so a single page yields per-indicator counts that are really
// "…among the 200 most recent readings", which disagreed with the same
// indicator's count under a search. Walk the pages instead, up to a bound that
// keeps a large account from firing dozens of requests.
const LEGACY_PAGE_SIZE = 200;
const LEGACY_MAX_PAGES = 10;

const legacyLookup = async ({ query, target_user_id }, signal) => {
  const params = target_user_id ? { target_user_id } : undefined;
  const rows = [];
  let total = 0;

  for (let page = 1; page <= LEGACY_MAX_PAGES; page += 1) {
    const res = await mcpRequestInstance.post(
      "/api/v1/health-indicator/watch",
      { page, page_size: LEGACY_PAGE_SIZE, ...(query ? { query } : {}) },
      { params, signal },
    );
    const batch = res?.data || res?.list || res?.records || [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    total = res?.total ?? rows.length;
    if (rows.length >= total) break;
  }

  return {
    catalog: groupLegacyRows(rows),
    // True when a very large account was cut off — the UI says "counts cover
    // the N most recent readings" rather than quietly under-reporting.
    partial: total > rows.length,
    scanned: rows.length,
  };
};

/** List every indicator this user has (name, code, count, date range). */
export const getIndicatorCatalog = async ({ target_user_id, signal } = {}) => {
  try {
    return await mcpRequestInstance.get(BASE, {
      params: target_user_id ? { target_user_id } : undefined,
      signal,
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return legacyLookup({ target_user_id }, signal);
  }
};

/** Search indicators by fuzzy keyword, returning matches with their readings. */
export const searchIndicators = async (
  { keywords, indicators, start_time, end_time, limit, target_user_id } = {},
  signal,
) => {
  try {
    return await mcpRequestInstance.get(BASE, {
      params: {
        ...(keywords ? { keywords } : {}),
        ...(indicators ? { indicators } : {}),
        ...(start_time ? { start_time } : {}),
        ...(end_time ? { end_time } : {}),
        ...(limit ? { limit } : {}),
        ...(target_user_id ? { target_user_id } : {}),
      },
      signal,
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const { catalog, partial, scanned } = await legacyLookup(
      { query: keywords || indicators, target_user_id },
      signal,
    );
    return { indicators: catalog, partial, scanned };
  }
};

/** Readings for ONE indicator, by its exact name — the detail drawer's source. */
export const getIndicatorReadings = (
  { indicator, start_time, end_time, limit = 200, target_user_id } = {},
  signal,
) =>
  searchIndicators(
    { indicators: indicator, start_time, end_time, limit, target_user_id },
    signal,
  );

/**
 * Correct or soft-delete one reading the CURRENT USER owns (extraction
 * mis-reads a value now and then; this is the fix-in-place). `id` comes from
 * the readings payload. Pass {value} to correct, {delete: true} to remove.
 */
export const patchIndicatorReading = ({ id, value, delete: del } = {}, signal) =>
  mcpRequestInstance.post(
    `${BASE}/reading`,
    { id, ...(del ? { delete: true } : { value }) },
    { signal },
  );
