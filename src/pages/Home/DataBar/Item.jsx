import styles from "./item.module.scss";
import TrendSVG from "../../../assets/trend.svg?react";

function Item({ title, value, trend }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.item}>
        <div className={styles.icon}></div>
        <div className={styles.data}>
          <div className={styles.header}>{title}</div>
          <div className={styles.content}>
            <div className={styles.value}>{value}</div>
            <div className={styles.trend}>
              <div className={styles.trend_value}>{trend}</div>
              <TrendSVG />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Item;
