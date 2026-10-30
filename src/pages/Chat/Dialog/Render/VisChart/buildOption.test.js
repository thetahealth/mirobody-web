import { describe, it, expect } from "vitest";
import { buildEChartsOption } from "./buildOption";

const bp = {
  type: "line",
  title: "血压读数（mmHg）",
  data: [
    { time: "2025-09-15", value: 114, group: "收缩压" },
    { time: "2025-10-13", value: 115, group: "收缩压" },
    { time: "2025-09-15", value: 74, group: "舒张压" },
    { time: "2025-10-13", value: 71, group: "舒张压" },
  ],
};

describe("line charts", () => {
  it("draws readings as points joined by straight lines", () => {
    const option = buildEChartsOption(bp);
    for (const s of option.series) expect(s).toMatchObject({ smooth: false, showSymbol: true });
  });

  it("gives two series two colours a reader can tell apart", () => {
    const [a, b] = buildEChartsOption(bp).color;
    expect(a).not.toBe(b);
    expect([a, b]).toEqual(["#2a78d6", "#eb6834"]);
  });

  it("keeps the brand ink for a single series", () => {
    const one = { ...bp, data: bp.data.filter((r) => r.group === "收缩压").map(({ group: _g, ...r }) => r) };
    expect(buildEChartsOption(one).color).toEqual(["#0e3880"]);
  });

  it("keeps the brand ink for a single scatter group too", () => {
    expect(buildEChartsOption({ type: "scatter", data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] }).color).toEqual(["#0e3880"]);
  });

  it("fits a line's axis to its data, and leaves an area's at zero", () => {
    expect(buildEChartsOption(bp).yAxis.scale).toBe(true);
    expect(buildEChartsOption({ ...bp, type: "area" }).yAxis.scale).toBe(false);
  });

  it("stops marking every point once there are too many to tell apart", () => {
    const year = { type: "line", data: Array.from({ length: 365 }, (_, i) => ({ time: String(i), value: i })) };
    expect(buildEChartsOption(year).series[0].showSymbol).toBe(false);
  });
});
