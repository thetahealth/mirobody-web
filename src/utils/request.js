/**
 * Request body building utilities
 * Provides declarative helpers for constructing API request bodies
 */

/**
 * Check if value is a non-empty array
 * @param {*} value
 * @returns {boolean}
 */
export const isNonEmptyArray = (value) =>
  Array.isArray(value) && value.length > 0;

/**
 * Check if value is a non-empty string (after trim)
 * @param {*} value
 * @returns {boolean}
 */
export const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

/**
 * Check if value is truthy (not null, undefined, empty string, etc.)
 * @param {*} value
 * @returns {boolean}
 */
export const isTruthy = (value) => Boolean(value);

/**
 * Add field to object if value passes validation
 * @param {string} key - Field name
 * @param {*} value - Field value
 * @param {Function} validator - Validation function (default: isTruthy)
 * @param {Function} transformer - Optional transform function for value
 * @returns {Object} - Empty object or object with single key-value pair
 */
export const addIfValid = (
  key,
  value,
  validator = isTruthy,
  transformer = null,
) => {
  if (!validator(value)) {
    return {};
  }
  const finalValue = transformer ? transformer(value) : value;
  return { [key]: finalValue };
};

/**
 * Build request body by merging multiple field objects
 * Filters out empty objects automatically
 * @param  {...Object} fields - Objects to merge (can include empty objects)
 * @returns {Object} - Merged object without empty entries
 */
export const buildRequestBody = (...fields) =>
  fields.reduce((acc, field) => ({ ...acc, ...field }), {});

/**
 * Build filters object from filter parameters
 * Only includes filters that have non-empty array values
 * @param {Object} filters - Filter parameters
 * @param {string[]} filterKeys - Keys to extract from filters
 * @returns {Object} - Filters object or empty object
 */
export const buildFilters = (filters = {}, filterKeys = []) => {
  const filtersObj = filterKeys.reduce((acc, key) => {
    if (isNonEmptyArray(filters[key])) {
      return { ...acc, [key]: filters[key] };
    }
    return acc;
  }, {});

  return Object.keys(filtersObj).length > 0 ? { filters: filtersObj } : {};
};

/**
 * Common request body builder for paginated endpoints
 * @param {Object} params - Request parameters
 * @returns {Object} - Built request body
 */
export const buildPaginatedRequestBody = ({
  page,
  page_size,
  filters,
  filterKeys = [],
  query,
  start_time,
  end_time,
  order,
}) =>
  buildRequestBody(
    { page, page_size },
    buildFilters(filters, filterKeys),
    addIfValid("query", query, isNonEmptyString, (v) => v.trim()),
    addIfValid("start_time", start_time),
    addIfValid("end_time", end_time),
    addIfValid("order", order, isNonEmptyArray),
  );
