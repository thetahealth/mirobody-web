import styles from "./index.module.scss";
import Menu from "./Menu";
import DataBar from "./DataBar/index.jsx";
import { useEffect, useState } from "react";
import api from "../../api/index.js";
import Upload from "./Upload/index.jsx";
import FileList from "./FileList/index.jsx";
import ResponsiveSidebar from "../../components/ResponsiveSidebar";
import HamburgerButton from "../../components/HamburgerButton";
import useIsMobile from "../../hooks/useIsMobile";
import { useUiStore } from "../../store/ui";

function Home() {
  const [distributionData, setDistributionData] = useState(null);
  const isMobile = useIsMobile();
  const setSidebarDrawerOpen = useUiStore((s) => s.setSidebarDrawerOpen);

  useEffect(() => {
    api.dataDistribution().then((res) => {
      setDistributionData(res);
    });
  }, []);

  return (
    <div className={styles.home}>
      <ResponsiveSidebar drawerWidth={280}>
        <Menu />
      </ResponsiveSidebar>
      <div className={styles.home_content}>
        <div className={styles.content_left}>
          {isMobile && (
            <HamburgerButton
              className="self-start"
              onClick={() => setSidebarDrawerOpen(true)}
            />
          )}
          <DataBar datasource={distributionData} />
          <Upload />
          <FileList />
        </div>
        <div className={styles.content_right}>
          <div className={styles.status_bar}></div>
        </div>
      </div>
    </div>
  );
}

export default Home;
