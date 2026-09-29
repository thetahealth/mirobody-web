import { Popconfirm } from "antd";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  dayToken,
  entryKey,
  isMedication,
  isNote,
  kindKey,
  reasonKey,
  standardName,
  timeOf,
  valueOf,
  weekdayOf,
} from "./entries.js";
import { scheduleSummary } from "../../Indicators/Medications/form.js";
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
 * A note is kept as written and was never meant to be coded, so it carries no
 * "not coded" chip. A medication is listed on the day its sentence was
 * written; the plan itself lives in 指标 › 用药, and removing it here removes
 * the plan.
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
                const medication = isMedication(entry);
                // A plan's `note` is its schedule in the person's words; the
                // summary is the structure read from them.
                const detail = medication
                  ? [scheduleSummary(entry, t), entry.note ? `“${entry.note}”` : ""].filter(Boolean).join("  ")
                  : entry.note;
                return (
                  <li key={entryKey(entry)} className={styles.entry}>
                    <span className={styles.time}>{timeOf(entry)}</span>

                    {kindKey(entry.kind) ? (
                      <span className={styles.kind}>{t(kindKey(entry.kind))}</span>
                    ) : null}

                    <div className={styles.body}>
                      <p className={styles.words}>
                        {entry.text}
                        {valueOf(entry) ? (
                          <span className={styles.value}>{valueOf(entry)}</span>
                        ) : null}
                      </p>
                      {detail ? <p className={styles.note}>{detail}</p> : null}
                    </div>

                    {medication ? (
                      <Link to="/indicators?tab=medications" className={styles.coded}>
                        {t(entry.status === "active" ? "journal_med_on_list" : `medications_status_${entry.status}`, entry.status)}
                      </Link>
                    ) : isNote(entry) ? null : name ? (
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
                        <IconTrash size={14} stroke={1.8} />
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
