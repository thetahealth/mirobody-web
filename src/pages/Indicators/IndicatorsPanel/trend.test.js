import { describe, it, expect } from "vitest";
import { DENSE, latestRange, movingAverage, parseRange, trendOption, trendPoints } from "./trend";

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
    expect(trendPoints(readings).map((p) => p.value)).toEqual([5.7, 7.1, 5.9]);
  });

  it("bands the newest printed range", () => {
    expect(latestRange(trendPoints(readings))).toEqual({ low: 4, high: 6 });
  });

  it("marks a reading its report flagged, or one outside the range", () => {
    const option = trendOption(trendPoints(readings), { unit: "%" });
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
    const colours = trendOption(trendPoints(flagged)).series[0].data.map((d) => d.itemStyle?.color || "");
    expect(colours).toEqual(["#c0392b", "#c0392b", "#c0392b", ""]);
  });
});

describe("a dense series", () => {
  const days = Array.from({ length: DENSE + 1 }, (_, i) => ({
    time: `2026-01-01 00:00:00`.replace("01-01", `0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, "0")}`),
    value: String(55 + (i % 4)),
  }));

  it("is drawn faint under its seven-reading average", () => {
    const option = trendOption(trendPoints(days), { labels: { readings: "读数", average: "7 次平均" } });
    expect(option.series.map((s) => s.name)).toEqual(["读数", "7 次平均"]);
    expect(option.series[0].showSymbol).toBe(false);
    expect(option.legend).toBeTruthy();
  });

  it("averages each reading with the six before it", () => {
    expect(movingAverage([1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({ value })))).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 5]);
  });
});
