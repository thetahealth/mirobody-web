import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";
import api from "../../../api/index.js";
import { useEffect, useState } from "react";

function FileList() {
  const { t } = useTranslation();
  const [, setFiles] = useState([]);

  useEffect(() => {
    api.getUploadedFiles({ limit: 10, offset: 0 }).then((res) => {
      setFiles(res);
    });
  }, []);
  return (
    <div className={styles.file_list}>
      <div className={styles.header}>{t("recent_files")}</div>
      <div className={styles.list}>
        <div className={styles.item}>
          <div className={styles.icon}></div>
        </div>
      </div>
    </div>
  );
}

export default FileList;
