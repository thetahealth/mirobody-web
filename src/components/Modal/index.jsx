import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import styles from "./index.module.scss";
import { useTranslation } from "react-i18next";
import ModalWarningSVG from "../../assets/modal_warning.svg?react";
import { Button } from "antd";
import consola from "consola";

const ModalPortal = ({ children }) => {
  return createPortal(children, document.body);
};

const Modal = ({ children, isOpen, onClose, maskClosable = true }) => {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className={styles.modalOverlay}
        onClick={maskClosable ? onClose : undefined}
      >
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      </div>
    </ModalPortal>
  );
};

const ConfirmModal = ({
  title,
  onOk,
  onCancel,
  okText,
  cancelText,
  onClose,
  setMaskClosable,
  loadingText,
  content,
  isShowCancelButton = true,
  OkButton = null,
}) => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const handleOk = async () => {
    if (loading) return;

    setLoading(true);
    setMaskClosable(false);

    try {
      if (onOk) {
        await onOk();
      }
      onClose();
    } catch (error) {
      consola.error("Modal.confirm onOk error:", error);
      setLoading(false);
      setMaskClosable(true);
    }
  };

  const handleCancel = () => {
    if (loading) return;

    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  return (
    <div className={styles.confirmModal}>
      <ModalWarningSVG />
      <div className={styles.confirmTitle}>{title || t("please_confirm")}</div>
      <div className={styles.confirmContent}>{content || ""}</div>
      <div className={styles.confirmButtons}>
        {isShowCancelButton && (
          <Button
            onClick={handleCancel}
            disabled={loading}
            size="large"
            style={{ height: "36px", width: "94px" }}
          >
            {cancelText || t("cancel")}
          </Button>
        )}
        {OkButton ? (
          typeof OkButton === "function" ? (
            <OkButton loading={loading} onClick={handleOk} />
          ) : (
            OkButton
          )
        ) : (
          <Button
            className={styles.okButton}
            onClick={handleOk}
            disabled={loading}
            loading={loading}
            size="large"
            style={{ height: "36px", width: "94px" }}
          >
            {(loading && loadingText) || okText || t("ok")}
          </Button>
        )}
      </div>
    </div>
  );
};

Modal.confirmAsync = (options) => {
  return new Promise((resolve) => {
    Modal.confirm({
      ...options,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
};

Modal.confirm = ({
  title,
  onOk,
  onCancel,
  okText,
  cancelText,
  loadingText,
  content,
  isShowCancelButton = true,
  OkButton = null,
}) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let maskClosable = true;

  const destroy = () => {
    root.unmount();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };

  const setMaskClosable = (value) => {
    maskClosable = value;
    render();
  };

  const render = () => {
    root.render(
      <Modal isOpen={true} onClose={destroy} maskClosable={maskClosable}>
        <ConfirmModal
          title={title}
          onOk={onOk}
          onCancel={onCancel}
          okText={okText}
          cancelText={cancelText}
          onClose={destroy}
          loadingText={loadingText}
          setMaskClosable={setMaskClosable}
          content={content}
          isShowCancelButton={isShowCancelButton}
          OkButton={OkButton}
        />
      </Modal>,
    );
  };

  render();

  return {
    destroy,
  };
};

export default Modal;
