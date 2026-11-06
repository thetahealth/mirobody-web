/**
 * The readings drawer's chart: one indicator over time, with the range its
 * report printed. The drawer listed 53 weights and 365 heart rates as rows
 * and nothing else, so "how did it get here" was a column of numbers to
 * read top to bottom.
 *
 * A time axis, not a category one: lab results arrive months apart and
 * device readings daily, and equal spacing would draw both at one pace.
 */

import { flagOf } from "../../Chat/Dialog/Render/Citations/sources";
import { chartPalette, tooltipColours } from "../../../utils/chartPalette";

const NUMBER = /^[-+−]?\d+(?:\.\d+)?$/;
const toNumber = (text) => {
  const s = String(text ?? "").trim().replace("−", "-");
  return NUMBER.test(s) ? Number(s) : null;
};

/**
 * A printed reference range as `{low, high}` (either may be missing), or
 * null when it is not one: "4.0-5.6", "3.9–6.1", "<5.18", "≥ 40", "0~10".
 */
export function parseRange(ref) {
  const text = String(ref ?? "").trim().replace(/[−–—～~至到]/g, "-").replace(/\s+/g, "");
  if (!text) return null;
  const both = /^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/.exec(text);
  if (both) {
    const [low, high] = [Number(both[1]), Number(both[2])];
    return low <= high ? { low, high } : null;
  }
  const one = /^(<=?|≤|＜|>=?|≥|＞)(-?\d+(?:\.\d+)?)$/.exec(text);
  if (!one) return null;
  const bound = Number(one[2]);
  return /[<≤＜]/.test(one[1]) ? { high: bound } : { low: bound };
}

/** The numeric readings, oldest first; a text result ("阴性") is left out. */
export function trendPoints(readings = []) {
  return readings
    .map((r) => ({ time: r.time, value: toNumber(r.value), flag: r.flag || "", ref: r.ref || "" }))
    .filter((p) => p.time && p.value != null)
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

/** The range the band shows: the newest reading's, since ranges change
 *  with the lab. Each point's own range is in its tooltip. */
export function latestRange(points) {
  for (let i = points.length - 1; i >= 0; i--) {
    const range = parseRange(points[i].ref);
    if (range) return range;
  }
  return null;
}

const FONT =
  '"Source Sans 3","PingFang SC","Hiragino Sans GB","Microsoft YaHei",-apple-system,BlinkMacSystemFont,sans-serif';

// Any flag the report printed counts: "偏高", "HH" and "↑" as much as "H".
const isOut = (point, range) => {
  if (flagOf(point.flag)) return true;
  if (!range) return false;
  return (range.low != null && point.value < range.low) || (range.high != null && point.value > range.high);
};

// Readings past which a line stops showing each one: a year of daily heart
// rate drawn point to point is a band of noise, so it is drawn faint under
// its moving average, the way a wearable's own app draws it.
export const DENSE = 60;
const WINDOW = 7;

/** The mean of each reading and the `WINDOW - 1` before it. */
export function movingAverage(points, window = WINDOW) {
  let sum = 0;
  return points.map((p, i) => {
    sum += p.value;
    if (i >= window) sum -= points[i - window].value;
    const n = Math.min(i + 1, window);
    return Math.round((sum / n) * 100) / 100;
  });
}

/** The ECharts option for `points`; `labels` names the band, a tooltip's
 *  range and, for a dense series, its two lines, in the page's language.
 *  `dark` draws it for the dark page. */
export function trendOption(points, { unit = "", labels = {}, dark = false } = {}) {
  const c = chartPalette(dark);
  const LABEL = { color: c.inkSoft, fontSize: 11, fontFamily: FONT };
  const range = latestRange(points);
  const dense = points.length > DENSE;
  const data = points.map((p) => ({
    value: [p.time.replace(" ", "T"), p.value],
    ref: p.ref,
    itemStyle: isOut(p, parseRange(p.ref) || range) ? { color: c.out, borderColor: c.out } : undefined,
  }));
  const band =
    range && range.low != null && range.high != null
      ? { silent: true, itemStyle: { color: c.band }, label: { show: true, position: "insideTopRight", ...LABEL, color: c.inRange, formatter: labels.range || "" }, data: [[{ yAxis: range.low }, { yAxis: range.high }]] }
      : undefined;
  const bound =
    range && (range.low == null || range.high == null)
      ? { silent: true, symbol: "none", lineStyle: { color: c.inRange, type: "dashed", width: 1 }, label: { ...LABEL, color: c.inRange, formatter: labels.range || "" }, data: [{ yAxis: range.low ?? range.high }] }
      : undefined;
  return {
    textStyle: { fontFamily: FONT },
    grid: { left: 8, right: 16, top: dense ? 28 : 16, bottom: 8, containLabel: true },
    legend: dense ? { top: 0, right: 0, textStyle: LABEL, itemWidth: 14, itemHeight: 8 } : undefined,
    tooltip: {
      trigger: "axis",
      confine: true,
      ...tooltipColours(c),
      formatter: (items) => {
        const item = items[0];
        const [time, value] = item.value;
        const ref = item.data.ref ? ` · ${labels.ref || ""}${item.data.ref}` : "";
        const mean = items[1] ? `<br/>${items[1].seriesName} ${items[1].value[1]} ${unit}` : "";
        return `${String(time).replace("T", " ").replace(/ 00:00(:00)?$/, "").slice(0, 16)}<br/><b>${value}</b> ${unit}${ref}${mean}`;
      },
    },
    xAxis: { type: "time", axisLabel: { ...LABEL, hideOverlap: true }, splitLine: { show: false } },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: LABEL,
      splitLine: { lineStyle: { color: c.line } },
      // The band is drawn whole even when every reading sits inside it.
      min: range?.low != null ? (v) => Math.min(v.min, range.low) : undefined,
      max: range?.high != null ? (v) => Math.max(v.max, range.high) : undefined,
    },
    series: [
      {
        type: "line",
        name: labels.readings || "",
        data,
        smooth: false,
        showSymbol: !dense,
        symbolSize: 6,
        lineStyle: dense ? { width: 1, color: c.singleFaint } : { width: 2, color: c.single },
        itemStyle: { color: dense ? c.singleFaint : c.single },
        markArea: band,
        markLine: bound,
      },
      ...(dense
        ? [
            {
              type: "line",
              name: labels.average || "",
              data: movingAverage(points).map((value, i) => [data[i].value[0], value]),
              smooth: false,
              showSymbol: false,
              lineStyle: { width: 2, color: c.single },
              itemStyle: { color: c.single },
            },
          ]
        : []),
    ],
  };
}
