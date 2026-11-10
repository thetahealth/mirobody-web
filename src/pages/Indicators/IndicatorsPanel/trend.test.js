import { describe, it, expect } from "vitest";
import { DENSE, latestRange, movingAverage, parseRange, trendOption, trendSeries } from "./trend";

const pointsOf = (readings) => trendSeries(readings).points;

describe("parseRange", () => {
  it("reads the ranges reports print", () => {
    expect(parseRange("4.0-5.6")).toEqual({ low: 4, high: 5.6 });
    expect(parseRange("3.9–6.1")).toEqual({ low: 3.9, high: 6.1 });
    expect(parseRange("< 5.18")).toEqual({ high: 5.18 });
    expect(parseRange("≥40")).toEqual({ low: 40 });
    expect(parseRange("阴性")).toBeNull();
    expect(parseRange("")).toBeNull();
  });
});

describe("trend", () => {
  const readings = [
    { time: "2026-08-10 00:00:00", value: "7.1", ref: "4.0-6.0", flag: "high" },
    { time: "2025-09-12 00:00:00", value: "5.7", ref: "4.0-5.6", flag: "" },
    { time: "2026-09-30 10:43:00", value: "阴性" },
    { time: "2026-10-19 18:03:00", value: "5.9", ref: "", flag: "" },
  ];

  it("keeps numeric readings, oldest first", () => {
    expect(pointsOf(readings).map((p) => p.value)).toEqual([5.7, 7.1, 5.9]);
  });

  it("bands the newest printed range", () => {
    expect(latestRange(pointsOf(readings))).toEqual({ low: 4, high: 6 });
  });

  it("marks a reading its report flagged, or one outside the range", () => {
    const option = trendOption(pointsOf(readings), { unit: "%" });
    const colours = option.series[0].data.map((d) => d.itemStyle?.color || "");
    // 5.7 is above its own report's 4.0–5.6 though unflagged; 7.1 is flagged;
    // 5.9 printed no range and sits inside the newest one.
    expect(colours).toEqual(["#c0392b", "#c0392b", ""]);
    expect(option.series[0].markArea.data).toEqual([[{ yAxis: 4 }, { yAxis: 6 }]]);
    expect(option.series[0].smooth).toBe(false);
  });
});

describe("flags", () => {
  it("marks every flag a report prints, not only H and L", () => {
    const flagged = ["偏高", "HH", "↑", ""].map((flag, i) => ({ time: `2026-0${i + 1}-01 00:00:00`, value: "5", ref: "4-6", flag }));
    const colours = trendOption(pointsOf(flagged)).series[0].data.map((d) => d.itemStyle?.color || "");
    expect(colours).toEqual(["#c0392b", "#c0392b", "#c0392b", ""]);
  });
});

describe("a dense series", () => {
  const days = Array.from({ length: DENSE + 1 }, (_, i) => ({
    time: `2026-01-01 00:00:00`.replace("01-01", `0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, "0")}`),
    value: String(55 + (i % 4)),
  }));

  it("is drawn faint under its seven-reading average", () => {
    const option = trendOption(pointsOf(days), { labels: { readings: "读数", average: "7 次平均" } });
    expect(option.series.map((s) => s.name)).toEqual(["读数", "7 次平均"]);
    expect(option.series[0].showSymbol).toBe(false);
    expect(option.legend).toBeTruthy();
  });

  it("averages each reading with the six before it", () => {
    expect(movingAverage([1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({ value })))).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 5]);
  });
});

// thetahealth/mirobody#271: one series printed in mg/dL by one lab and mmol/L
// by another. The server sends both in the series' one unit, newest first.
describe("a series printed in two units", () => {
  const cholesterol = [
    { time: "2026-06-20 00:00:00", value: "4.90", unit: "mmol/L", ref: "3.0-5.18", printed: { value: "4.90", unit: "mmol/L", ref: "3.0-5.18" } },
    { time: "2025-03-10 00:00:00", value: "5.48", unit: "mmol/L", ref: "<5.17", converted: true, printed: { value: "212", unit: "mg/dL", ref: "<200" } },
  ];

  it("is plotted as the server sends it, in one unit", () => {
    const { points, unit, left } = trendSeries(cholesterol);
    // Plotted as each report printed it, it drew a fall from 212 to 4.9.
    expect([points.map((p) => p.value), unit, left]).toEqual([[5.48, 4.9], "mmol/L", 0]);
    expect(points.map((p) => p.printed?.value ?? null)).toEqual(["212", null]);
  });

  it("says in the tooltip what the report printed", () => {
    const { points, unit } = trendSeries(cholesterol);
    const option = trendOption(points, { unit, labels: { ref: "参考 ", printed: "报告原值 " } });
    const tip = (i) => option.tooltip.formatter([{ value: option.series[0].data[i].value, data: option.series[0].data[i] }]);
    // It read "212 mmol/L · 参考 <200": a mg/dL reading under the chart's unit.
    expect(tip(0)).toBe("2025-03-10<br/><b>5.48</b> mmol/L · 参考 &lt;5.17<br/>报告原值 212 mg/dL");
    expect(tip(1)).toBe("2026-06-20<br/><b>4.9</b> mmol/L · 参考 3.0-5.18");
  });

  it("judges a converted reading against its converted range", () => {
    const ldl = [
      { time: "2026-06-20 00:00:00", value: "3.10", unit: "mmol/L", ref: "<3.37" },
      { time: "2025-03-10 00:00:00", value: "3.57", unit: "mmol/L", ref: "<2.59", converted: true, printed: { value: "138", unit: "mg/dL", ref: "<100" } },
    ];
    const option = trendOption(pointsOf(ldl), { unit: "mmol/L" });
    expect(option.series[0].data.map((d) => d.itemStyle?.color || "")).toEqual(["#c0392b", ""]);
  });

  it("leaves out a reading the server could not convert, and counts it", () => {
    const albumin = [
      { time: "2026-06-20 00:00:00", value: "600", unit: "umol/L", unit_differs: false },
      { time: "2026-03-01 00:00:00", value: "610", unit: "umol/L" },
      { time: "2025-03-10 00:00:00", value: "40", unit: "g/L", unit_differs: true },
    ];
    const { points, unit, left } = trendSeries(albumin);
    expect([points.map((p) => p.value), unit, left]).toEqual([[610, 600], "umol/L", 1]);
  });
});

describe("the tooltip", () => {
  it("does not run markup read off a document", () => {
    const points = pointsOf([
      { time: "2026-01-01 00:00:00", value: "1", ref: "<img src=x onerror=alert(1)>" },
      { time: "2026-02-01 00:00:00", value: "2" },
    ]);
    const option = trendOption(points, { unit: "<b>u</b>" });
    const data = option.series[0].data[0];
    const tip = option.tooltip.formatter([{ value: data.value, data }]);
    expect(tip).not.toContain("<img");
    expect(tip).toContain("&lt;b&gt;u&lt;/b&gt;");
  });
});
