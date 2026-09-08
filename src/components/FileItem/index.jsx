import styles from "./index.module.scss";
import ChatDeleteSVG from "../../assets/chat-delete.svg?react";
import FileType from "../FileType";
import { formatFileSize } from "../../utils/file";
import { FILE_STATUS } from "../../enum/file";
import { useTranslation } from "react-i18next";

function FileItem({
  datasource,
  onClickDelete = () => {},
  is_show_delete = true,
  onClick = () => {},
}) {
  const isUploading = datasource?.status === FILE_STATUS.UPLOADING;
  const isError = datasource?.status === FILE_STATUS.ERROR;
  const isSuccess = datasource?.status === FILE_STATUS.SUCCESS;
  const { t } = useTranslation();

  return (
    <div
      className={`${styles.file_item} ${isError ? styles.error : ""} ${
        isSuccess ? styles.success : ""
      }`}
      onClick={() => onClick(datasource)}
    >
      {is_show_delete && (
        <ChatDeleteSVG
          className={styles.file_delete_icon}
          onClick={(e) => {
            e.stopPropagation();
            onClickDelete(datasource);
          }}
        />
      )}
      <div className={styles.file_name}>{datasource.file_name}</div>
      <div className="flex justify-between w-full">
        <div className={styles.file_info}>
          <FileType type={datasource.file_type} />
          <span>|</span>
          <div className={styles.file_size}>
            {formatFileSize(datasource.file_size)}
          </div>
        </div>
        {isUploading && (
          <div className="text-sm text-gray-500">{datasource.progress}%</div>
        )}
        {isError && (
          <div className="text-sm text-red-500">{t("upload_failed")}</div>
        )}
      </div>
    </div>
  );
}

export default FileItem;
