import { useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";
import {
  openSelectFileDialog,
  handleOnDropFiles,
} from "../../../utils/file";
import { useChartInputStore } from "../../../store/Chart/input";
import uploadIcon from "../../../assets/chat-upload-new.png";
import consola from "consola";

const EmptyContent = () => {
  const { t } = useTranslation();
  // The composer, handed down by the chat page so it can sit between the
  // greeting and the drop zone (see pages/Chat/index.jsx). Optional: this route
  // is only ever rendered with it, but a missing context should not throw.
  const { composer } = useOutletContext() || {};
  const [isDragging, setIsDragging] = useState(false);
  const startUploadFilesToServer = useChartInputStore(
    (state) => state.startUploadFilesToServer,
  );

  /* upload files */
  const onClickUploadArea = async () => {
    try {
      const files = await openSelectFileDialog();
      startUploadFilesToServer(files);
    } catch (error) {
      consola.error("ERROR: onClickUploadArea", error);
    }
  };

  const onDragEnter = (e) => {
    e.preventDefault();
    if (isDragging) return;
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    if (!isDragging) return;
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const onDrop = (e) => {
    setIsDragging(false);
    const files = handleOnDropFiles(e);
    startUploadFilesToServer(files);
  };

  return (
    <div className={styles.page}>
      <div className={styles.stack}>
        <div className={styles.title}>{t("hi_how_can_i_help_you_today")}</div>
        {/* Asking is the primary action, so it comes first and widest. */}
        {composer}
        <button
          type="button"
          className={`${styles.upload} ${isDragging ? styles.upload_dragging : ""}`}
          onClick={onClickUploadArea}
          onDragEnter={onDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <img src={uploadIcon} alt="" className={styles.upload_icon} />
          <span className={styles.upload_body}>
            <span className={styles.upload_title}>{t("upload_files")}</span>
            <span className={styles.upload_desc}>
              {t(
                "you_can_click_this_area_to_upload_from_your_computer_or_drag_and_drop_here",
              )}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default EmptyContent;
