// Maps the vis-chart protocol (tidy data) onto an ECharts option.
// The second argument carries the container width, for responsive sizing
// (readable both shrunk and expanded, in Latin text and CJK alike).
// Returns null when it cannot render — the caller then draws nothing.
const COLORS = ["#0e3880", "#0077b6", "#90be6d", "#f9844a", "#f94144", "#577590", "#9d4edd"];

// The same font stack as body copy: Source Sans 3 for Latin plus a CJK
// fallback, so canvas text does not come out looking pasted in.
const FONT =
  '"Source Sans 3","PingFang SC","Hiragino Sans GB","Microsoft YaHei",-apple-system,BlinkMacSystemFont,sans-serif';

// Secondary text (axis names, ticks, legend) is uniformly greyed down and
// smaller, leaving the title and the data as the things you notice.
const AXIS_NAME = { color: "#9b9894", fontSize: 11, fontFamily: FONT };
const AXIS_LABEL = { color: "#5c5a57", fontSize: 11, fontFamily: FONT };
const LEGEND_TEXT = { color: "#5c5a57", fontFamily: FONT };
const SPLIT_LINE = { lineStyle: { color: "#e8e4dc" } };

// Title: page font, moderate weight, breathing room above; truncated when
// over-long so it cannot overflow the canvas.
function titleOf(title, width, compact) {
  if (!title) return undefined;
  return {
    text: title,
    left: "center",
    top: 8,
    textStyle: {
      fontSize: compact ? 14 : 15,
      fontWeight: 600,
      color: "#1a1a1a",
      fontFamily: FONT,
      overflow: "truncate",
      ellipsis: "…",
      width: Math.max(140, (width || 600) - 24),
    },
  };
}

// Legend sits under the title with a gap, so the two do not crowd.
function topLegend(hasTitle) {
  return { top: hasTitle ? 34 : 8, type: "scroll", textStyle: LEGEND_TEXT, itemWidth: 14, itemHeight: 10, itemGap: 14 };
}
function bottomLegend() {
  return { bottom: 0, type: "scroll", textStyle: LEGEND_TEXT, itemWidth: 14, itemHeight: 10, itemGap: 14 };
}

// Top padding: largest when there is both a title and a legend, so neither
// collides with the axis name.
function gridTop(hasTitle, hasLegend) {
  if (hasTitle && hasLegend) return 72;
  if (hasTitle) return 48;
  if (hasLegend) return 40;
  return 24;
}

// Horizontal axis name goes at the middle of the axis rather than its end,
// where the canvas edge would clip it.
function hAxisName(name) {
  return name ? { name, nameLocation: "middle", nameGap: 30, nameTextStyle: AXIS_NAME } : {};
}
// Vertical axis name stays at the end, just toned down.
function vAxisName(name) {
  return name ? { name, nameTextStyle: AXIS_NAME } : {};
}

// Category labels laid out horizontally (the X axis of column, line and
// scatter charts): auto de-overlap plus truncation, for CJK and Latin.
function catLabelH(compact) {
  return { ...AXIS_LABEL, hideOverlap: true, overflow: "truncate", width: compact ? 64 : 96, ellipsis: "…" };
}
// Category labels laid out vertically (the Y axis of a bar chart): stacked
// vertically they rarely overlap, so only truncate the long ones.
function catLabelV(compact) {
  return { ...AXIS_LABEL, overflow: "truncate", width: compact ? 72 : 120, ellipsis: "…" };
}
// Value-axis labels
function valLabel() {
  return { ...AXIS_LABEL, hideOverlap: true };
}

// Split a long table into one series per group; returns { cats, series:[{name,data}] }
function splitByGroup(rows, xKey) {
  const cats = [];
  const seen = new Set();
  for (const r of rows) {
    if (!seen.has(r[xKey])) {
      seen.add(r[xKey]);
      cats.push(r[xKey]);
    }
  }
  const groups = new Map();
  for (const r of rows) {
    const g = r.group ?? "value";
    if (!groups.has(g)) groups.set(g, new Map());
    groups.get(g).set(r[xKey], r.value);
  }
  const series = [...groups.entries()].map(([name, m]) => ({
    name,
    data: cats.map((c) => (m.has(c) ? m.get(c) : null)),
  }));
  return { cats, series };
}

// The X field of line / area / column data may be called time or category
function xKeyOf(rows) {
  const sample = rows && rows[0];
  return sample && "time" in sample ? "time" : "category";
}

export function buildEChartsOption(config, opts = {}) {
  if (!config || typeof config !== "object" || !config.type) return null;
  const { type, title, axisXTitle, axisYTitle } = config;
  const rows = Array.isArray(config.data) ? config.data : [];
  const width = opts.width || 0;
  const compact = width > 0 && width < 480;

  const titleOpt = titleOf(title, width, compact);
  const hasTitle = !!titleOpt;
  const base = { color: COLORS, textStyle: { fontFamily: FONT }, title: titleOpt };

  switch (type) {
    case "line":
    case "area": {
      const { cats, series } = splitByGroup(rows, xKeyOf(rows));
      const multi = series.length > 1;
      const sparse = cats.length <= 2; // one or two points: symbols must show, or nothing is visible
      return {
        ...base,
        tooltip: { trigger: "axis", confine: true },
        legend: multi ? topLegend(hasTitle) : undefined,
        grid: { left: 8, right: 24, top: gridTop(hasTitle, multi), bottom: 36, containLabel: true },
        xAxis: { type: "category", data: cats, boundaryGap: type !== "area", axisLabel: catLabelH(compact), ...hAxisName(axisXTitle) },
        yAxis: { type: "value", axisLabel: valLabel(), splitLine: SPLIT_LINE, ...vAxisName(axisYTitle) },
        series: series.map((s) => ({
          ...s,
          type: "line",
          smooth: true,
          showSymbol: sparse,
          symbolSize: 6,
          lineStyle: { width: 2 },
          areaStyle: type === "area" ? { opacity: 0.12 } : undefined,
        })),
      };
    }
    case "column":
    case "bar": {
      const { cats, series } = splitByGroup(rows, xKeyOf(rows));
      const multi = series.length > 1;
      const horizontal = type === "bar";
      const catAxis = { type: "category", data: cats, axisLabel: horizontal ? catLabelV(compact) : catLabelH(compact) };
      const valAxis = { type: "value", axisLabel: valLabel(), splitLine: SPLIT_LINE };
      const radius = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
      return {
        ...base,
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true },
        legend: multi ? topLegend(hasTitle) : undefined,
        grid: { left: 8, right: 24, top: gridTop(hasTitle, multi), bottom: 36, containLabel: true },
        xAxis: horizontal ? { ...valAxis, ...hAxisName(axisXTitle) } : { ...catAxis, ...hAxisName(axisXTitle) },
        yAxis: horizontal ? { ...catAxis, ...vAxisName(axisYTitle) } : { ...valAxis, ...vAxisName(axisYTitle) },
        series: series.map((s) => ({ ...s, type: "bar", barMaxWidth: 32, itemStyle: { borderRadius: radius } })),
      };
    }
    case "pie": {
      return {
        ...base,
        tooltip: { trigger: "item", confine: true },
        legend: bottomLegend(),
        series: [
          {
            type: "pie",
            radius: ["38%", "64%"],
            center: ["50%", hasTitle ? "52%" : "46%"],
            avoidLabelOverlap: true,
            minShowLabelAngle: 6,
            itemStyle: { borderColor: "#fff", borderWidth: 2 },
            label: { show: !compact, color: "#5c5a57", fontFamily: FONT },
            labelLayout: { hideOverlap: true },
            labelLine: { show: !compact },
            data: rows.map((r) => ({ name: r.category, value: r.value })),
          },
        ],
      };
    }
    case "scatter": {
      const groups = new Map();
      for (const r of rows) {
        const g = r.group ?? "points";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push([r.x, r.y]);
      }
      const multi = groups.size > 1;
      return {
        ...base,
        tooltip: { trigger: "item", confine: true },
        legend: multi ? topLegend(hasTitle) : undefined,
        grid: { left: 8, right: 24, top: gridTop(hasTitle, multi), bottom: 36, containLabel: true },
        xAxis: { type: "value", axisLabel: valLabel(), splitLine: SPLIT_LINE, ...hAxisName(axisXTitle) },
        yAxis: { type: "value", axisLabel: valLabel(), splitLine: SPLIT_LINE, ...vAxisName(axisYTitle) },
        series: [...groups.entries()].map(([name, pts]) => ({ name, type: "scatter", symbolSize: 10, data: pts })),
      };
    }
    case "radar": {
      const names = [];
      const seen = new Set();
      for (const r of rows) {
        if (!seen.has(r.name)) {
          seen.add(r.name);
          names.push(r.name);
        }
      }
      const max = Math.max(...rows.map((r) => r.value || 0), 1);
      const groups = new Map();
      for (const r of rows) {
        const g = r.group ?? "value";
        if (!groups.has(g)) groups.set(g, new Map());
        groups.get(g).set(r.name, r.value);
      }
      const multi = groups.size > 1;
      return {
        ...base,
        tooltip: { confine: true },
        legend: multi ? bottomLegend() : undefined,
        radar: {
          indicator: names.map((n) => ({ name: n, max })),
          center: ["50%", hasTitle ? "54%" : "50%"],
          radius: compact ? "56%" : "62%",
          axisName: { color: "#5c5a57", fontFamily: FONT, fontSize: 11 },
          splitLine: { lineStyle: { color: "#e8e4dc" } },
          splitArea: { areaStyle: { color: ["#fff", "#f1efe8"] } },
        },
        series: [
          {
            type: "radar",
            symbolSize: 4,
            areaStyle: { opacity: 0.1 },
            data: [...groups.entries()].map(([name, m]) => ({ name, value: names.map((n) => m.get(n) ?? 0) })),
          },
        ],
      };
    }
    case "funnel": {
      return {
        ...base,
        tooltip: { trigger: "item", confine: true },
        legend: bottomLegend(),
        series: [
          {
            type: "funnel",
            top: hasTitle ? 48 : 24,
            bottom: 32,
            minSize: "20%",
            label: { color: "#fff", fontFamily: FONT },
            data: rows.map((r) => ({ name: r.category, value: r.value })),
          },
        ],
      };
    }
    case "dual-axes": {
      const { cats, series } = splitByGroup(rows, xKeyOf(rows));
      return {
        ...base,
        tooltip: { trigger: "axis", confine: true },
        legend: topLegend(hasTitle),
        grid: { left: 8, right: 16, top: gridTop(hasTitle, true), bottom: 36, containLabel: true },
        xAxis: { type: "category", data: cats, axisLabel: catLabelH(compact), ...hAxisName(axisXTitle) },
        yAxis: [
          { type: "value", axisLabel: valLabel(), splitLine: SPLIT_LINE },
          { type: "value", axisLabel: valLabel(), splitLine: { show: false } },
        ],
        series: series.map((s, i) =>
          i === 0
            ? { ...s, type: "bar", yAxisIndex: 0, barMaxWidth: 32, itemStyle: { borderRadius: [4, 4, 0, 0] } }
            : { ...s, type: "line", yAxisIndex: 1, smooth: true, showSymbol: false, lineStyle: { width: 2 } }
        ),
      };
    }
    case "histogram": {
      const vals = rows.map((r) => r.value);
      return {
        ...base,
        tooltip: { trigger: "axis", confine: true },
        grid: { left: 8, right: 24, top: gridTop(hasTitle, false), bottom: 36, containLabel: true },
        xAxis: { type: "category", data: vals.map((_, i) => i + 1), axisLabel: catLabelH(compact), ...hAxisName(axisXTitle) },
        yAxis: { type: "value", axisLabel: valLabel(), splitLine: SPLIT_LINE, ...vAxisName(axisYTitle) },
        series: [{ type: "bar", data: vals, barCategoryGap: "0%", itemStyle: { borderRadius: [3, 3, 0, 0] } }],
      };
    }
    default:
      return null; // unknown type — render nothing
  }
}
