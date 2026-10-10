import { describe, it, expect } from "vitest";
import { buildCiteRegistry } from "./registry";

const toolResult = [
  "(constants: indicator=ldl, unit=mmol/L)",
  "rid|name|first_date|last_date|avg|file",
  "r3|低密度脂蛋白|2026-03-01|2026-08-01|3.35|体检报告-2026-08.pdf",
  "",
  "(window=2026-01-01..2026-10-01, tz=Asia/Shanghai, dates=tz_exact, view=stats, rows=1)",
].join("\n");
const medref = [
  "1 reference passage(s) from the bundled offline corpus (v1).",
  "[ref:openfda:42] FDA drug label (openFDA) · Atorvastatin › Warnings (en)",
  "    Do not stop abruptly.",
  "    https://dailymed.nlm.nih.gov/x",
].join("\n");

describe("buildCiteRegistry over realistic blocks", () => {
  it("merges pipe-table rids and medref refs across message lists", () => {
    const reg = buildCiteRegistry([
      [{ type: "tool_result", content: toolResult }],
      [{ type: "tool_result", content: medref }],
      [{ type: "text", text: "ignored" }, { type: "tool_result", content: ["multimodal"] }],
    ]);
    expect(reg.rids.r3).toMatchObject({ name: "低密度脂蛋白", avg: "3.35", file: "体检报告-2026-08.pdf" });
    expect(reg.refs["ref:openfda:42"].title).toBe("Atorvastatin › Warnings (en)");
    expect(reg.refs["ref:openfda:42"].url).toBe("https://dailymed.nlm.nih.gov/x");
  });
});
