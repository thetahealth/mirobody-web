import styles from "./index.module.scss";
import PDFIcon from "../../assets/file-pdf.svg?react";
import MP4Icon from "../../assets/file-mp4.svg?react";
import FileIcon from "../../assets/file-file.svg?react";
import ExcelIcon from "../../assets/file-excel.svg?react";
import { FILE_TYPE } from "../../enum/file";

const ICON_MAP = {
  [FILE_TYPE.PDF]: PDFIcon,
  [FILE_TYPE.MP4]: MP4Icon,
  [FILE_TYPE.EXCEL]: ExcelIcon,
  [FILE_TYPE.FILE]: FileIcon,
  // [FILE_TYPE.IMAGE]: ImageIcon,
};

const TYPE_MAP = {
  [FILE_TYPE.PDF]: "PDF",
  [FILE_TYPE.MP4]: "MP4",
  [FILE_TYPE.EXCEL]: "Excel",
  [FILE_TYPE.FILE]: "File",
  [FILE_TYPE.IMAGE]: "Image",
};

function FileType({ type, fontColor = "rgba(0, 0, 0, 0.60)" }) {
  const Icon = ICON_MAP[type];

  return (
    <div className={styles.file_type}>
      <div className={styles.icon}>
        {Icon ? (
          <Icon width={12} height={12} />
        ) : (
          <FileIcon width={12} height={12} />
        )}
      </div>
      <div className={styles.type} style={{ color: fontColor }}>
        {TYPE_MAP[type] || "File"}
      </div>
    </div>
  );
}

export default FileType;
