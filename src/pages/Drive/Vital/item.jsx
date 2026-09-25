import styles from "./index.module.scss";
import { IconUnlink } from "@tabler/icons-react";
import { useState } from "react";
import PasswordModal from "./PasswordModal/index.jsx";
import api from "../../../api/index.js";
import Modal from "../../../components/Modal/index.jsx";
import { useTranslation } from "react-i18next";
import { useVitalStore } from "../../../store/vital.js";
import { useDriveStore } from "../../../store/Drive";
import { useAccountStore } from "../../../store/account";
import { getApiBaseUrl } from "../../../utils";
import consola from "consola";
import { VITAL_STATUS } from "../../../enum/vital.js";

const VitalItem = ({ datasource }) => {
  const [isOpenPasswordModel, setIsOpenPasswordModel] = useState(false);

  const { t } = useTranslation();
  const fetchProvidersList = useVitalStore((state) => state.fetchProvidersList);
  const current_drive_user_id = useDriveStore((state) => state.current_drive_user_id);
  const currentUserId = useAccountStore((state) => state.user_id);

  const onClosePasswordModel = () => {
    setIsOpenPasswordModel(false);
  };

  /* click connect btn */
  const onClickConnectBtn = async () => {
    const auth_type = datasource?.auth_type;
    switch (auth_type) {
      case "password":
        setIsOpenPasswordModel(true);
        break;
      case "oauth":
      case "oauth2":
      case "oauth1": {
        const _host = getApiBaseUrl();
        const { platform, slug } = datasource;
        const redirect_url =
          platform === "theta"
            ? `${_host}/api/v1/pulse/${platform}/${slug}/callback`
            : "theta-app://";
        // Only pass owner_user_id when viewing other user's data
        const params = {
          provider_slug: slug,
          platform,
          auth_type: "oauth2",
          redirect_url,
        };
        if (current_drive_user_id && current_drive_user_id !== currentUserId) {
          params.owner_user_id = current_drive_user_id;
        }
        const { link_web_url } = await api.linkPulseProvider(params);
        if (link_web_url) {
          window.open(link_web_url, "_blank");
        }
        break;
      }
      default:
        // coming soon
        break;
    }
  };

  const onClickUnlink = async () => {
    try {
      // Only pass owner_user_id when viewing other user's data
      const params = {
        provider_slug: datasource?.slug,
        platform: datasource?.platform,
      };
      if (current_drive_user_id && current_drive_user_id !== currentUserId) {
        params.owner_user_id = current_drive_user_id;
      }
      await api.unlinkPulseProvider(params);
      fetchProvidersList();
    } catch (error) {
      consola.error("ERROR: onClickUnlink", error);
    }
  };

  const handleUnlinkClick = () => {
    Modal.confirm({
      title: t("do_you_want_to_unlink"),
      onOk: onClickUnlink,
      okText: t("yes"),
      cancelText: t("no"),
    });
  };
  // Render helper (not a component): invoked inline so React Compiler doesn't
  // see a component defined during render. It only reads closures, no hooks.
  const renderVitalItemButton = () => {
    if (datasource?.status === VITAL_STATUS.CONNECTED) {
      return (
        <div className={styles.connected}>
          {t("connected")}
          {datasource?.platform !== "apple" && (
            <IconUnlink
              size={16}
              stroke={1.8}
              className={styles.unlink_icon}
              onClick={handleUnlinkClick}
            />
          )}
        </div>
      );
    }
    if (datasource?.status === VITAL_STATUS.RECONNECT) {
      return (
        <div
          onClick={onClickConnectBtn}
          className="h-[28px] w-[120px] bg-[var(--color-bg-soft)] rounded-[8px] text-[var(--color-accent)] text-[14px] flex items-center justify-center cursor-pointer"
        >
          {t("reconnect")}
        </div>
      );
    }

    if (
      datasource?.status === VITAL_STATUS.AVAILABLE &&
      datasource?.supported
    ) {
      return (
        <div
          onClick={onClickConnectBtn}
          className="h-[28px] w-[120px] bg-[var(--color-bg-soft)] rounded-[8px] text-[var(--color-accent)] text-[14px] flex items-center justify-center cursor-pointer"
        >
          {t("connect")}
        </div>
      );
    }
    if (
      datasource?.status === VITAL_STATUS.AVAILABLE &&
      !datasource?.supported
    ) {
      return (
        <div className="text-[var(--color-text-muted)] text-[14px] font-[500] h-[28px] w-[120px] flex items-center justify-center user-select-none">
          {t("coming_soon")}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-[332px] h-[60px] overflow-hidden flex items-center p-[16px] border border-[var(--color-border)] rounded-[12px]">
      {datasource?.logo && (
        <div className="w-[28px] h-[28px] rounded-[8px] overflow-hidden mr-[12px] border border-[var(--color-border)]">
          <img
            src={datasource?.logo}
            alt={datasource?.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1">{datasource?.name || ""}</div>
      {renderVitalItemButton()}

      <PasswordModal
        isOpen={isOpenPasswordModel}
        onClose={onClosePasswordModel}
        datasource={datasource}
      />
    </div>
  );
};

export default VitalItem;
