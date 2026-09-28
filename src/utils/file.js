import { t } from "i18next";
import Modal from "../components/Modal/index";
import { ERROR_CODE } from "../enum/error";
import { ALLOWED_FILE_TYPES, FILE_TYPE, MAX_FILE_SIZE } from "../enum/file";
import { SNIFF_BYTES, mayBeGenotypeType, sniffGenotypeHeader } from "./genotypeFormat.js";
import consola from "consola";

export const getFileType = (file_type) => {
  if (!file_type) {
    return null;
  }
  // Image types
  if (file_type.includes("image")) {
    return FILE_TYPE.IMAGE;
  }

  // PDF type
  if (file_type.includes("pdf")) {
    return FILE_TYPE.PDF;
  }

  // MP4 video type
  if (file_type.includes("mp4") || file_type.includes("video")) {
    return FILE_TYPE.MP4;
  }
  // text type
  if (file_type === "text/plain") {
    return FILE_TYPE.TEXT;
  }

  // Excel type
  if (isExcelMimeType(file_type)) {
    return FILE_TYPE.EXCEL;
  }

  // Default to file for all other types
  return FILE_TYPE.FILE;
};

export const isExcelMimeType = (mimeType) => {
  const excelMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
  ];
  return excelMimeTypes.includes(mimeType);
};

export const isExcelFile = (filename, contentType) => {
  if (!filename) {
    return false;
  }

  // Check file extensions
  const excelExtensions = [".xlsx", ".xls", ".xlsm", ".xlsb"];
  const filenameLower = filename.toLowerCase();
  const hasExcelExtension = excelExtensions.some((ext) =>
    filenameLower.endsWith(ext),
  );

  // Check MIME types
  const hasExcelMime = isExcelMimeType(contentType);

  return hasExcelExtension || hasExcelMime;
};

// `accept` narrows what the picker offers (e.g. "application/pdf" or
// "image/*"); the upload itself still takes anything.
export const openSelectFileDialog = (accept = "*/*") => {
  return new Promise((resolve, reject) => {
    try {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = true;
      fileInput.accept = accept;
      fileInput.onchange = (e) => {
        const _files = [];
        for (const file of e.target.files) {
          _files.push({
            file,
            file_name: file.name,
            file_size: file.size,
            file_type: getFileType(file.type),
            original_file_type: file.type,
          });
        }
        resolve(_files);
      };
      fileInput.click();
    } catch (error) {
      reject(error);
    }
  });
};

export const openSelectFileDialogCallback = (callback) => {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = "*/*";
  fileInput.onchange = (e) => {
    callback(e);
  };
  fileInput.click();
};

export const formatFileSize = (size) => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

export const handleOnDropFiles = (e) => {
  e.preventDefault();
  e.stopPropagation();
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    // Convert native File objects to the expected structure
    const formattedFiles = Array.from(files).map((file) => ({
      file,
      file_name: file.name,
      file_size: file.size,
      file_type: getFileType(file.type),
    }));
    return formattedFiles;
  }
  return [];
};

export const validateFilesPromiseConfirm = async (files) => {
  try {
    if (!files || files.length === 0) {
      throw new Error(ERROR_CODE.FILES_EMPTY);
    }
    //
    for (const file of files) {
      // Check if it's a genetic file first (no size limit for genetic files)
      if (await isGeneticFile(file)) {
        continue; // Allow genetic files without size restriction
      }

      // For non-genetic files, check file size
      if (file.file.size > MAX_FILE_SIZE) {
        throw new Error(ERROR_CODE.FILE_SIZE_TOO_LARGE);
      }

      // Check if file type is allowed
      if (!ALLOWED_FILE_TYPES.includes(file.file.type)) {
        throw new Error(ERROR_CODE.FILE_TYPE_NOT_ALLOWED);
      }
    }
    return files;
  } catch (error) {
    return new Promise((resolve, reject) => {
      if (error.message === ERROR_CODE.FILES_EMPTY) {
        Modal.confirm({
          isShowCancelButton: false,
          title: t("upload_files_title"),
          content: t("please_select_at_least_one_file_to_upload"),
          onOk: () => {
            reject(error);
          },
        });
      } else if (error.message === ERROR_CODE.FILE_TYPE_NOT_ALLOWED) {
        Modal.confirm({
          title: t("upload_files_title"),
          content: t("please_select_only_allowed_file_types"),
          onOk: () => {
            reject(error);
          },
          isShowCancelButton: false,
        });
      } else if (error.message === ERROR_CODE.FILE_SIZE_TOO_LARGE) {
        Modal.confirm({
          title: t("upload_files_title"),
          content: t("please_select_files_smaller_than_20mb"),
          onOk: () => {
            reject(error);
          },
          isShowCancelButton: false,
        });
      } else {
        reject(error);
      }
    });
  }
};

/**
 * A raw genotype export (WeGene, 23andMe, AncestryDNA, MyHeritage), which is
 * exempt from the size cap. See utils/genotypeFormat.js for the rules and why
 * the old check (WeGene's banner, whole file read) refused the other three.
 */
export const isGeneticFile = async (file) => {
  try {
    if (!mayBeGenotypeType(file.file.type)) {
      return false;
    }
    const head = await file.file.slice(0, SNIFF_BYTES).text();
    return sniffGenotypeHeader(head) !== null;
  } catch (error) {
    consola.error("ERROR: isGeneticFile", error);
    return false;
  }
};
