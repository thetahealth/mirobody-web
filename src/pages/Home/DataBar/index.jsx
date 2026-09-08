import styles from "./index.module.scss";
import { useTranslation } from "react-i18next";
import Item from "./Item";

function DataBar({ datasource }) {
  const { t } = useTranslation();
  return (
    <div className={styles.data_bar}>
      <Item
        title={t("total_records")}
        value={datasource?.total_records || 0}
        trend={16}
      />
      <div className={styles.line}></div>
      <Item
        title={t("data_categories")}
        value={datasource?.total_categories || 0}
        trend={16}
      />
      <div className={styles.line}></div>
      <Item title={t("attention")} value={2216} trend={16} />
    </div>
  );
}

export default DataBar;
