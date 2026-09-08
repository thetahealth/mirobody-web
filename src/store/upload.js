import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import api from "../api";
import { formatFileSize } from "../utils/file";
import { useDriveStore } from "./Drive";
import { useAccountStore } from "./account";
import consola from "consola";

export const useUploadStore = create(
  immer((set, get) => ({
    // Internal state: AbortController
    _uploadedFilesController: null,

    file_list: [],
    total: 0,
    total_size: 0,
    currentPage: 1,
    pageSize: 10,
    // Map<userId, Map<messageId, fileInfo>>
    uploading_files: new Map(),
    isLoading: false,
    // Per-file extraction verdicts pushed after upload (#53), keyed by
    // file_key: {file_key, file_name, sessionId, report_date, date_source,
    // indicators_count, done}. The "which date?" bar reads this; a file
    // leaves it when the user answers or when its date came off the document.
    pending_dates: {},

    addUploadingFile: (messageId, fileInfo, userId) => {
      set((state) => {
        const current_drive_user_id =
          userId || useDriveStore.getState().current_drive_user_id || "";
        if (!current_drive_user_id) {
          consola.warn(
            `useUploadStore::addUploadingFile - No userId provided, messageId: ${messageId}`,
          );
          return;
        }

        if (!state.uploading_files.has(current_drive_user_id)) {
          state.uploading_files.set(current_drive_user_id, new Map());
        }

        const userFiles = state.uploading_files.get(current_drive_user_id);
        userFiles.set(messageId, {
          ...fileInfo,
          messageId,
          id: messageId,
          upload_status: "uploading",
          progress: 0,
          message: "Starting upload...",
          isUploading: true,
        });
      });
    },

    updateUploadingProgress: (messageId, progress, status, message, userId) => {
      set((state) => {
        const current_drive_user_id =
          userId || useDriveStore.getState().current_drive_user_id || "";
        if (!current_drive_user_id) {
          consola.warn(
            "useUploadStore::updateUploadingProgress - No userId provided",
          );
          return;
        }

        const fileIndex = state.file_list.findIndex((f) => f.id === messageId);

        if (fileIndex !== -1) {
          state.file_list[fileIndex].progress = progress;
          state.file_list[fileIndex].upload_status = status;
          state.file_list[fileIndex].message = message;
          // Remove from uploading_files for current user
          const userFiles = state.uploading_files.get(current_drive_user_id);
          if (userFiles) {
            userFiles.delete(messageId);
          }
        } else {
          const userFiles = state.uploading_files.get(current_drive_user_id);
          if (userFiles) {
            const file = userFiles.get(messageId);
            if (file) {
              file.progress = progress;
              file.upload_status = status;
              file.message = message;
            }
          }
        }
      });

      get().checkAndRefreshIfAllCompleted();
    },

    checkAndRefreshIfAllCompleted: () => {
      const { uploading_files } = get();
      const current_drive_user_id =
        useDriveStore.getState().current_drive_user_id || "";

      if (!current_drive_user_id) {
        return;
      }

      const userFiles = uploading_files.get(current_drive_user_id);
      if (!userFiles || userFiles.size === 0) {
        return;
      }

      // Check if all files are either completed or failed (declarative)
      const isFinishedStatus = (status) =>
        status === "complete" || status === "failed";
      const allFinished = Array.from(userFiles.values()).every((file) =>
        isFinishedStatus(file.upload_status),
      );

      // If all files are finished, clear the map for current user and refresh the list
      if (allFinished) {
        get().clearUploadingFiles();
        get().fetchFileList();
      }
    },

    notePendingDate: (event) => {
      set((state) => {
        const prev = state.pending_dates[event.file_key] || {};
        state.pending_dates[event.file_key] = {
          ...prev,
          file_key: event.file_key,
          file_name: event.file_name || prev.file_name || "",
          sessionId: event.sessionId || prev.sessionId || "",
          report_date: event.report_date || prev.report_date || "",
          date_source: event.date_source || prev.date_source || "",
          indicators_count:
            typeof event.indicators_count === "number" ? event.indicators_count : prev.indicators_count,
          done: event.type === "extraction_completed" || prev.done || false,
        };
      });
    },

    clearPendingDates: (fileKeys) => {
      set((state) => {
        for (const k of fileKeys || []) delete state.pending_dates[k];
      });
    },

    removeUploadingFile: (messageId, userId) => {
      if (!messageId) {
        return;
      }
      set((state) => {
        const current_drive_user_id =
          userId || useDriveStore.getState().current_drive_user_id || "";
        if (current_drive_user_id) {
          const userFiles = state.uploading_files.get(current_drive_user_id);
          if (userFiles) {
            userFiles.delete(messageId);
          }
        }
      });
    },

    clearUploadingFiles: (userId) => {
      set((state) => {
        const current_drive_user_id =
          userId || useDriveStore.getState().current_drive_user_id || "";
        if (current_drive_user_id) {
          // Only clear files for the specified user (or current user)
          state.uploading_files.delete(current_drive_user_id);
        }
      });
    },

    // Get uploading files for current user
    getUploadingFilesForCurrentUser: () => {
      const { uploading_files } = get();
      const current_drive_user_id =
        useDriveStore.getState().current_drive_user_id || "";
      if (!current_drive_user_id) {
        return new Map();
      }
      return uploading_files.get(current_drive_user_id) || new Map();
    },

    fetchFileList: async () => {
      const { _uploadedFilesController, currentPage, pageSize } = get();

      // Cancel previous request if exists
      if (_uploadedFilesController) {
        _uploadedFilesController.abort();
      }

      // Create new controller and store it
      const newController = new AbortController();
      set((state) => {
        state._uploadedFilesController = newController;
        state.isLoading = true;
        state.file_list = [];
      });

      try {
        const { current_drive_user_id } = useDriveStore.getState();
        const { user_id: currentUserId } = useAccountStore.getState();
        const offset = (currentPage - 1) * pageSize;

        // Only pass user_id when viewing other user's data
        const params = {
          limit: pageSize,
          offset,
          signal: newController.signal,
        };
        if (current_drive_user_id && current_drive_user_id !== currentUserId) {
          params.user_id = current_drive_user_id;
        }

        const { files, total, total_size } = await api.getUploadedFiles(params);

        set((state) => {
          state.file_list = files.map((f) => ({
            ...f,
            show_file_size: formatFileSize(f.file_size),
          }));
          state.total = total;
          state.total_size = total_size;
          state.isLoading = false;
          state._uploadedFilesController = null;
        });
      } catch (error) {
        if (error.name === "AbortError" || error.name === "CanceledError") {
          return;
        }
        consola.error("ERROR: fetchFileList", error);
        set((state) => {
          state.isLoading = false;
          state._uploadedFilesController = null;
        });
      }
    },

    setPage: (page) => {
      set((state) => {
        state.currentPage = page;
      });
      get().fetchFileList();
    },

    setPageWithoutFetch: (page) => {
      set((state) => {
        state.currentPage = page;
      });
    },

    setPageSize: (pageSize) => {
      set((state) => {
        state.currentPage = 1;
        state.pageSize = pageSize;
      });
      get().fetchFileList();
    },

    nextPage: () => {
      const { currentPage, total, pageSize } = get();
      const totalPages = Math.ceil(total / pageSize);
      if (currentPage < totalPages) {
        set((state) => {
          state.currentPage = currentPage + 1;
        });
        get().fetchFileList();
      }
    },

    prevPage: () => {
      const { currentPage } = get();
      if (currentPage > 1) {
        set((state) => {
          state.currentPage = currentPage - 1;
        });
        get().fetchFileList();
      }
    },
  })),
);
