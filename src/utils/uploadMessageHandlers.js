/**
 * WebSocket Upload Message Handlers
 * Strategy pattern implementation for handling different message types
 */

import { useDriveStore } from "../store/Drive";
import { useUploadStore } from "../store/upload";
import consola from "consola";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current drive user ID
 * @returns {string}
 */
const getCurrentUserId = () =>
  useDriveStore.getState().current_drive_user_id || "";

/**
 * Extract file info from message
 * @param {Object} message - WebSocket message
 * @returns {Object|null} - File info or null
 */
const extractFileInfo = (message) => {
  if (message.files && message.files.length > 0) {
    const file = message.files[0];
    return {
      file_name: file.filename,
      file_size: file.size,
      file_type: file.contentType,
    };
  }

  if (message.filename) {
    return {
      file_name: message.filename,
      file_size: message.size || 0,
      file_type: message.contentType || "",
    };
  }

  return null;
};

/**
 * Check if file already exists in uploading files
 * @param {string} messageId
 * @param {string} userId
 * @returns {boolean}
 */
const isFileAlreadyUploading = (messageId, userId) => {
  const userFiles =
    useUploadStore.getState().uploading_files.get(userId) || new Map();
  return userFiles.has(messageId);
};

/**
 * Normalize progress status for consistent handling
 * @param {Object} params
 * @returns {Object} - Normalized { progress, status, message }
 */
const normalizeProgressStatus = ({ status, progress, message }) => {
  if (status === "completed") {
    return {
      progress: 100,
      status: "complete",
      message: message || "Upload completed",
    };
  }
  if (status === "failed") {
    return {
      progress: progress || 0,
      status: "failed",
      message: message || "Upload failed",
    };
  }
  return {
    progress: progress || 0,
    status: status || "uploading",
    message: message || "",
  };
};

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Handle upload start messages
 * Adds file to uploading list if not already present
 */
const handleUploadStart = (message, { addUploadingFile }) => {
  const { messageId } = message;
  if (!messageId) return;

  const userId = getCurrentUserId();
  if (isFileAlreadyUploading(messageId, userId)) return;

  const fileInfo = extractFileInfo(message);
  if (fileInfo) {
    addUploadingFile(messageId, fileInfo, userId);
  }
};

/**
 * Handle upload progress messages
 * Updates progress, handles completed/failed states
 */
const handleUploadProgress = (message, { updateUploadingProgress }) => {
  const { messageId, progress, status, message: msg } = message;
  if (!messageId) return;

  const userId = getCurrentUserId();
  const normalized = normalizeProgressStatus({
    status,
    progress,
    message: msg,
  });

  updateUploadingProgress(
    messageId,
    normalized.progress,
    normalized.status,
    normalized.message,
    userId,
  );
};

/**
 * Handle file received messages
 */
const handleFileReceived = (message, { updateUploadingProgress }) => {
  const { messageId, progress, status, message: msg } = message;
  if (!messageId) return;

  const userId = getCurrentUserId();
  updateUploadingProgress(
    messageId,
    progress || 100,
    status || "received",
    msg || "",
    userId,
  );
};

/**
 * Handle upload completed messages
 */
const handleUploadCompleted = (message, { updateUploadingProgress }) => {
  const { messageId, message: msg } = message;
  if (!messageId) return;

  const userId = getCurrentUserId();
  updateUploadingProgress(
    messageId,
    100,
    "complete",
    msg || "Upload completed",
    userId,
  );
};

/**
 * Extraction progress for one file, pushed by the backend AFTER the upload
 * finished (#53). `report_date_detected` arrives within seconds — it is what
 * lets the "which date?" bar appear while the 15-25 s indicator extraction is
 * still running; `extraction_completed` brings the count and the date the
 * readings were filed under.
 */
const handleReportDateDetected = (message, { notePendingDate }) => {
  if (!message.file_key) return;
  notePendingDate?.(message);
};

const handleExtractionCompleted = (message, { notePendingDate, refreshFileList }) => {
  if (!message.file_key) return;
  notePendingDate?.(message);
  refreshFileList?.();
};

/**
 * Handle upload error messages
 */
const handleUploadError = (message, { updateUploadingProgress }) => {
  const { messageId, progress, message: msg } = message;
  if (!messageId) return;

  const userId = getCurrentUserId();
  updateUploadingProgress(
    messageId,
    progress || 0,
    "failed",
    msg || "Upload failed",
    userId,
  );
};

/**
 * Handle error messages (log only)
 */
const handleError = (message) => {
  consola.error("useUpload:: WebSocket error message", message);
};

/**
 * No-op handler for messages that don't need processing
 */
const noop = () => {};

// ============================================================================
// Handler Map (Strategy Pattern)
// ============================================================================

/**
 * Create message handlers map
 * @param {Object} deps - Dependencies (addUploadingFile, updateUploadingProgress)
 * @returns {Object} - Handler map
 */
export const createUploadMessageHandlers = (deps) => ({
  // Connection messages
  connection_established: noop,
  pong: noop,

  // Upload lifecycle messages
  upload_start: (msg) => handleUploadStart(msg, deps),
  upload_start_confirmed: (msg) => handleUploadStart(msg, deps),
  upload_end_response: noop,

  // Progress messages
  upload_progress: (msg) => handleUploadProgress(msg, deps),
  file_progress: (msg) => handleUploadProgress(msg, deps),
  file_received: (msg) => handleFileReceived(msg, deps),

  // Completion messages
  upload_completed: (msg) => handleUploadCompleted(msg, deps),

  // Post-upload extraction (#53)
  report_date_detected: (msg) => handleReportDateDetected(msg, deps),
  extraction_completed: (msg) => handleExtractionCompleted(msg, deps),

  // Error messages
  upload_error: (msg) => handleUploadError(msg, deps),
  error: handleError,
});

/**
 * Process WebSocket message using handler map
 * @param {Object} message - WebSocket message with type field
 * @param {Object} handlers - Handler map from createUploadMessageHandlers
 * @returns {boolean} - Whether message was handled
 */
export const processUploadMessage = (message, handlers) => {
  const { type } = message;
  const handler = handlers[type];

  if (handler) {
    handler(message);
    return true;
  }

  // Unknown message type - log for debugging
  if (type) {
    consola.debug("useUpload:: Unhandled message type:", type);
  }

  return false;
};
