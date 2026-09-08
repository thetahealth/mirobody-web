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
 * audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg, audio/flac
 * image/png, image/jpeg, image/webp, image/heic, image/heif
 * pdf, application/pdf
 * text/plain (only for genetic files)
 * excel/xlsx, excel/xls
 */
export const ALLOWED_FILE_TYPES = [
  // audio — browsers report .mp3 as audio/mpeg (audio/mp3 is nonstandard but
  // kept for the browsers that do send it), .m4a as audio/x-m4a or audio/mp4
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-m4a",
  "audio/mp4",
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
