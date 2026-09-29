import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconLoader2 } from "@tabler/icons-react";
import { useDriveStore } from "../../../store/Drive";
import { listEntries, retractEntry, retractMedication } from "../../../api/journal";
import { countEntries, isMedication, rangeFor, readDays } from "./entries.js";
import Composer from "./Composer.jsx";
import DayFeed from "./DayFeed.jsx";
import styles from "./index.module.scss";

/**
 * 记录 — what a person says about themselves, on the same footing as what a
 * device or a lab says about them.
 *
 * A panel on /data rather than a page of its own. It was a separate nav entry
 * first, reasoning from this repo's own note that /data is "the plumbing" and
 * readings are the output. The cloud product settles it the other way: its
 * Timeline carries the composer, the day feed and the file chips together,
 * because a person logging a symptom and a person uploading a report are doing
 * the same thing — adding to their record. Beside the files is where it goes.
 *
 * The shell, the person switcher and the tabs belong to the page
 * (`pages/Drive/index.jsx`); this renders inside one tab.
 */
const RANGES = [30, 90, 365];

// `onChange` hears about every entry logged or retracted — the page's
// empty-state guide is keyed off the record's size, and one entry is enough
// to end it.
const Records = ({ onChange }) => {
  const { t } = useTranslation();
  const [days, setDays] = useState([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const current_drive_user_id = useDriveStore((state) => state.current_drive_user_id);

  // The day the window was computed FOR, kept beside the rows it fetched.
  // `dayToken` compares against it, so the headings and the range always agree
  // about which day is today, including across a midnight tick in an open tab.
  const [today, setToday] = useState(() => new Date());

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const now = new Date();
        setToday(now);
        const { from, to } = rangeFor(now, range);
        const data = await listEntries(
          { from, to, target_user_id: current_drive_user_id || undefined },
          signal,
        );
        setDays(readDays(data));
        setLoading(false);
      } catch (e) {
        // A canceled request touches NO state: React has already started the
        // newer load, which set `loading` true, and clearing it here would
        // drop the spinner and show the previous range's rows (or the
        // previous person's) as though they were the answer. That is why
        // `setLoading(false)` is on each real branch rather than in a
        // `finally` that also runs for the abort.
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
        setError(e?.msg || t("journal_load_failed"));
        setLoading(false);
      }
    },
    [range, current_drive_user_id, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    // `load` raises the spinner before it awaits, which is a setState the
    // effect runs synchronously and costs one extra render pass. The
    // alternatives cost correctness: raising it only on the range buttons
    // leaves a person switch showing the previous person's rows while their
    // own are still in flight, which is the stale-render bug the catch block
    // above exists to prevent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const onRetract = async (entry) => {
    try {
      const target_user_id = current_drive_user_id || undefined;
      if (isMedication(entry)) await retractMedication({ planId: entry.plan_id, target_user_id });
      else await retractEntry({ id: entry.id, target_user_id });
      // Re-ask rather than splicing the row out: the server decides what a
      // retracted row looks like, and the count in the header comes from it.
      load();
      onChange?.();
    } catch (e) {
      setError(e?.msg || t("journal_load_failed"));
    }
  };

  const counts = countEntries(days);

  return (
    <section className={styles.panel}>
      <p className={styles.subtitle}>{t("journal_subtitle")}</p>

      <Composer
        targetUserId={current_drive_user_id}
        onLogged={() => {
          load();
          onChange?.();
        }}
      />

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <p className={styles.loading}>
          <IconLoader2 size={14} stroke={1.8} className="animate-spin" /> {t("loading")}
        </p>
      ) : days.length ? (
        <>
          <div className={styles.bar}>
            <p className={styles.counts}>
              {t("journal_count", { total: counts.total, coded: counts.coded })}
            </p>
            <div className={styles.ranges}>
              {RANGES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.range} ${range === n ? styles.rangeOn : ""}`}
                  onClick={() => setRange(n)}
                >
                  {t(`journal_range_${n}`)}
                </button>
              ))}
            </div>
          </div>
          <DayFeed days={days} today={today} onRetract={onRetract} />
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{t("journal_empty_title")}</p>
          <p className={styles.emptyHint}>{t("journal_empty_hint")}</p>
        </div>
      )}
    </section>
  );
};

export default Records;
