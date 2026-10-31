import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import { useTranslation } from "react-i18next";
import { trendOption, trendPoints } from "./trend";
import styles from "./index.module.scss";

/** One indicator's readings over time, with its report's range as a band.
 *  Nothing for fewer than two numeric readings: one point is not a trend.
 *  `total` is how many the record holds: the route sends the newest 200, and
 *  a chart of half a year must not pass for the whole one. */
export default function TrendChart({ readings, unit, total = 0 }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const points = useMemo(() => trendPoints(readings), [readings]);
  const enough = points.length >= 2;

  useEffect(() => {
    const el = ref.current;
    if (!enough || !el) return undefined;
    const chart = echarts.init(el);
    chart.setOption(
      trendOption(points, {
        unit,
        labels: {
          range: t("indicator_ref_range"),
          ref: t("indicator_ref_short"),
          readings: t("indicator_trend_readings"),
          average: t("indicator_trend_average"),
        },
      }),
    );
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [enough, points, unit, t]);

  if (!enough) return null;
  return (
    <figure className={styles.trendFigure}>
      <div
        ref={ref}
        className={styles.trend}
        role="img"
        aria-label={t("indicator_trend_label", { count: points.length })}
      />
      {total > readings.length ? (
        <figcaption className={styles.muted}>
          {t("indicator_trend_partial", { shown: readings.length, total })}
        </figcaption>
      ) : null}
    </figure>
  );
}
