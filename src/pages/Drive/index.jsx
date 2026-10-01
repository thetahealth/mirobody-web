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
import DriveHeader from "../../components/DriveHeader";
import EmptyGuide from "./EmptyGuide";
import { useDistributionStore } from "../../store/distribution";
import Tabs from "../../components/Tabs";
import Genomics from "./Genomics";
import { VITAL_STATUS } from "../../enum/vital";
import { sourcesView } from "./sources";
import styles from "./index.module.scss";

const TAB_KEYS = ["records", "upload_files", "genomics", "connect_data_source"];

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
  // when that jump was a tab switch inside one page. The panels flash whenever
  // the number changes and is > 0, so the empty-state guide bumps it to flash
  // again.
  const [highlightTrigger, setHighlightTrigger] = useState(() =>
    requestedTab === "connect_data_source" ? 1 : 0,
  );
  const [filesHighlightTrigger, setFilesHighlightTrigger] = useState(() =>
    requestedTab === "upload_files" ? 1 : 0,
  );
  const uploadFilesRef = useRef(null);
  // The upload area's picker, for the empty-state guide (UploadArea).
  const filePickerRef = useRef(null);
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
  const loading_providers = useVitalStore((state) => state.loading_providers);
  const providers_answered = useVitalStore((state) => state.providers_answered);
  const fetchProvidersList = useVitalStore((state) => state.fetchProvidersList);
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const isShowMobileSource = useSystemStore(
    (state) => state.isShowMobileSource,
  );
  const isShowJournal = useSystemStore((state) => state.isShowJournal);
  const fetchDistribution = useDistributionStore(
    (state) => state.fetchDistribution,
  );
  const total_records = useDistributionStore((state) => state.total_records);
  const distribution_user_id = useDistributionStore(
    (state) => state.distribution_user_id,
  );
  const { t } = useTranslation();

  const connectedCount = providers_list.filter(
    (item) => item.status === VITAL_STATUS.CONNECTED,
  ).length;
  const sources = sourcesView({
    enabled: isShowMobileSource,
    count: providers_list.length,
    loading: loading_providers,
    answered: providers_answered,
  });
  const hasSources = sources === "list";
  // Empty means a real zero for the person on screen — not the store's
  // placeholder before its first answer, and not the previous person's count
  // while a switch is in flight. It follows the switcher on purpose: a family
  // member with nothing yet gets the same way in, and uploads go to them.
  const isEmpty =
    distribution_user_id === current_drive_user_id && total_records === 0;

  const selectTab = (tab) => {
    setActiveTab(tab);
    // Tab panels stay mounted (hidden divs), so re-activating one does not
    // remount it — refetch explicitly.
    if (tab === "upload_files") fetchFileList();
  };

  // From the empty-state guide: open the tab that does the thing. An upload
  // entry also opens the file picker, narrowed to its kind of file, inside the
  // same click; the others flash the area, the way arriving with ?tab= does.
  const openFromGuide = (tab, accept) => {
    selectTab(tab);
    if (accept) filePickerRef.current?.open(accept);
    else if (tab === "upload_files") setFilesHighlightTrigger((n) => n + 1);
    if (tab === "connect_data_source") setHighlightTrigger((n) => n + 1);
  };

  // The tabs separate manual records, files, genotypes and device sources.
  // The READINGS they produce are their own
  // page (工作区 › 指标) — the output does not belong at the same level as its
  // own plumbing. Each tab carries its own count, which is what the old
  // four-counter strip was really for.
  //
  // 记录 is hidden on a backend that explicitly says it has no journal route;
  // see store/system.js for why the flag defaults on.
  const TABS = [
    ...(isShowJournal ? [{ value: "records", label: t("records_tab") }] : []),
    { value: "upload_files", label: t("files_tab"), count: fileTotal },
    { value: "genomics", label: t("genomics_tab") },
    {
      value: "connect_data_source",
      label: t("connect_data_source"),
      count: connectedCount,
    },
  ];
  // The tab on screen. `activeTab` starts as 记录, which is not in TABS on a
  // backend without the journal (and the flag can turn off after the first
  // render, once the config arrives): that left no tab selected and no panel
  // showing. Anything not in TABS falls to the first tab that is.
  const currentTab = TABS.some((tab) => tab.value === activeTab)
    ? activeTab
    : TABS[0].value;

  // Fetch on mount, not only when a drive user id happens to be in state: both
  // endpoints scope themselves by the bearer token, and gating on the id meant
  // that on a fresh login the counters silently stayed at zero.
  useEffect(() => {
    fetchFileList();
  }, [current_drive_user_id, fetchFileList]);

  useEffect(() => {
    fetchBeneficiaryUsers();
  }, [fetchBeneficiaryUsers]);

  // The page decides from this list whether the sources tab has anything to
  // show, so the page asks for it. ProviderList used to be the only asker, and
  // it rendered only once the list was non-empty: the list was never
  // requested, and a deployment with Oura, WHOOP or Garmin configured showed
  // "nothing to connect". Not gated on the drive user id, for the reason the
  // file list above gives; a change of person re-asks.
  useEffect(() => {
    if (!isShowMobileSource) return;
    fetchProvidersList();
  }, [isShowMobileSource, current_drive_user_id, fetchProvidersList]);

  // The record's size decides whether the empty-state guide shows. It is
  // scoped to whoever the switcher points at, so a change of person re-asks.
  useEffect(() => {
    fetchDistribution();
  }, [current_drive_user_id, fetchDistribution]);

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
      // Opening early only saves the first upload a wait; an upload that
      // finds no socket opens its own, so a failure here is not the user's.
      wsManager.tryConnect().catch((error) =>
        consola.warn("DrivePage::Early WebSocket connect failed", error),
      );
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
            {isEmpty && (
              <EmptyGuide
                showJournal={isShowJournal}
                showSources={hasSources}
                onOpen={openFromGuide}
              />
            )}
            <Tabs tabs={TABS} value={currentTab} onChange={selectTab} />

            <div hidden={currentTab !== "connect_data_source"}>
              <div className="flex flex-col gap-[var(--space-8)] pb-[var(--space-12)]">
                {/* "pending" renders the list too: its loading skeleton is the
                    honest thing to show until the answer arrives. */}
                {sources !== "empty" ? (
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

            <div hidden={currentTab !== "upload_files"} ref={uploadFilesRef}>
              <UploadFiles
                filesHighlightTrigger={filesHighlightTrigger}
                pickerRef={filePickerRef}
                onGenotypeFile={() => setActiveTab("genomics")}
              />
            </div>

            {currentTab === "genomics" ? <Genomics key={current_drive_user_id} /> : null}

            {/* Mounted only while selected: it fetches on mount, and the two
                panels above stay mounted precisely so they do not refetch. */}
            {currentTab === "records" ? (
              <Records onChange={fetchDistribution} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrivePage;
