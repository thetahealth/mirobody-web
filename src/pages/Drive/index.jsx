import Header from "../../components/Header";
import Menu from "./Menu";
import ResponsiveSidebar from "../../components/ResponsiveSidebar";
import { useEffect, useState, useRef } from "react";
import UploadFiles from "./UploadFiles";
import { useUploadStore } from "../../store/upload";
import { useDistributionStore } from "../../store/distribution";
import { useTranslation } from "react-i18next";
import { useDriveStore } from "../../store/Drive";
import { useSystemStore } from "../../store/system";
import { useVitalStore } from "../../store/vital";
import getWebSocketManager from "../../utils/websocket/WebSocketManager";
import consola from "consola";
import ProviderList from "./ProviderList";
import DriveHeader from "./DriveHeader";
import IndicatorsPanel from "./Indicators";
import Tabs from "./Tabs";
import { VITAL_STATUS } from "../../enum/vital";
import styles from "./index.module.scss";

const DrivePage = () => {
  const [activeTab, setActiveTab] = useState("indicators");
  const [highlightTrigger, setHighlightTrigger] = useState(0);
  const [filesHighlightTrigger, setFilesHighlightTrigger] = useState(0);
  const [indicatorsRefreshTrigger, setIndicatorsRefreshTrigger] = useState(0);
  const uploadFilesRef = useRef(null);
  const connectedWearablesRef = useRef(null);
  const fetchFileList = useUploadStore((state) => state.fetchFileList);
  const fileTotal = useUploadStore((state) => state.total);
  const fetchDistribution = useDistributionStore(
    (state) => state.fetchDistribution,
  );
  const readingTotal = useDistributionStore((state) => state.total_records);
  const providers_list = useVitalStore((state) => state.providers_list);
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const isShowMobileSource = useSystemStore(
    (state) => state.isShowMobileSource,
  );
  const { t } = useTranslation();

  const connectedCount = providers_list.filter(
    (item) => item.status === VITAL_STATUS.CONNECTED,
  ).length;
  const hasSources = isShowMobileSource && providers_list.length > 0;

  // Indicators first and default: the standardized readings are what the user
  // came for. Files and connectors are how the data got here — plumbing, one
  // click away rather than in front of the thing it produces. Each tab carries
  // its own count, which is what the old four-counter strip was really for.
  const TABS = [
    { value: "indicators", label: t("indicators_tab"), count: readingTotal },
    { value: "upload_files", label: t("files_tab"), count: fileTotal },
    {
      value: "connect_data_source",
      label: t("connect_data_source"),
      count: connectedCount,
    },
  ];

  const onFilesClick = () => {
    setActiveTab("upload_files");
    fetchFileList();
    setFilesHighlightTrigger((prev) => prev + 1);
  };

  const onDataSourceClick = () => {
    setActiveTab("connect_data_source");
    setHighlightTrigger((prev) => prev + 1);
  };

  // Fetch on mount, not only when a drive user id happens to be in state: both
  // endpoints scope themselves by the bearer token, and gating on the id meant
  // that on a fresh login the counters silently stayed at zero.
  useEffect(() => {
    fetchFileList();
    fetchDistribution();
  }, [current_drive_user_id, fetchFileList, fetchDistribution]);

  useEffect(() => {
    if (!current_drive_user_id) return;
    const wsManager = getWebSocketManager();
    if (!wsManager.getCurrentConnection()) {
      consola.warn(
        `DrivePage::Cannot get connection for user ${current_drive_user_id}`,
      );
      return;
    }
    if (!wsManager.isConnected() && !wsManager.isConnecting()) {
      wsManager.tryConnect();
    }
  }, [current_drive_user_id]);

  return (
    <div
      className="w-[100vw] h-dvh flex flex-col overflow-hidden"
      id="drive_page"
    >
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <ResponsiveSidebar drawerWidth={300}>
          <Menu />
        </ResponsiveSidebar>
        <div className={styles.scroll}>
          {/* One content column, so the page stops having three right edges. */}
          <div className={styles.column}>
            <DriveHeader />
            <Tabs
              tabs={TABS}
              value={activeTab}
              onChange={(tab) => {
                setActiveTab(tab);
                // Tab panels stay mounted (hidden divs), so re-activating one
                // does not remount it — refetch explicitly. Indicator
                // extraction finishes seconds after an upload is Processed,
                // and this is the moment the user comes back to look.
                if (tab === "indicators") {
                  setIndicatorsRefreshTrigger((prev) => prev + 1);
                  fetchDistribution();
                } else if (tab === "upload_files") {
                  fetchFileList();
                }
              }}
            />

            <div hidden={activeTab !== "indicators"}>
              <IndicatorsPanel
                onEmptyUploadClick={onFilesClick}
                onEmptyConnectClick={onDataSourceClick}
                refreshTrigger={indicatorsRefreshTrigger}
              />
            </div>

            <div hidden={activeTab !== "connect_data_source"}>
              <div className="flex flex-col gap-[var(--space-8)] pb-[var(--space-12)]">
                {hasSources ? (
                  <ProviderList
                    highlightTrigger={highlightTrigger}
                    connectedWearablesRef={connectedWearablesRef}
                  />
                ) : (
                  // A deployment with no provider credentials configured has
                  // genuinely nothing to connect. Say that, rather than showing
                  // an empty page and letting the user wonder what broke.
                  <div className="py-[var(--space-16)] text-center">
                    <div className="text-[16px] font-[500] text-[var(--color-text-primary)]">
                      {t("sources_empty_title")}
                    </div>
                    <div className="mt-[var(--space-3)] text-[14px] text-[var(--color-text-secondary)] max-w-[46ch] mx-auto leading-relaxed">
                      {t("sources_empty_body")}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div hidden={activeTab !== "upload_files"} ref={uploadFilesRef}>
              <UploadFiles filesHighlightTrigger={filesHighlightTrigger} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrivePage;
