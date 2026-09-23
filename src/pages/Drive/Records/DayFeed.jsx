import { Popconfirm } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import {
  dayToken,
  kindKey,
  reasonKey,
  standardName,
  timeOf,
  weekdayOf,
} from "./entries.js";
import styles from "./DayFeed.module.scss";

/**
 * The log, by day.
 *
 * Both names on every row, always: `text` is what the person wrote and
 * `display` is what ICPC-3 calls it. An entry the vocabulary could not place
 * keeps its words and says so rather than dropping out of the list — the
 * uncoded half is the half that most needs a person's eye, and a feed that
 * hides it looks like perfect coverage.
 *
 * Days come grouped from the server. Regrouping them here would be a second
 * opinion about where a day starts, and the person's timezone is the server's
 * to know (it stores `local_date` against their own).
 */
const DayFeed = ({ days, today, onRetract }) => {
  const { t, i18n } = useTranslation();

  return (
    <div className={styles.feed}>
      {days.map((day) => {
        const token = dayToken(day.date, today);
        return (
          <section key={day.date} className={styles.day}>
            <header className={styles.dayHead}>
              <h3 className={styles.dayTitle}>
                {token ? t(`journal_${token}`) : day.date}
              </h3>
              <span className={styles.dayDate}>
                {token ? `${day.date} ` : ""}
                {weekdayOf(day.date, i18n.language)}
              </span>
              <span className={styles.dayCount}>{day.entries.length}</span>
            </header>

            <ul className={styles.entries}>
              {day.entries.map((entry) => {
                const name = standardName(entry);
                return (
                  <li key={entry.id} className={styles.entry}>
                    <span className={styles.time}>{timeOf(entry)}</span>

                    {kindKey(entry.kind) ? (
                      <span className={styles.kind}>{t(kindKey(entry.kind))}</span>
                    ) : null}

                    <div className={styles.body}>
                      <p className={styles.words}>{entry.text}</p>
                      {entry.note ? <p className={styles.note}>{entry.note}</p> : null}
                    </div>

                    {name ? (
                      <span className={styles.coded} title={entry.series_id || ""}>
                        {name}
                        <code className={styles.code}>{entry.code}</code>
                      </span>
                    ) : (
                      <span className={styles.uncoded} title={t(reasonKey(entry.reason))}>
                        {t("journal_uncoded_chip")}
                      </span>
                    )}

                    <Popconfirm
                      title={t("journal_retract_confirm")}
                      okText={t("journal_retract")}
                      cancelText={t("cancel")}
                      onConfirm={() => onRetract(entry)}
                    >
                      <button
                        type="button"
                        className={styles.retract}
                        aria-label={t("journal_retract")}
                      >
                        <DeleteOutlined />
                      </button>
                    </Popconfirm>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

export default DayFeed;
