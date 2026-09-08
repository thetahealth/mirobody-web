import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";
import uploadImg from "../../../assets/upload.png";
import uploadButtonImg from "../../../assets/upload_icon.png";
import { useEffect, useState } from "react";
import pauseImg from "../../../assets/pause.png";
import doneImg from "../../../assets/cancel.png";
import useUpload from "../../../hooks/useUpload";
import consola from "consola";
function Upload() {
  const { t } = useTranslation();
  const [progress] = useState(10);
  const { lastMessage, uploadFiles } = useUpload();

  useEffect(() => {
    try {
      if (lastMessage !== null) {
        if (!lastMessage.data) {
          throw new Error("lastMessage data is null");
        }
        JSON.parse(lastMessage?.data);
        // const { type } = data;
        // if (type === "connection_established") {
        // }
      }
    } catch (error) {
      consola.error("ERROR:: ws:: ", error);
    }
  }, [lastMessage]);

  const handleDrop = (e) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className={styles.upload}>
      <div className={styles.title}>{t("upload_title")}</div>
      <div className={styles.description}>{t("upload_description")}</div>
      <div
        className={styles.drop_area}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <img className={styles.upload_img} src={uploadImg} alt="upload" />
        <div className={styles.upload_text}>{t("upload_text")}</div>
        <div className={styles.or}>{t("or")}</div>
        <div className={styles.upload_button}>
          <img
            className={styles.upload_button_icon}
            src={uploadButtonImg}
            alt="upload"
          />
          <div className={styles.upload_button_text}>
            {t("upload_button_text")}
          </div>
        </div>
      </div>
      <div className={styles.process_wrapper}>
        <div className={styles.process_bar}>
          <div className={styles.process_line}></div>
        </div>
        <div
          className={styles.process_cover}
          style={{ width: `${100 - progress}%` }}
        ></div>
        <div className={styles.process_status}>{t("uploading")}...</div>
        <div className={styles.btns}>
          <img src={pauseImg} alt="" className={styles.btn} />
          <img src={doneImg} alt="" className={styles.btn} />
        </div>
      </div>
    </div>
  );
}

export default Upload;
