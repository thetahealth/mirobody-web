import { getLanguage, getApiBaseUrl } from "../utils";
import { ACCESS_TOKEN } from "../enum/storage";
import { SSE_ERROR_TYPE } from "../enum/error";
import { consola } from "consola";

// ============================================================================
// SSE Error Handling Utilities
// ============================================================================

/**
 * Helper function to sanitize sensitive data from headers
 * @param {Object} headers - Request headers
 * @returns {Object} Sanitized headers
 */
const sanitizeHeaders = (headers) => {
  if (!headers) return {};
  const sanitized = { ...headers };
  if (sanitized.Authorization) {
    sanitized.Authorization = "[Filtered]";
  }
  if (sanitized["Authorization"]) {
    sanitized["Authorization"] = "[Filtered]";
  }
  return sanitized;
};

/**
 * Create standardized SSE error object
 * @param {string} errorType - Error type from SSE_ERROR_TYPE
 * @param {string} message - Error message
 * @param {Object} context - Additional context (url, status, etc.)
 * @returns {Object} Standardized error object
 */
const createSSEError = (errorType, message, context = {}) => {
  return {
    type: errorType,
    message: typeof message === "object" ? JSON.stringify(message) : message,
    timestamp: Date.now(),
    ...context,
  };
};

/**
 * Handle SSE error uniformly
 * @param {Object} options - SSE request options containing onerror callback
 * @param {string} errorType - Error type from SSE_ERROR_TYPE
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 * @returns {Object} Standardized error object
 */
const handleSSEError = (options, errorType, message, context = {}) => {
  const sseError = createSSEError(errorType, message, context);

  // Log error with context
  consola.error("SSE Error", sseError);

  // Call onerror callback if provided
  if (options.onerror) {
    options.onerror(sseError);
  }

  return sseError;
};

// ============================================================================
// SSE Request Instance
// ============================================================================

/**
 * SSE Request Instance
 * Handles Server-Sent Events with unified error handling
 *
 * @param {string} apiPath - API endpoint path
 * @param {Object} options - Request options
 * @param {string} [options.method="POST"] - HTTP method
 * @param {string} [options.body] - Request body
 * @param {AbortSignal} [options.signal] - Abort signal
 * @param {Object} [options.headers] - Additional headers
 * @param {Function} [options.onmessage] - Callback for SSE messages
 * @param {Function} [options.onerror] - Callback for errors
 * @param {Function} [options.onclose] - Callback when SSE closes
 * @returns {Promise<void>}
 */
export const sseRequestInstance = async (apiPath, options) => {
  // Declare variables in function scope so they're accessible in catch block
  const headers = {
    Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN)}`,
    "X-Language": getLanguage(),
    "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...options.headers,
  };
  const baseUrl = getApiBaseUrl();
  const _url = `${baseUrl}${apiPath}`;
  const { method, body, signal } = options;
  const _options = {
    method: method || "POST",
    headers,
    body: body,
  };
  if (signal) {
    _options.signal = signal;
  }

  // Flag to prevent duplicate onerror calls
  let errorHandled = false;

  /**
   * Safely handle error - ensures onerror is only called once
   * @param {string} errorType - Error type from SSE_ERROR_TYPE
   * @param {string} message - Error message
   * @param {Object} extraContext - Additional context
   */
  const safeHandleError = (errorType, message, extraContext = {}) => {
    if (errorHandled) return null;
    errorHandled = true;

    const context = {
      url: _url,
      method: _options.method,
      headers: sanitizeHeaders(headers),
      data: body,
      ...extraContext,
    };

    return handleSSEError(options, errorType, message, context);
  };

  try {
    const response = await fetch(_url, _options);

    // Handle HTTP errors (4xx, 5xx)
    if (!response.ok) {
      let responseData = null;
      try {
        const clonedResponse = response.clone();
        responseData = await clonedResponse.text();
        try {
          responseData = JSON.parse(responseData);
        } catch {
          // Keep as string if not JSON
        }
      } catch {
        // Ignore parsing errors
      }

      const errorMessage =
        responseData?.message ||
        responseData?.error ||
        `HTTP error status: ${response.status}`;

      safeHandleError(SSE_ERROR_TYPE.HTTP_ERROR, errorMessage, {
        statusCode: response.status,
        statusText: response.statusText,
        responseData: responseData,
      });

      return Promise.reject(new Error(errorMessage));
    }

    // Check if response is SSE
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("text/event-stream")) {
      safeHandleError(SSE_ERROR_TYPE.INVALID_RESPONSE, "Response is not SSE", {
        contentType: contentType,
        statusCode: response.status,
      });

      return Promise.reject(new Error("Response is not SSE"));
    }

    // Handle as SSE with custom parser
    const reader = response.body?.getReader();
    if (!reader) {
      safeHandleError(
        SSE_ERROR_TYPE.STREAM_ERROR,
        "Response body is not readable",
      );

      return Promise.reject(new Error("Response body is not readable"));
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            try {
              let jsonData;

              // Check if it is standard SSE format: data: {...}
              if (trimmedLine.startsWith("data: ")) {
                // Remove "data: " prefix
                const jsonString = trimmedLine.substring(6);
                // Parse json string
                jsonData = JSON.parse(jsonString);

                // If backend returned an error in the data, handle it
                if (jsonData.error) {
                  safeHandleError(
                    SSE_ERROR_TYPE.BACKEND_ERROR,
                    jsonData.error,
                    { rawData: jsonData },
                  );
                  // Don't throw, let the stream continue or close naturally
                  continue;
                }
              } else if (trimmedLine.startsWith("error: ")) {
                // Handle error: prefix format
                let errorMessage;
                try {
                  const errorObj = JSON.parse(trimmedLine.substring(7));
                  errorMessage =
                    typeof errorObj === "object"
                      ? errorObj.message || JSON.stringify(errorObj)
                      : errorObj;
                } catch {
                  errorMessage = trimmedLine.substring(7);
                }

                safeHandleError(SSE_ERROR_TYPE.BACKEND_ERROR, errorMessage, {
                  rawLine: trimmedLine,
                });
                // Don't throw, let the stream continue or close naturally
                continue;
              } else {
                // Direct JSON format data
                jsonData = JSON.parse(trimmedLine);
              }

              // Call the onmessage callback with parsed data
              if (options.onmessage) {
                options.onmessage(jsonData);
              }
            } catch (parseError) {
              // Only treat as error if it's not a known non-JSON line (like comments or empty events)
              if (
                !trimmedLine.startsWith(":") &&
                trimmedLine !== "event: message"
              ) {
                consola.warn(
                  "Failed to parse SSE line as JSON:",
                  trimmedLine,
                  parseError,
                );

                safeHandleError(
                  SSE_ERROR_TYPE.PARSE_ERROR,
                  `Failed to parse SSE line: ${trimmedLine}`,
                  {
                    parseError: parseError.message,
                    failedLine: trimmedLine,
                  },
                );
              }
            }
          }
        }
      }
    } catch (streamError) {
      // Check if error is due to abort
      const isAborted =
        streamError.name === "AbortError" ||
        streamError.message?.includes("aborted");

      if (!isAborted) {
        safeHandleError(SSE_ERROR_TYPE.STREAM_ERROR, streamError.message, {
          errorName: streamError.name,
        });

        throw streamError;
      }
    } finally {
      reader.releaseLock();
    }

    // Call onclose if provided (only if not aborted)
    if (options.onclose && !options.signal?.aborted) {
      options.onclose();
    }
  } catch (error) {
    // Check if error is due to abort
    const isAborted =
      error.name === "AbortError" || error.message?.includes("aborted");

    if (!isAborted) {
      // Handle any uncaught errors (network errors, etc.)
      safeHandleError(SSE_ERROR_TYPE.NETWORK_ERROR, error.message, {
        errorName: error.name,
      });

      return Promise.reject(error);
    }

    // If aborted, resolve silently without error
    return Promise.resolve();
  }
};
