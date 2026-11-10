import { useEffect, useMemo, useState } from "react";
import styles from "./index.module.scss";
import { useUploadStore } from "../../../../store/upload";
import { useDriveStore } from "../../../../store/Drive";
import Modal from "../../../../components/Modal";
import api from "../../../../api";
import { message } from "antd";
import { useTranslation } from "react-i18next";
import consola from "consola";
import dayjs from "dayjs";
import ReportDateModal from "./ReportDateModal";
import { needsDateConfirm, reportDateOf } from "./reportDate";
import { PROCESSING_POLL_MS, hasProcessingRows, rowActions } from "./rowActions";
import useIsMobile from "../../../../hooks/useIsMobile";
import { openProtectedFile } from "../../../../utils/protectedFile";

const FileTable = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // Subscribe to uploading_files Map directly, then filter by current user
  const uploading_files_map = useUploadStore((state) => state.uploading_files);
  const file_list = useUploadStore((state) => state.file_list);
  const fetchFileList = useUploadStore((state) => state.fetchFileList);
  const removeUploadingFile = useUploadStore(
    (state) => state.removeUploadingFile,
  );
  const isLoading = useUploadStore((state) => state.isLoading);
  const currentPage = useUploadStore((state) => state.currentPage);
  const { current_drive_user_id } = useDriveStore();
  // The file whose report date is being set (#53); null = modal closed.
  const [dateTarget, setDateTarget] = useState(null);

  // Get uploading files for current user only
  const uploading_files = useMemo(() => {
    if (!current_drive_user_id) {
      return new Map();
    }
    return uploading_files_map.get(current_drive_user_id) || new Map();
  }, [uploading_files_map, current_drive_user_id]);

  // Get current timezone offset
  const getTimezoneOffset = () => {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const minutes = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? "+" : "-";
    return `UTC${sign}${String(hours).padStart(2, "0")}:${String(
      minutes,
    ).padStart(2, "0")}`;
  };

  const filteredFileList = useMemo(() => {
    return file_list.filter((item) => !uploading_files.has(item.id));
  }, [file_list, uploading_files]);

  // A file the server is still reading turns complete or failed on its own;
  // ask again until none is left (a reprocessed file has no upload socket to
  // say so). Each answer is a new list, which arms the next ask.
  useEffect(() => {
    if (!hasProcessingRows(file_list)) return undefined;
    const timer = setTimeout(() => fetchFileList({ quiet: true }), PROCESSING_POLL_MS);
    return () => clearTimeout(timer);
  }, [file_list, fetchFileList]);

  // A failed row says why: the server stores the reason on the row (`error`),
  // and the page showed only 处理失败, so an upload that waited on a local model
  // still downloading read like any other failure (thetahealth/mirobody#275).
  const renderStatus = (status, reason = "") => {
    switch (status) {
      case "uploading":
        return (
          <div className={styles.statusContainer}>
            <div className={`${styles.badge} ${styles.badgeYellow}`}>
              {t("uploading")}
            </div>
          </div>
        );
      case "processing":
        return (
          <div className={styles.statusContainer}>
            <div className={`${styles.badge} ${styles.badgeBlue}`}>
              {t("processing")}
            </div>
          </div>
        );
      case "complete":
        return (
          <div className={`${styles.badge} ${styles.badgeGreen}`}>
            {t("processed")}
          </div>
        );
      case "failed":
        return (
          <div className={styles.failedContainer}>
            <span className={styles.failedText}>{t("failed_to_process")}</span>
            {reason ? (
              <span className={styles.failedReason} title={reason}>
                {reason}
              </span>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  // Each action's button: its label, its style and what it does.
  const ACTIONS = {
    view: { label: "view", style: styles.viewButton, run: (data) => handleView(data) },
    set_report_date: { label: "set_report_date", style: styles.viewButton, run: (data) => setDateTarget(data) },
    reprocess: { label: "reprocess", style: styles.viewButton, run: (data) => handleReprocess(data) },
    cancel: { label: "cancel", style: styles.deleteButton, run: (data) => handleCancel(data) },
    delete: { label: "delete", style: styles.deleteButton, run: (data) => handleDelete(data) },
  };

  const renderActions = (data) => {
    const actions = rowActions(data);
    if (!actions.length) return null;
    return (
      <div className={styles.actionButtons}>
        {actions.map((name) => (
          <button key={name} className={ACTIONS[name].style} onClick={() => ACTIONS[name].run(data)}>
            {t(ACTIONS[name].label)}
          </button>
        ))}
      </div>
    );
  };

  // A row of the page's own, for an upload that never reached the server or
  // was already gone from it, has nothing to delete there: the server says
  // 404 and the row just leaves the page.
  const nothingOnServer = (data, error) => data.isUploading && error?.code === 404;

  const handleDelete = (data) => {
    Modal.confirm({
      content: t(
        "if_you_choose_to_delete_this_file_it_will_be_removed_from_the_serve_and_you_can_t_restore_it_again",
      ),
      onOk: async () => {
        try {
          await api.deleteUploadedFile(data.id, data.file_key);
          message.success(t("file_deleted_successfully"));
        } catch (error) {
          if (!nothingOnServer(data, error)) {
            consola.error("ERROR: handleDelete", error);
            message.error(t("delete_failed"));
            return;
          }
        }
        removeUploadingFile(data.id);
        fetchFileList();
      },
    });
  };

  // An upload still in flight is named by its message id alone; the server
  // cancels it and files nothing (thetahealth/mirobody#240).
  const handleCancel = (data) => {
    Modal.confirm({
      content: t("cancel_upload_confirm"),
      onOk: async () => {
        try {
          await api.deleteUploadedFile(data.id);
          message.success(t("upload_cancelled"));
        } catch (error) {
          if (!nothingOnServer(data, error)) {
            consola.error("ERROR: handleCancel", error);
            message.error(t("cancel_failed"));
            return;
          }
        }
        removeUploadingFile(data.id);
        fetchFileList();
      },
    });
  };

  // A failed file read again from its stored copy, its earlier readings
  // replaced (thetahealth/mirobody#239). 409: it is already being read.
  const handleReprocess = async (data) => {
    try {
      await api.reprocessUploadedFile(data.file_key);
      message.success(t("reprocess_started"));
    } catch (error) {
      if (error?.code !== 409) {
        consola.error("ERROR: handleReprocess", error);
        message.error(t("reprocess_failed"));
        return;
      }
    }
    fetchFileList({ quiet: true });
  };

  const handleView = async (data) => {
    // url_full may be RELATIVE (/files/...) — the opensource backend without
    // MCP_PUBLIC_URL serves files same-origin.
    //
    // `window.open(url)` no longer works: /files/ requires a token (it used to
    // serve anyone's health reports to anyone) and a browser sends no
    // Authorization header on a navigation. Fetch it and hand the tab a blob.
    const target = data.url_full || data.file_key;
    if (!target) {
      // Silent no-op is how this bug hid: the button "worked" and nothing
      // happened. Say why instead.
      message.warning(t("file_view_unavailable"));
      return;
    }
    const reason = await openProtectedFile(target, data.file_name);
    if (reason) message.warning(t(reason));
  };

  const renderFileRow = (item, isUploading) => {
    return (
      <tr
        key={item.messageId || item.id}
        className={isUploading ? styles.uploadingRow : ""}
      >
        <td className={styles.tdUploadTime}>
          {dayjs(item.upload_time).format("YYYY-MM-DD HH:mm:ss")}
        </td>
        <td className={styles.tdReportDate}>
          {/* the date the file's READINGS sit on — distinct from the upload
              time — and whether it was read off the document or guessed (#53) */}
          {reportDateOf(item) ? (
            <div className={styles.reportDate}>
              <span>{reportDateOf(item)}</span>
              {item.date_source && (
                <span className={styles.reportDateHint}>
                  {t(`report_date_source_${item.date_source}`)}
                </span>
              )}
            </div>
          ) : (
            "-"
          )}
          {needsDateConfirm(item) && (
            <div className={`${styles.badge} ${styles.badgeYellow}`}>
              {t("report_date_pending")}
            </div>
          )}
        </td>
        <td className={styles.tdFileTitle}>
          {isUploading && item.progress !== undefined && (
            <div
              className={styles.progressBar}
              style={{ width: `${item.progress}%` }}
            />
          )}
          <span className={styles.fileNameText}>{item.file_name}</span>
        </td>
        <td className={styles.tdType}>
          {item.file_type ? item.file_type.toUpperCase() : "-"}
        </td>
        <td className={styles.tdSize}>{item.show_file_size}</td>
        <td className={styles.tdStatus}>{renderStatus(item.upload_status, item.error)}</td>
        <td className={styles.tdActions}>{renderActions(item)}</td>
      </tr>
    );
  };

  // Mobile: same data, rendered as a vertical card list (no 1000px+ table).
  const renderFileCard = (item, isUploading) => (
    <div
      key={item.messageId || item.id}
      className={`${styles.card} ${isUploading ? styles.uploadingRow : ""}`}
    >
      {isUploading && item.progress !== undefined && (
        <div
          className={styles.progressBar}
          style={{ width: `${item.progress}%` }}
        />
      )}
      <div className={styles.cardName}>{item.file_name}</div>
      <div className={styles.cardMeta}>
        <span>{item.file_type ? item.file_type.toUpperCase() : "-"}</span>
        <span>{item.show_file_size}</span>
        <span>{dayjs(item.upload_time).format("YYYY-MM-DD HH:mm")}</span>
      </div>
      <div className={styles.cardFooter}>
        {renderStatus(item.upload_status, item.error)}
        {renderActions(item)}
      </div>
    </div>
  );

  const uploadingRows =
    currentPage === 1 ? Array.from(uploading_files.values()) : [];

  if (isMobile) {
    return (
      <div className={styles.tableContainer}>
        <div
          className={`${styles.tableWrapper} ${
            isLoading ? styles.tableLoading : ""
          }`}
        >
          {isLoading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
            </div>
          )}
          <div className={styles.cardList}>
            {uploadingRows.map((item) => renderFileCard(item, true))}
            {filteredFileList.map((item) => {
              const isUploading =
                item.upload_status &&
                item.upload_status !== "complete" &&
                item.upload_status !== "failed";
              return renderFileCard(item, isUploading);
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <div
        className={`${styles.tableWrapper} ${
          isLoading ? styles.tableLoading : ""
        }`}
      >
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner}></div>
          </div>
        )}
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thUploadTime}>
                {t("upload_time")}({getTimezoneOffset()})
              </th>
              <th className={styles.thReportDate}>{t("report_date")}</th>
              <th className={styles.thFileTitle}>
                <div className={styles.headerContent}>
                  <span>{t("file_title")}</span>
                  {/* <img
                    src={searchIcon}
                    alt="Search"
                    className={styles.headerIcon}
                  /> */}
                </div>
              </th>
              <th className={styles.thType}>
                <div className={styles.headerContent}>
                  <span>{t("type")}</span>
                </div>
              </th>
              <th className={styles.thSize}>{t("size")}</th>
              <th className={styles.thStatus}>{t("status")}</th>
              <th className={styles.thActions}>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {currentPage === 1 &&
              Array.from(uploading_files.values()).map((item) =>
                renderFileRow(item, true),
              )}
            {filteredFileList.map((item) => {
              const isUploading =
                item.upload_status &&
                item.upload_status !== "complete" &&
                item.upload_status !== "failed";
              return renderFileRow(item, isUploading);
            })}
          </tbody>
        </table>
      </div>
      <ReportDateModal
        key={dateTarget?.file_key || "none"}
        file={dateTarget}
        siblings={file_list}
        onClose={() => setDateTarget(null)}
        onDone={() => {
          setDateTarget(null);
          fetchFileList();
        }}
      />
    </div>
  );
};

export default FileTable;
