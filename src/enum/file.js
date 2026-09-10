export const FILE_STATUS = {
  PENDING: "pending",
  UPLOADING: "uploading",
  SUCCESS: "success",
  ERROR: "error",
};

export const FILE_TYPE = {
  PDF: "pdf",
  IMAGE: "image",
  FILE: "file",
  MP4: "mp4",
  TEXT: "text",
  EXCEL: "excel",
};

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const MAX_FILE_COUNT = 10;
/**
 * allowed MIME types
 * image/png, image/jpeg, image/webp, image/heic, image/heif
 * pdf, application/pdf
 * text/plain (only for genetic files)
 * excel/xlsx, excel/xls
 */
export const ALLOWED_FILE_TYPES = [
  // text — genetic raw data (.txt) and notes/reports (.md); both parse
  // through the backend TextHandler
  "text/plain",
  "text/markdown",
  // image
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  // pdf
  "application/pdf",
  // excel
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
  // csv
  "text/csv",
];
