import Modal from "./index.jsx";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import styles from "./ShareModal.module.scss";
import ModalCloseSVG from "../../assets/modal_close.svg?react";
import api from "../../api";
import { CopyOutlined, CheckOutlined, ReloadOutlined } from "@ant-design/icons";
import consola from "consola";

const ShareModal = ({ isOpen, onClose, sessionId }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      consola.error("Copy failed:", err);
    }
  };

  const createShare = useCallback(async () => {
    setLoading(true);
    setError("");
    setShareUrl("");

    try {
      const { share_session_id } = await api.createShare({
        session_id: sessionId,
      });
      const url = `${window.location.origin}/share/${share_session_id}`;
      setShareUrl(url);
      // Auto copy to clipboard
      await copyToClipboard(url);
    } catch (err) {
      consola.error("Create share error:", err);
      setError(t("share_error"));
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    if (isOpen && sessionId) {
      createShare();
    }
  }, [isOpen, sessionId, createShare]);

  const handleCopy = () => {
    if (shareUrl) {
      copyToClipboard(shareUrl);
    }
  };

  const handleClose = () => {
    setShareUrl("");
    setError("");
    setCopied(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className={styles.shareModal}>
        <h2 className={styles.title}>{t("share_title")}</h2>
        <ModalCloseSVG
          onClick={handleClose}
          className="cursor-pointer absolute top-[20px] right-[20px]"
        />

        <div className={styles.content}>
          <div className={styles.urlContainer}>
            <div
              className={`${styles.urlDisplay} ${
                error ? styles.urlDisplayError : ""
              } ${shareUrl && !loading && !error ? styles.urlDisplayLink : ""}`}
              onClick={() => {
                if (shareUrl && !loading && !error) {
                  window.open(shareUrl, "_blank");
                }
              }}
            >
              {loading
                ? t("creating_share_link")
                : error
                ? t("share_error")
                : shareUrl}
            </div>
            <button
              className={styles.copyButton}
              onClick={error ? createShare : handleCopy}
              disabled={loading}
            >
              {error ? (
                <>
                  <ReloadOutlined />
                  {t("retry")}
                </>
              ) : copied ? (
                <>
                  <CheckOutlined />
                  {t("copied")}
                </>
              ) : (
                <>
                  <CopyOutlined />
                  {t("copy_link")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ShareModal;
