import styles from "./index.module.scss";
import UploadArea from "./UploadArea";
import FileTable from "./FileTable";
import ReportDateBar from "./ReportDateBar";
import Pagination from "./Pagination";
import { useEffect, useState } from "react";

const UploadFiles = ({ filesHighlightTrigger, pickerRef }) => {
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    if (filesHighlightTrigger > 0) {
      setIsHighlighted(true);
      const timer = setTimeout(() => {
        setIsHighlighted(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [filesHighlightTrigger]);

  return (
    <div className={styles.container}>
      <UploadArea pickerRef={pickerRef} />
      {/* "which date?" for files extraction just found no date on (#53) */}
      <ReportDateBar />
      {/* No inner padding or panel background: the table aligns to the same
          column edge as the tabs and the upload row above it. */}
      <div className={isHighlighted ? styles.highlight_blink : ""}>
        <FileTable />
        <Pagination />
      </div>
    </div>
  );
};

export default UploadFiles;
