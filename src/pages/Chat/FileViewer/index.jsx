import styles from "./index.module.scss";
import FileType from "../../../components/FileType";
import PreviewDownloadSVG from "../../../assets/preview-download.svg?react";
import PreviewCloseSVG from "../../../assets/preview-close.svg?react";
import { useChatPreviewStore } from "../../../store/Chart/preview";

function FileViewer() {
  const preview_file = useChatPreviewStore((state) => state.preview_file);
  const setPreviewFile = useChatPreviewStore((state) => state.setPreviewFile);
  const setIsShowPreview = useChatPreviewStore(
    (state) => state.setIsShowPreview,
  );
  const { url, type, size, filename } = preview_file;

  const handleClose = () => {
    setPreviewFile(null);
    setIsShowPreview(false);
  };

  return (
    <div className={styles.file_viewer}>
      <div className={styles.header}>
        <div className={styles.info}>
          <div className={styles.name}>{filename}</div>
          <div className={styles.detail}>
            <FileType type={type} fontColor="#fff" />
            <div className={styles.line}></div>
            <div className={styles.size}>{size}</div>
          </div>
        </div>
        <div className={styles.btns}>
          <a href={url} download className={styles.btn} target="_blank">
            <PreviewDownloadSVG />
          </a>

          <PreviewCloseSVG className={styles.btn} onClick={handleClose} />
        </div>
      </div>
      {type === "pdf" && (
        <iframe
          src={`${url}#navpanes=0&scrollbar=0`}
          width="100%"
          height="100%"
        />
      )}
      {type === "image" && (
        <img className={styles.image} src={url} alt="preview" />
      )}
    </div>
  );
}

export default FileViewer;
