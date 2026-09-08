import styles from "./Tabs.module.scss";

/**
 * Underline tabs that carry their own counts.
 *
 * The counts used to be a separate strip of four big counters above the tabs —
 * the largest thing on the page, for numbers nobody acts on. Hanging each count
 * on the tab that owns it removes that whole band and gives the number a job:
 * it now tells you what is behind a door before you open it.
 */
const Tabs = ({ tabs, value, onChange }) => (
  <div className={styles.tabs} role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        type="button"
        role="tab"
        aria-selected={value === tab.value}
        className={`${styles.tab} ${value === tab.value ? styles.active : ""}`}
        onClick={() => onChange(tab.value)}
      >
        {tab.label}
        {tab.count > 0 && <span className={styles.count}>{tab.count}</span>}
      </button>
    ))}
  </div>
);

export default Tabs;
