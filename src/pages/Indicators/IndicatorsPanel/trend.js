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

/**
 * The numeric readings, oldest first, the unit they are in, and how many were
 * left out because their unit does not convert to the series' (`left`). A
 * text result ("阴性") is left out uncounted. `unit` is the drawer's, for a
 * series whose readings name none.
 *
 * The server answers every reading of a series in one unit and converts the
 * ones printed in another: 212 mg/dL arrives as 5.48 mmol/L, its range with it,
 * and `printed` says what the report said. The chart used to plot what each
 * report printed and drew a fall from 212 to 4.9 (thetahealth/mirobody#271).
 * A reading the server could not convert (`unit_differs`: albumin in g/L
 * and umol/L) is not drawn on an axis it is not in.
 */
export function trendSeries(readings = [], unit = "") {
  const points = [];
  let left = 0;
  for (const r of readings) {
    const value = toNumber(r.value);
    if (!r.time || value == null) continue;
    if (r.unit_differs) {
      left += 1;
      continue;
    }
    points.push({ time: r.time, value, flag: r.flag || "", ref: r.ref || "", printed: r.converted ? r.printed : null });
  }
  points.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return { points, unit: readings.find((r) => !r.unit_differs && r.unit)?.unit || unit, left };
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

// ECharts sets a tooltip string as HTML, and a unit or a range is text read
// off an uploaded document, of a record a care circle may share.
const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

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
 *  range and printed value and, for a dense series, its two lines, in the
 *  page's language. `dark` draws it for the dark page. */
export function trendOption(points, { unit = "", labels = {}, dark = false } = {}) {
  const c = chartPalette(dark);
  const LABEL = { color: c.inkSoft, fontSize: 11, fontFamily: FONT };
  const range = latestRange(points);
  const dense = points.length > DENSE;
  const data = points.map((p) => ({
    value: [p.time.replace(" ", "T"), p.value],
    ref: p.ref,
    printed: p.printed,
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
        const shownUnit = escapeHtml(unit);
        const ref = item.data.ref ? ` · ${escapeHtml(labels.ref)}${escapeHtml(item.data.ref)}` : "";
        // What a converted reading's report printed, so the number can be
        // matched to the document it came from.
        const { printed } = item.data;
        const source = printed
          ? `<br/>${escapeHtml(labels.printed)}${escapeHtml(printed.value)} ${escapeHtml(printed.unit)}`
          : "";
        const mean = items[1] ? `<br/>${escapeHtml(items[1].seriesName)} ${items[1].value[1]} ${shownUnit}` : "";
        return `${String(time).replace("T", " ").replace(/ 00:00(:00)?$/, "").slice(0, 16)}<br/><b>${value}</b> ${shownUnit}${ref}${source}${mean}`;
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
