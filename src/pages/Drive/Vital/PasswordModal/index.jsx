import Modal from "../../../../components/Modal";
import styles from "./index.module.scss";
import ModalCloseSVG from "../../../../assets/modal_close.svg?react";
import { useState, useContext } from "react";
import api from "../../../../api";
import { useVitalStore } from "../../../../store/vital";
import { useDriveStore } from "../../../../store/Drive";
import { useAccountStore } from "../../../../store/account";
import { NotificationContext } from "../../../../context";
import consola from "consola";

const PasswordModel = ({ isOpen, onClose, datasource }) => {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState("");
  const fetchProvidersList = useVitalStore((state) => state.fetchProvidersList);
  const current_drive_user_id = useDriveStore((state) => state.current_drive_user_id);
  const currentUserId = useAccountStore((state) => state.user_id);
  const { messageApi } = useContext(NotificationContext);

  const onChangeAccount = (e) => {
    setAccount(e.target.value);
  };
  const onChangePassword = (e) => {
    setPassword(e.target.value);
  };
  const clear = () => {
    setAccount("");
    setPassword("");
    setAccountError("");
    setPasswordError("");
    setConnectStatus("");
  };
  const onClickCancel = () => {
    clear();
    onClose();
  };
  const onClickOK = async () => {
    try {
      if (!account) {
        setAccountError("Please fill the blank");
        return;
      }
      if (!password) {
        setPasswordError("Please fill the blank");
        return;
      }
      setAccountError("");
      setPasswordError("");
      setLoading(true);
      const { slug, platform, auth_type } = datasource;
      // Only pass owner_user_id when viewing other user's data
      const params = {
        provider_slug: slug,
        platform,
        auth_type,
        username: account,
        password: password,
      };
      if (current_drive_user_id && current_drive_user_id !== currentUserId) {
        params.owner_user_id = current_drive_user_id;
      }
      // if (slug.startsWith("theta")) {
      const res = await api.linkPulseProvider(params);
      // }
      if (res?.state === "error") {
        throw new Error(res?.error);
      }
      messageApi.success("Connect success");
      fetchProvidersList();
      setTimeout(() => {
        clear();
        onClose();
      }, 800);
    } catch (error) {
      consola.error("ERROR: onClickOK", error);
      setConnectStatus("error");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} maskClosable={false}>
      <div className={styles.password_model}>
        <div className="text-[18px] font-[500] text-[var(--color-text-primary)] flex items-center border-b border-[var(--color-border)] pb-[16px] mb-[24px]">
          <div className="flex-1">Connect {datasource?.name}</div>
          <ModalCloseSVG onClick={onClose} className="cursor-pointer" />
        </div>
        <div className={styles.form_label}>
          Account <span className={styles.required}>*</span>
        </div>
        <div className={styles.form_input}>
          <input
            type="text"
            placeholder="Enter your email or user ID"
            className={styles.input}
            onChange={onChangeAccount}
            value={account}
          />
        </div>
        <div className={styles.error}>{accountError || ""}</div>
        <div className={styles.form_label}>
          Password <span className={styles.required}>*</span>
        </div>
        <div className={styles.form_input}>
          <input
            type="password"
            placeholder="Enter your password"
            className={styles.input}
            onChange={onChangePassword}
            value={password}
          />
        </div>
        <div className={styles.error}>{passwordError || ""}</div>
        {connectStatus === "error" && (
          <div className="flex items-center h-[24px] text-[var(--color-danger)] text-[16px] font-[500]">
            Connect error please try again
          </div>
        )}
        {connectStatus === "success" && (
          <div className="flex items-center h-[24px] text-[var(--color-accent)] text-[16px] font-[500]">
            Connect success
          </div>
        )}
        <div className="flex items-center justify-end mt-[24px] gap-[12px]">
          <div
            className="flex px-[20px] py-[7px] text-[16px] font-[500] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-[8px] cursor-pointer"
            onClick={onClickCancel}
          >
            Cancel
          </div>
          <div
            className={`flex items-center justify-center px-[20px] py-[7px] text-[16px] font-[500] text-[#fff] rounded-[8px] ${
              loading
                ? "bg-[var(--color-accent)]/60 cursor-not-allowed"
                : "bg-[var(--color-accent)] cursor-pointer"
            }`}
            onClick={loading ? undefined : onClickOK}
          >
            {loading ? "Connecting..." : "Connect"}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PasswordModel;
