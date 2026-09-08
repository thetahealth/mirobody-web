export const ERROR_CODE = {
  FILE_TYPE_NOT_ALLOWED: "file_type_not_allowed",
  FILE_SIZE_TOO_LARGE: "file_size_too_large",
  FILES_EMPTY: "files_empty",
};

/**
 * SSE Error Types Enum
 * Values are i18n keys for direct translation lookup
 */
export const SSE_ERROR_TYPE = {
  HTTP_ERROR: "sse_error_http",
  NETWORK_ERROR: "sse_error_network",
  PARSE_ERROR: "sse_error_parse",
  STREAM_ERROR: "sse_error_stream",
  INVALID_RESPONSE: "sse_error_invalid_response",
  BACKEND_ERROR: "sse_error_backend", // Special: uses original backend message
};
