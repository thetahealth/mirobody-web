import { useState } from "react";
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
    <div className="flex-1 flex flex-col items-center w-full overflow-auto max-md:px-4">
      <div className="min-h-[366px] flex-1 flex flex-col items-center justify-center gap-[64px] max-md:min-h-0 max-md:gap-[32px]">
        <div className={styles.title}>{t("hi_how_can_i_help_you_today")}</div>
        <div
          className={`${styles.upload} ${isDragging ? styles.upload_dragging : ""}`}
          onClick={onClickUploadArea}
          onDragEnter={onDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <img src={uploadIcon} alt="" className={styles.upload_icon} />
          <div className={styles.upload_title}>{t("upload_files")}</div>
          <div className={styles.upload_desc}>
            {t(
              "you_can_click_this_area_to_upload_from_your_computer_or_drag_and_drop_here",
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyContent;
