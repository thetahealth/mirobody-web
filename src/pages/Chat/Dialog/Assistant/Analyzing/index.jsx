import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";

const Analyzing = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center">
      <div className={styles.container}>
        <div className={styles.spinner}>
          <div className={styles.bounce1}></div>
          <div className={styles.bounce2}></div>
          <div className={styles.bounce3}></div>
        </div>
      </div>
      <div className="text-[14px] text-[#000] font-[500] ml-2">
        {t("analyzing")}
      </div>
    </div>
  );
};

export default Analyzing;
