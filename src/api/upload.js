import { mcpRequestInstance } from "../service/request";

// /files/upload - single file with progress
export const uploadSingleFileWithProgress = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("files", file);
  return mcpRequestInstance.post("/files/upload", formData, {
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        onUploadProgress({
          loaded: progressEvent.loaded,
          total: progressEvent.total,
          percentage: percentCompleted,
        });
      }
    },
  });
};

// /files/upload - multiple files
export const uploadFilesToS3 = ({ files, onUploadProgress }) => {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  return mcpRequestInstance.post("/files/upload", formData, {
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        onUploadProgress({
          loaded: progressEvent.loaded,
          total: progressEvent.total,
          percentage: percentCompleted,
        });
      }
    },
  });
};

/* get uploaded files */
export const getUploadedFiles = ({ limit, offset, signal, user_id }) => {
  const params = {
    limit,
    offset,
  };
  user_id && (params.target_user_id = user_id);
  return mcpRequestInstance.get("/api/v1/data/uploaded-files", {
    params,
    signal,
  });
};
/* delete uploaded file */
export const deleteUploadedFile = (message_id, file_key) => {
  const params = {
    message_id,
  };
  if (file_key) {
    params.file_keys = [file_key];
  }
  return mcpRequestInstance.post("/api/v1/data/delete-files", params);
};

/* Re-file one document's readings under a report date, or confirm the upload
   day (#53: a multi-screenshot report carries its date on page 1 only, so the
   other pages' readings landed on the upload day). `report_date` is
   "YYYY-MM-DD"; omit it to keep the upload day and stop the prompt. No
   target_user_id travels: the backend reads the file's owner itself and applies
   the care-circle WRITE grant. */
export const setFileReportDate = ({ file_key, report_date }) => {
  const body = { file_key };
  if (report_date) body.report_date = report_date;
  return mcpRequestInstance.post("/api/v1/health-indicators/file-date", body);
};
