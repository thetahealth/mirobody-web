import { useState, useRef } from "react";
import styles from "./index.module.scss";
// A glyph, not the 169×160 illustration: squeezed to 28px that artwork
// rendered as an unreadable half-clipped smudge next to the copy.
import { CloudUploadOutlined } from "@ant-design/icons";
import {
  openSelectFileDialog,
  handleOnDropFiles,
  validateFilesPromiseConfirm,
} from "../../../../utils/file";
import useUpload from "../../../../hooks/useUpload";
import { useUploadStore } from "../../../../store/upload";
import { useDriveStore } from "../../../../store/Drive";
import { useTranslation } from "react-i18next";
import consola from "consola";

const UploadArea = () => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const { uploadFiles } = useUpload();
  const setPageWithoutFetch = useUploadStore(
    (state) => state.setPageWithoutFetch,
  );
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );

  const handleFiles = async (files) => {
    try {
      if (!files || files.length === 0) {
        return;
      }

      await validateFilesPromiseConfirm(files);
      setPageWithoutFetch(1);
      await uploadFiles(files, {
        query_user_id: current_drive_user_id,
      });
    } catch (error) {
      consola.error("ERROR: handleFiles", error);
    }
  };

  const handleClickUpload = async () => {
    try {
      const files = await openSelectFileDialog();
      handleFiles(files);
    } catch (error) {
      consola.error("Error selecting files:", error);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = handleOnDropFiles(e);
    handleFiles(files);
  };

  return (
    <div
      className={`${styles.uploadContainer} ${
        isDragging ? styles.uploadContainerDragging : ""
      }`}
      onClick={handleClickUpload}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <CloudUploadOutlined className={styles.uploadIcon} />
      <div className={styles.textContainer}>
        <div className={styles.title}>{t("upload_files_title")}</div>
        <div className={styles.description}>
          {t("upload_files_description")}
        </div>
      </div>
    </div>
  );
};

export default UploadArea;
