import { useTranslation } from "react-i18next";
import { useVitalStore } from "../../../store/vital";
import { useEffect, useMemo, useState } from "react";
import { useSystemStore } from "../../../store/system";
import { useDriveStore } from "../../../store/Drive";
import AppleHealthPNG from "../../../assets/apple_health.png";
import { VITAL_STATUS } from "../../../enum/vital";
import styles from "../index.module.scss";
import VitalItem from "../Vital/item";

const ProviderList = ({ highlightTrigger, connectedWearablesRef }) => {
  const { t } = useTranslation();
  const loading_providers = useVitalStore((state) => state.loading_providers);
  const providers_list = useVitalStore((state) => state.providers_list);
  const fetchProvidersList = useVitalStore((state) => state.fetchProvidersList);
  const isShowMobileSource = useSystemStore(
    (state) => state.isShowMobileSource,
  );
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );

  const apple_health = useMemo(() => {
    return providers_list.find((provider) => provider.platform === "apple");
  }, [providers_list]);
  const connected_wearables = useMemo(() => {
    return providers_list.filter(
      (item) =>
        item.status === VITAL_STATUS.CONNECTED &&
        item.platform !== "apple" &&
        item.platform !== "ehr",
    );
  }, [providers_list]);
  const unconnected_wearables = useMemo(() => {
    return providers_list.filter(
      (item) =>
        (item.status === VITAL_STATUS.AVAILABLE ||
          item.status === VITAL_STATUS.RECONNECT) &&
        item.platform !== "apple" &&
        item.platform !== "ehr",
    );
  }, [providers_list]);

  // highlight state
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    if (!isShowMobileSource) {
      return;
    }
    // Wait for current_drive_user_id to be initialized
    if (!current_drive_user_id) {
      return;
    }

    fetchProvidersList();
  }, [isShowMobileSource, current_drive_user_id, fetchProvidersList]);

  useEffect(() => {
    if (highlightTrigger > 0) {
      setIsHighlighted(true);
      const timer = setTimeout(() => {
        setIsHighlighted(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [highlightTrigger]);

  if (!isShowMobileSource) {
    return null;
  }

  if (loading_providers) {
    return (
      <>
        <div className="text-[var(--color-text-primary)] text-[16px] font-[500] mb-[24px]">
          {t("mobile_apps")}
        </div>
        <div className="flex items-center gap-[16px]">
          <div className="w-[332px] h-[60px] bg-gray-100 rounded-[12px] border border-[var(--color-border)] animate-pulse flex items-center p-[16px]">
            <div className="w-[28px] h-[28px] rounded-full bg-gray-200 mr-[12px]"></div>
            <div className="flex-1 h-[16px] bg-gray-200 rounded"></div>
            <div className="w-[120px] h-[28px] bg-gray-200 rounded-[8px] ml-[12px]"></div>
          </div>
          <div className="w-[332px] h-[60px] bg-gray-100 rounded-[12px] border border-[var(--color-border)] animate-pulse flex items-center p-[16px]">
            <div className="w-[28px] h-[28px] rounded-full bg-gray-200 mr-[12px]"></div>
            <div className="flex-1 h-[16px] bg-gray-200 rounded"></div>
            <div className="w-[120px] h-[28px] bg-gray-200 rounded-[8px] ml-[12px]"></div>
          </div>
        </div>
        <div className="text-[var(--color-text-primary)] text-[16px] font-[500] mb-[16px]">
          {t("wearables")}
        </div>
        <div className="flex flex-wrap gap-[16px]">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="w-[332px] h-[60px] bg-gray-100 rounded-[12px] border border-[var(--color-border)] animate-pulse flex items-center p-[16px]"
            >
              <div className="w-[28px] h-[28px] rounded-full bg-gray-200 mr-[12px]"></div>
              <div className="flex-1 h-[16px] bg-gray-200 rounded"></div>
              <div className="w-[120px] h-[28px] bg-gray-200 rounded-[8px] ml-[12px]"></div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Google Health was a permanent "coming soon" tile — a promise, not a
          feature. Only sources that can actually be connected are listed. */}
      {apple_health && (
        <>
          <div className="text-[var(--color-text-primary)] text-[16px] font-[500]">
            {t("mobile_apps")}
          </div>
          <div className="flex items-center gap-[16px]">
            <VitalItem
              datasource={{
                ...apple_health,
                logo: AppleHealthPNG,
              }}
            />
          </div>
        </>
      )}
      <div className="flex flex-col gap-[16px]">
        {(unconnected_wearables.length > 0 ||
          connected_wearables.length > 0) && (
          <div className="text-[var(--color-text-primary)] text-[16px] font-[500]">
            {t("wearables")}
          </div>
        )}
        {unconnected_wearables.length > 0 && (
          <div>
            <div className="text-[var(--color-text-secondary)] text-[14px] mb-[10px]">
              {t("unconnected")}
            </div>
            <div className="flex flex-wrap gap-[16px]">
              {unconnected_wearables.map((item, index) => (
                <VitalItem
                  key={`unconnected_wearables_${index}`}
                  datasource={item}
                />
              ))}
            </div>
          </div>
        )}
        {connected_wearables.length > 0 && (
          <div
            className={`text-[var(--color-text-secondary)] text-[14px] mb-[10px] bg-[#FFFF] rounded-[12px] ${
              isHighlighted ? styles.highlight_blink : ""
            }`}
          >
            <div
              ref={connectedWearablesRef}
              className="text-[var(--color-text-secondary)] text-[14px] mb-[10px]"
            >
              {t("connected")}
            </div>
            <div className="flex flex-wrap gap-[16px]">
              {connected_wearables.map((item, index) => (
                <VitalItem
                  key={`connected_wearables_${index}`}
                  datasource={item}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProviderList;
