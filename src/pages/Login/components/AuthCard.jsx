import styles from "./AuthCard.module.scss";
import { useTranslation } from "react-i18next";

/**
 * The DeepSeek-style split login surface: credential form (primary) on the left,
 * region-aware alternate methods on the right, separated by a hairline. Collapses
 * to a single stacked column with a labelled "或 / OR" divider at ≤768px.
 */
export default function AuthCard({ primary, alternate }) {
  const { t } = useTranslation();
  return (
    <div className={styles.card}>
      <section className={styles.pane}>{primary}</section>
      <div className={styles.divider}>
        <span>{t("or").toUpperCase()}</span>
      </div>
      <section className={styles.pane}>{alternate}</section>
    </div>
  );
}
