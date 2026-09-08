import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { ACCESS_TOKEN } from "../enum/storage";
import { formatFileSize } from "../utils/file";
import { v4 as uuidv4 } from "uuid";
import consola from "consola";
import { t } from "i18next";
import { useUploadStore } from "../store/upload";
import { useDriveStore } from "../store/Drive";
import getWebSocketManager from "../utils/websocket/WebSocketManager";
import {
  createUploadMessageHandlers,
  processUploadMessage,
} from "../utils/uploadMessageHandlers";

// Constants
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

const useUpload = () => {
  const updateUploadingProgress = useUploadStore(
    (state) => state.updateUploadingProgress,
  );
  const addUploadingFile = useUploadStore((state) => state.addUploadingFile);

  // State for WebSocket connection
  const [lastMessage, setLastMessage] = useState(null);
  const [lastJsonMessage, setLastJsonMessage] = useState(null);
  const wsManagerRef = useRef(null); // Lazy initialization - will be created on first use

  // Handle 401 Unauthorized errors
  const handle401Error = useCallback((errorMessage) => {
    if (!errorMessage) return false;
    const is401 =
      errorMessage.includes("401") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("Token expired") ||
      errorMessage.includes("Authentication failed") ||
      (errorMessage.toLowerCase().includes("token") &&
        errorMessage.toLowerCase().includes("invalid"));

    if (is401) {
      localStorage.removeItem(ACCESS_TOKEN);
      window.location.href = `/login?redirect=${encodeURIComponent(
        window.location.pathname,
      )}`;
      return true;
    }
    return false;
  }, []);

  // WebSocket event handler
  const handleWebSocketEvent = useCallback((eventType, data, userId) => {
    const current_drive_user_id =
      useDriveStore.getState().current_drive_user_id || "";

    // Only process messages for current user (ignore messages from other users)
    if (userId && userId !== current_drive_user_id) {
      return;
    }

    if (eventType === "error") {
      consola.error("useUpload:: handleWebSocketEvent:: error", data);
    } else if (eventType === "message" && data) {
      const messageEvent = {
        data: JSON.stringify(data),
      };
      setLastMessage(messageEvent);
      setLastJsonMessage(data);
    }
  }, []);

  // Get or create WebSocketManager instance (lazy initialization)
  const getWsManager = useCallback(() => {
    if (!wsManagerRef.current) {
      wsManagerRef.current = getWebSocketManager();
    }
    return wsManagerRef.current;
  }, []);

  useEffect(() => {
    const wsManager = getWsManager();

    // Add listener to receive messages (both from direct connection and broadcast)
    wsManager.addListener(handleWebSocketEvent);

    // Cleanup
    return () => {
      if (wsManager) {
        wsManager.removeListener(handleWebSocketEvent);
      }
    };
  }, [handleWebSocketEvent, getWsManager]);

  // Send message wrapper
  const sendMessage = useCallback(
    (message) => {
      const wsManager = getWsManager();
      return wsManager.sendMessage(message);
    },
    [getWsManager],
  );

  // Create message handlers (memoized to avoid recreation)
  const notePendingDate = useUploadStore((state) => state.notePendingDate);
  const fetchFileList = useUploadStore((state) => state.fetchFileList);
  const messageHandlers = useMemo(
    () =>
      createUploadMessageHandlers({
        addUploadingFile,
        updateUploadingProgress,
        notePendingDate,
        refreshFileList: fetchFileList,
      }),
    [addUploadingFile, updateUploadingProgress, notePendingDate, fetchFileList],
  );

  // Process WebSocket messages using Handler Map (Strategy Pattern)
  useEffect(() => {
    if (!lastMessage || !lastJsonMessage) return;

    try {
      // Handle 401 Unauthorized errors first
      if (handle401Error(lastJsonMessage.message)) return;

      // Process message using handler map
      processUploadMessage(lastJsonMessage, messageHandlers);
    } catch (error) {
      consola.error("useUpload::WebSocket message processing error", error);
    }
  }, [lastMessage, lastJsonMessage, handle401Error, messageHandlers]);

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Convert file chunk to base64
  const fileChunkToBase64 = (file, start, end) => {
    return new Promise((resolve, reject) => {
      const chunk = file.slice(start, end);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(chunk);
    });
  };

  // Start file upload with chunking
  const startUpload = useCallback(
    async (files, uploadOptions = {}) => {
      const wsManager = getWsManager();

      if (!wsManagerRef.current) {
        wsManagerRef.current = wsManager;
        wsManager.addListener(handleWebSocketEvent);
      }

      // Ensure WebSocket connection is available (connects if needed)
      try {
        await wsManager.ensureConnected();
      } catch (error) {
        consola.error(
          "useUpload:: startUpload:: Failed to ensure connection:",
          error,
        );
        return { error: t("upload_error_connection") };
      }

      const sessionId = uploadOptions.sessionId || uuidv4();
      const messageIds = [];

      // Get current user ID for storing upload progress (once for all files)
      const current_drive_user_id =
        useDriveStore.getState().current_drive_user_id || "";

      if (!current_drive_user_id) {
        consola.error(
          "useUpload::startUpload - No current_drive_user_id, cannot add files to uploading_files",
        );
      }

      // Upload each file with chunking
      for (const file of files) {
        try {
          const messageId = uploadOptions.messageId || uuidv4();
          messageIds.push(messageId);

          // Add file to uploading_files FIRST (before sending message)
          // This ensures file info is available even if server response doesn't include it
          if (current_drive_user_id) {
            addUploadingFile(
              messageId,
              {
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
              },
              current_drive_user_id,
            );
          }

          // Send upload start for each file
          const startMessage = {
            type: "upload_start",
            messageId,
            sessionId,
            query: uploadOptions.query || "",
            isFirstMessage: uploadOptions.isFirstMessage || false,
            files: [
              {
                filename: file.name,
                contentType: file.type,
                size: file.size,
              },
            ],
            query_user_id: uploadOptions.query_user_id || "",
            ...(uploadOptions.metadata && { metadata: uploadOptions.metadata }),
          };

          sendMessage(JSON.stringify(startMessage));

          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

          if (file.size <= CHUNK_SIZE) {
            // Small file: single chunk
            const base64Data = await fileToBase64(file);
            sendMessage(
              JSON.stringify({
                type: "upload_chunk",
                messageId,
                filename: file.name,
                contentType: file.type,
                chunk: base64Data,
                chunkIndex: 0,
                totalChunks: 1,
                fileSize: file.size,
              }),
            );
          } else {
            // Large file: multiple chunks
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
              const start = chunkIndex * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const base64Data = await fileChunkToBase64(file, start, end);

              sendMessage(
                JSON.stringify({
                  type: "upload_chunk",
                  messageId,
                  filename: file.name,
                  contentType: file.type,
                  chunk: base64Data,
                  chunkIndex,
                  totalChunks,
                  fileSize: file.size,
                }),
              );
            }
          }

          // Send upload end for each file
          sendMessage(
            JSON.stringify({
              type: "upload_end",
              messageId,
              sessionId,
            }),
          );
        } catch (error) {
          consola.error("ERROR: startUpload", error);
          return null;
        }
      }

      return messageIds;
    },
    [sendMessage, getWsManager, handleWebSocketEvent, addUploadingFile],
  );

  /**
   * Simple upload function
   * @param {Array<{file: File, file_name: string, file_size: number, file_type: string}>} files - Array of file info objects
   * @param {Object} payload - Upload options (e.g., { query_user_id: string })
   * @returns {Promise<Array<string>|null>} Array of messageIds if successful, null otherwise
   * @note Files should be validated by validateFilesPromiseConfirm before calling this function
   */
  const uploadFiles = useCallback(
    async (files, payload = {}) => {
      try {
        // Extract File objects from file info objects
        const fileObjects = files.map((f) => f.file);

        // Start upload with File objects
        const messageIds = await startUpload(fileObjects, payload);

        // If upload started successfully, add files to store
        if (messageIds && messageIds.length === files.length) {
          files.forEach((fileInfo, index) => {
            addUploadingFile(messageIds[index], {
              ...fileInfo,
              show_file_size: formatFileSize(fileInfo.file_size),
            });
          });
        }

        return messageIds;
      } catch (error) {
        consola.error("ERROR:: uploadFiles::", error);
        return null;
      }
    },
    [startUpload, addUploadingFile],
  );

  // Get upload status
  const getUploadStatus = useCallback(
    (messageId) => {
      sendMessage(JSON.stringify({ type: "get_status", messageId }));
    },
    [sendMessage],
  );

  return {
    sendMessage,
    lastMessage,
    uploadFiles,
    startUpload,
    getUploadStatus,
  };
};

export default useUpload;
