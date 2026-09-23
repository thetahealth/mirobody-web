import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router";
import UploadFiles from "./UploadFiles";
import { useUploadStore } from "../../store/upload";
import { useAccountStore } from "../../store/account";
import { useTranslation } from "react-i18next";
import { useDriveStore } from "../../store/Drive";
import { useSystemStore } from "../../store/system";
import { useVitalStore } from "../../store/vital";
import getWebSocketManager from "../../utils/websocket/WebSocketManager";
import consola from "consola";
import ProviderList from "./ProviderList";
import Records from "./Records";
import DriveHeader from "./DriveHeader";
import Tabs from "./Tabs";
import { VITAL_STATUS } from "../../enum/vital";
import styles from "./index.module.scss";

const TAB_KEYS = ["records", "upload_files", "connect_data_source"];

const DrivePage = () => {
  // ?tab= is how the indicators page crosses over to a specific tab here (its
  // empty state offers "upload a report" and "connect a source", both of which
  // now live on this page). Unknown or missing falls back to files.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(() =>
    TAB_KEYS.includes(requestedTab) ? requestedTab : "records",
  );
  // Arriving with ?tab= means the reader came from the indicators page asking
  // for a specific thing ("upload a report" / "connect a source"). Seeding the
  // highlight flashes the area they came for, which is what these triggers did
  // when that jump was a tab switch inside one page. 1 is enough: the panels
  // only test for > 0.
  const [highlightTrigger] = useState(() =>
    requestedTab === "connect_data_source" ? 1 : 0,
  );
  const [filesHighlightTrigger] = useState(() =>
    requestedTab === "upload_files" ? 1 : 0,
  );
  const uploadFilesRef = useRef(null);
  const connectedWearablesRef = useRef(null);
  const fetchFileList = useUploadStore((state) => state.fetchFileList);
  // The roster feeds DriveHeader's person switcher. The sidebar used to fetch
  // it as a side effect of rendering the care-circle list; that list is a page
  // of its own now, so the page that needs the data asks for it.
  const fetchBeneficiaryUsers = useAccountStore(
    (state) => state.fetchBeneficiaryUsers,
  );
  const fileTotal = useUploadStore((state) => state.total);
  const providers_list = useVitalStore((state) => state.providers_list);
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const isShowMobileSource = useSystemStore(
    (state) => state.isShowMobileSource,
  );
  const isShowJournal = useSystemStore((state) => state.isShowJournal);
  const { t } = useTranslation();

  const connectedCount = providers_list.filter(
    (item) => item.status === VITAL_STATUS.CONNECTED,
  ).length;
  const hasSources = isShowMobileSource && providers_list.length > 0;

  // Three tabs, three ways something gets into the record: you write it, you
  // upload it, or a device sends it. The READINGS they produce are their own
  // page (工作区 › 指标) — the output does not belong at the same level as its
  // own plumbing. Each tab carries its own count, which is what the old
  // four-counter strip was really for.
  //
  // 记录 is hidden on a backend that explicitly says it has no journal route;
  // see store/system.js for why the flag defaults on.
  const TABS = [
    ...(isShowJournal ? [{ value: "records", label: t("records_tab") }] : []),
    { value: "upload_files", label: t("files_tab"), count: fileTotal },
    {
      value: "connect_data_source",
      label: t("connect_data_source"),
      count: connectedCount,
    },
  ];

  // Fetch on mount, not only when a drive user id happens to be in state: both
  // endpoints scope themselves by the bearer token, and gating on the id meant
  // that on a fresh login the counters silently stayed at zero.
  useEffect(() => {
    fetchFileList();
  }, [current_drive_user_id, fetchFileList]);

  useEffect(() => {
    fetchBeneficiaryUsers();
  }, [fetchBeneficiaryUsers]);

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
      <MobileTopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
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
                // does not remount it — refetch explicitly.
                if (tab === "upload_files") fetchFileList();
              }}
            />

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

            {/* Mounted only while selected: it fetches on mount, and the two
                panels above stay mounted precisely so they do not refetch. */}
            {isShowJournal && activeTab === "records" ? <Records /> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrivePage;
