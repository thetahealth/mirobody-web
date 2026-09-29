import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import DriveHeader from "../../components/DriveHeader";
import Tabs from "../../components/Tabs";
import IndicatorsPanel from "./IndicatorsPanel";
import RecentRecords from "./RecentRecords";
import RecordsList from "./RecordsList";
import Medications from "./Medications";
import { useAccountStore } from "../../store/account";
import { useDriveStore } from "../../store/Drive";
import { useDistributionStore } from "../../store/distribution";
import { useSystemStore } from "../../store/system";
import styles from "./index.module.scss";

const TAB_KEYS = ["indicators", "records", "medications"];

/**
 * 指标 — what everything put in became: readings on their standard codes, every
 * entry one by one, and the medication plans.
 *
 * It used to be the first of three tabs on /data, beside the uploaded files and
 * the connected devices. Those two are how readings GET here; putting all three
 * behind one nav entry called 数据 asked the reader to know that before they
 * could find anything. /data keeps the plumbing; this is the result.
 *
 * Three tabs: 指标 (the catalogue), 明细 (every entry, newest first) and 用药
 * (the plans a sentence in 数据 › 记录 made). The last two follow the backend's
 * flags, so a deployment without the route shows no door to it. "Added since
 * your last visit" sits above the tabs, and its "view details" opens 明细
 * filtered to exactly what it counted. `?tab=` opens one directly.
 *
 * The empty state's two actions cross to that page with `?tab=` rather than
 * flipping a tab in place, because the tab they want now lives elsewhere.
 */
const IndicatorsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const fetchBeneficiaryUsers = useAccountStore(
    (state) => state.fetchBeneficiaryUsers,
  );
  const fetchDistribution = useDistributionStore(
    (state) => state.fetchDistribution,
  );
  const isShowDataDelta = useSystemStore((state) => state.isShowDataDelta);
  const isShowIndicatorRecords = useSystemStore((state) => state.isShowIndicatorRecords);
  const isShowIndicatorExport = useSystemStore((state) => state.isShowIndicatorExport);
  const isShowMedications = useSystemStore((state) => state.isShowMedications);
  // "View details" on the delta block filters 明细 to what it counted. Held
  // per person: switching person drops the filter.
  const [since, setSince] = useState({ userId: null, value: null });
  const createdSince = since.userId === current_drive_user_id ? since.value : null;

  const tabs = [
    { value: "indicators", label: t("indicators_tab") },
    ...(isShowIndicatorRecords ? [{ value: "records", label: t("indicators_records_tab") }] : []),
    ...(isShowMedications ? [{ value: "medications", label: t("medications_tab") }] : []),
  ];
  const requested = searchParams.get("tab");
  // A tab whose flag is off (or not yet known) falls back to the catalogue.
  const currentTab = TAB_KEYS.includes(requested) && tabs.some((tab) => tab.value === requested)
    ? requested
    : "indicators";
  const selectTab = (tab) => setSearchParams(tab === "indicators" ? {} : { tab }, { replace: true });

  // The roster feeds DriveHeader's person switcher.
  useEffect(() => {
    fetchBeneficiaryUsers();
  }, [fetchBeneficiaryUsers]);

  // Readings are scoped to whoever the switcher points at, so a change of
  // person re-asks for them.
  useEffect(() => {
    fetchDistribution();
  }, [current_drive_user_id, fetchDistribution]);

  return (
    <div className="w-[100vw] h-dvh flex flex-col overflow-hidden">
      <MobileTopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className={styles.scroll}>
          <div className={styles.column}>
            <DriveHeader />
            {isShowDataDelta && (
              <RecentRecords
                key={current_drive_user_id || "self"}
                userId={current_drive_user_id}
                onViewDetails={
                  // Without the records route there is nothing to open.
                  isShowIndicatorRecords
                    ? (value) => {
                      setSince({ userId: current_drive_user_id, value });
                      selectTab("records");
                    }
                    : undefined
                }
              />
            )}
            {tabs.length > 1 && <Tabs tabs={tabs} value={currentTab} onChange={selectTab} />}

            {currentTab === "records" ? (
              <RecordsList
                key={`${current_drive_user_id || "self"}:${createdSince || ""}`}
                userId={current_drive_user_id}
                createdSince={createdSince}
                onClearSince={() => setSince({ userId: null, value: null })}
                canExport={isShowIndicatorExport}
              />
            ) : null}

            {currentTab === "medications" ? <Medications key={current_drive_user_id || "self"} /> : null}

            {/* key: switching person is a different subject, not new props
                for the same one. Remounting resets the panel's own rows,
                search term and paging in one move — the alternative was a
                counter bumped from an effect, which is a cascading render for
                something React already expresses. */}
            {currentTab === "indicators" ? (
              <IndicatorsPanel
                key={current_drive_user_id}
                onEmptyUploadClick={() => navigate("/data?tab=upload_files")}
                onEmptyConnectClick={() =>
                  navigate("/data?tab=connect_data_source")
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndicatorsPage;
