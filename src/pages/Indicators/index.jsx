import { useEffect } from "react";
import { useNavigate } from "react-router";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import DriveHeader from "../Drive/DriveHeader";
import IndicatorsPanel from "../Drive/Indicators";
import { useAccountStore } from "../../store/account";
import { useDriveStore } from "../../store/Drive";
import { useDistributionStore } from "../../store/distribution";
import styles from "./index.module.scss";

/**
 * 指标 — the standardized readings, on their own page.
 *
 * It used to be the first of three tabs on /data, beside the uploaded files and
 * the connected devices. Those two are how readings GET here; putting all three
 * behind one nav entry called 数据 asked the reader to know that before they
 * could find anything. /data keeps the plumbing; this is the result.
 *
 * The empty state's two actions cross to that page with `?tab=` rather than
 * flipping a tab in place, because the tab they want now lives elsewhere.
 */
const IndicatorsPage = () => {
  const navigate = useNavigate();
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const fetchBeneficiaryUsers = useAccountStore(
    (state) => state.fetchBeneficiaryUsers,
  );
  const fetchDistribution = useDistributionStore(
    (state) => state.fetchDistribution,
  );

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
            {/* key: switching person is a different subject, not new props
                for the same one. Remounting resets the panel's own rows,
                search term and paging in one move — the alternative was a
                counter bumped from an effect, which is a cascading render for
                something React already expresses. */}
            <IndicatorsPanel
              key={current_drive_user_id}
              onEmptyUploadClick={() => navigate("/data?tab=upload_files")}
              onEmptyConnectClick={() =>
                navigate("/data?tab=connect_data_source")
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndicatorsPage;
