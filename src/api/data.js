import { mcpRequestInstance } from "../service/request";
import { buildPaginatedRequestBody } from "../utils/request";

/**
 * Get health indicator records with filters and pagination
 * @param {Object} params - Query parameters
 * @param {Object} [params.filters={}] - Filter options
 * @param {string[]} [params.filters.category] - Category filter array
 * @param {string[]} [params.filters.source] - Source filter array
 * @param {string} [params.query] - Search query string
 * @param {string} [params.start_time] - Start time filter
 * @param {string} [params.end_time] - End time filter
 * @param {number} [params.page] - Page number
 * @param {number} [params.page_size] - Page size
 * @param {string} [params.target_user_id] - Target user ID (query param)
 * @param {Array<Object>} [params.order] - Sort order array
 * @param {string} params.order[].order_key - Sort field name
 * @param {string} params.order[].order_type - Sort type (asc/desc)
 * @param {AbortSignal} [signal] - Abort signal for request cancellation
 * @returns {Promise} Promise resolving to health indicator data
 */
export const getHealthIndicator = (
  {
    filters = {},
    query,
    start_time,
    end_time,
    page,
    page_size,
    target_user_id,
    order,
  },
  signal,
) => {
  const requestBody = buildPaginatedRequestBody({
    page,
    page_size,
    filters,
    filterKeys: ["category", "source"],
    query,
    start_time,
    end_time,
    order,
  });

  return mcpRequestInstance.post(
    "/api/v1/health-indicator/watch",
    requestBody,
    { params: { target_user_id }, signal },
  );
};

/**
 * Update a health indicator record
 * @param {number|string} id - Health indicator record ID
 * @param {Object} data - Update data
 * @param {string} [data.value] - New value for the indicator
 * @param {string} target_user_id - Target user ID
 * @returns {Promise} Promise resolving to updated health indicator data
 */
export const updateHealthIndicator = (id, data, target_user_id) => {
  return mcpRequestInstance.put(
    `/api/v1/health-indicator/watch/${id}?target_user_id=${target_user_id}`,
    data,
  );
};

/**
 * Get health indicator categories and sources
 * @returns {Promise<Object>} Promise resolving to categories data with category and source arrays
 */
export const getHealthIndicatorCategories = () => {
  return mcpRequestInstance.get("/api/v1/health-indicator/categories");
};

/**
 * Delete health indicator records by IDs
 * @param {number[]|string[]} record_ids - Array of record IDs to delete
 * @returns {Promise} Promise resolving to deletion result
 */
export const deleteHealthIndicator = (record_ids) => {
  return mcpRequestInstance.delete("/api/v1/health-indicator/watch", {
    data: {
      record_ids,
    },
  });
};

/**
 * Get latest health indicator records
 * @param {Object} params - Request parameters
 * @param {string} [params.target_user_id] - Target user ID (optional, uses token if not provided)
 * @param {number} [params.limit=20] - Maximum number of records to return
 * @returns {Promise} Promise resolving to latest health indicator data
 */
export const getLatestHealthIndicator = ({ target_user_id, limit = 20 } = {}) => {
  const params = { limit };
  if (target_user_id) {
    params.target_user_id = target_user_id;
  }
  return mcpRequestInstance.get(
    "/api/v1/health-indicator/watch/latest",
    { params },
  );
};

/**
 * Get available user data scenes list
 * @returns {Promise<Array>} Promise resolving to array of scene objects with schemas
 */
export const listUserDataScene = () => {
  return mcpRequestInstance.get("/api/v1/udata/list_user_data_scene");
};

/**
 * Search user data by scene
 * @param {Object} params - Query parameters
 * @param {string} params.scene - Data scene name (e.g., 'medicine')
 * @param {string} [params.start_time] - Start time filter
 * @param {string} [params.end_time] - End time filter
 * @param {Array<Object>} [params.order] - Sort order array
 * @param {number} [params.page] - Page number
 * @param {number} [params.page_size] - Page size
 * @param {string} [params.target_user_id] - Target user ID
 * @returns {Promise<Object>} Promise resolving to paginated data result
 */
export const searchUserData = ({
  scene,
  start_time,
  end_time,
  order,
  page,
  page_size,
  target_user_id,
}) => {
  const requestBody = buildPaginatedRequestBody({
    page,
    page_size,
    start_time,
    end_time,
    order,
  });

  return mcpRequestInstance.post(
    "/api/v1/udata/search_user_data",
    { scene, ...requestBody },
    { params: { target_user_id } },
  );
};

/**
 * Update user data record
 * @param {Object} params - Update parameters
 * @param {string} params.scene - Data scene name (e.g., 'medicine')
 * @param {number|string} params.id - Record ID to update
 * @param {string} params.update_key - Field key to update
 * @param {*} params.update_value - New value for the field
 * @param {string} [params.target_user_id] - Target user ID
 * @returns {Promise<Object>} Promise resolving to update result with success status
 */
export const updateUserData = ({
  scene,
  id,
  update_key,
  update_value,
  target_user_id,
}) => {
  return mcpRequestInstance.post(
    "/api/v1/udata/update_user_data",
    {
      scene,
      id,
      update_key,
      update_value,
    },
    {
      params: {
        target_user_id,
      },
    },
  );
};

/**
 * delete_user_data
 * @param {Object} params - Delete parameters
 * @param {string} params.scene - Data scene name (e.g., 'medicine')
 * @param {number[]|string[]} params.record_ids - Record IDs to delete
 * @param {string} [params.target_user_id] - Target user ID
 * @returns {Promise<Object>} Promise resolving to delete result with success status
 */
export const deleteUserData = ({ scene, ids, target_user_id }) => {
  return mcpRequestInstance.post(
    "/api/v1/udata/delete_user_data",
    {
      scene,
      ids,
    },
    {
      params: {
        target_user_id,
      },
    },
  );
};
