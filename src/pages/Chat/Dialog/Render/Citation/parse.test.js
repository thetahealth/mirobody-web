import { describe, it, expect } from "vitest";
import {
  parseCitedText,
  classifyCiteToken,
  parseToolResultTables,
  citeMarkdownSource,
  CITE_SCHEME,
  rowLabel,
} from "./parse";

describe("parseCitedText", () => {
  it("splits an answer into text and cite segments, tags consumed", () => {
    const text =
      "<statement>你的 LDL 从 3.8 降到 2.9 mmol/L<cite>[r3][r9]</cite></statement>" +
      "<statement>门诊病历写的处理意见是三个月后复查血脂<cite>[门诊病历-2026-03-31.pdf#L12-L14]</cite></statement>" +
      "建议三个月后复查。";
    const segs = parseCitedText(text);
    expect(segs).toEqual([
      { kind: "text", text: "你的 LDL 从 3.8 降到 2.9 mmol/L" },
      { kind: "cites", tokens: ["r3", "r9"] },
      { kind: "text", text: "门诊病历写的处理意见是三个月后复查血脂" },
      { kind: "cites", tokens: ["门诊病历-2026-03-31.pdf#L12-L14"] },
      { kind: "text", text: "建议三个月后复查。" },
    ]);
  });

  it("is byte-stable across a partial stream: no raw tag ever surfaces", () => {
    const full =
      "<statement>数值是 5.4<cite>[r1]</cite></statement>。";
    // Feed every prefix: a raw tag must never reach the screen, whatever
    // frame the stream is on.
    for (let i = 1; i <= full.length; i++) {
      const rendered = parseCitedText(full.slice(0, i))
        .map((s) => (s.kind === "text" ? s.text : ""))
        .join("");
      expect(rendered).not.toMatch(/<\/?(statement|cite)/);
    }
    // The cite chips only appear once the tag closed.
    expect(parseCitedText("<statement>数值是 5.4<cite>[r1")).toEqual([
      { kind: "text", text: "数值是 5.4[r1" },
    ]);
    expect(parseCitedText("<statemen")).toEqual([]);
    expect(parseCitedText(full)).toEqual([
      { kind: "text", text: "数值是 5.4" },
      { kind: "cites", tokens: ["r1"] },
      { kind: "text", text: "。" },
    ]);
  });

  it("passes legacy markup-free answers through untouched", () => {
    const legacy = "甘油三酯 1.9 mmol/L，来自你 3 月的报告 (r3)，参考范围 <1.7。";
    expect(parseCitedText(legacy)).toEqual([{ kind: "text", text: legacy }]);
  });
});

describe("classifyCiteToken", () => {
  it("recognises the three kinds and refuses to guess the rest", () => {
    expect(classifyCiteToken("r12")).toEqual({ kind: "rid", rid: "r12", raw: "r12" });
    expect(classifyCiteToken("ref:openfda:12345").kind).toBe("ref");
    expect(classifyCiteToken("体检报告-2026-03-31.md#L12-L14")).toEqual({
      kind: "file",
      file: "体检报告-2026-03-31.md",
      lineStart: 12,
      lineEnd: 14,
      raw: "体检报告-2026-03-31.md#L12-L14",
    });
    expect(classifyCiteToken("report.md#L7").lineEnd).toBe(7);
    expect(classifyCiteToken("some free text")).toEqual({ kind: "unknown", raw: "some free text" });
  });
});

describe("parseToolResultTables", () => {
  const TABLE = [
    "(constants: indicator=glucose, unit=mmol/L)",
    "rid|time|value|ref|flag|file",
    "r1|2026-03-01 08:12|5.4|3.9-6.1||体检报告-2026-03.pdf",
    "r2|2026-08-01 08:01|4.9|3.9-6.1||体检报告-2026-08.pdf",
    "",
    "(window=2026-01-01..2026-10-01, tz=Asia/Shanghai, dates=tz_exact, view=latest, rows=2)",
    "notes: cite a row's rid, as (r3), next to any number you quote from it",
  ].join("\n");

  it("maps rid → row with hoisted constants applied", () => {
    const { rids } = parseToolResultTables(TABLE);
    expect(rids.get("r1")).toMatchObject({
      rid: "r1",
      indicator: "glucose",
      unit: "mmol/L",
      value: "5.4",
      file: "体检报告-2026-03.pdf",
    });
    expect(rids.get("r2").time).toBe("2026-08-01 08:01");
    expect(rowLabel(rids.get("r1"))).toBe("glucose · 2026-03-01 08:12");
  });

  it("treats a single-row table — every column hoisted — as one row", () => {
    // kernel/query.py::compact returns ONLY the constants line when nothing varies.
    const { rids } = parseToolResultTables(
      "(constants: rid=r7, indicator=ldl, value=2.9, unit=mmol/L, date=2026-08-01)",
    );
    expect(rids.get("r7")).toMatchObject({ value: "2.9", date: "2026-08-01" });
  });

  it("keeps escaped pipes inside a cell and reads medref ref lines", () => {
    const content = [
      "rid|name|note",
      "r3|vitamin D|a\\|b combined",
      "",
      "[ref:medlineplus:99887] MedlinePlus (U.S. National Library of Medicine) · Atorvastatin › What it is (en)",
      "    This medicine lowers cholesterol.",
      "    https://medlineplus.gov/druginfo/meds/a600045.html",
    ].join("\n");
    const { rids, refs } = parseToolResultTables(content);
    expect(rids.get("r3").note).toBe("a|b combined");
    expect(rids.get("r3").name).toBe("vitamin D");
    const ref = refs.get("ref:medlineplus:99887");
    expect(ref.source).toBe("MedlinePlus (U.S. National Library of Medicine)");
    expect(ref.url).toBe("https://medlineplus.gov/druginfo/meds/a600045.html");
  });

  it("ignores garbage: error renderings and a truncated last row mint nothing", () => {
    const { rids: e } = parseToolResultTables(
      "error (denied): authorization required. Fix the arguments and try once more.",
    );
    expect(e.size).toBe(0);
    const cut = [
      "rid|time|value",
      "r1|2026-03-01|5.4",
      "r9|2026-0… cut at 40000 characters",
    ].join("\n");
    const { rids } = parseToolResultTables(cut);
    expect([...rids.keys()]).toEqual(["r1"]);
  });
});

describe("citeMarkdownSource", () => {
  it("re-expresses cites as cite: links and leaves markup-free text alone", () => {
    const legacy = "甘油三酯 (r3)，参考范围 <1.7。";
    expect(citeMarkdownSource(legacy)).toBe(legacy);
    expect(citeMarkdownSource("<statement>数值 2.9<cite>[r3][ref:openfda:1]</cite></statement>。")).toBe(
      `数值 2.9[r3](${CITE_SCHEME}r3) [ref:openfda:1](${CITE_SCHEME}${encodeURIComponent("ref:openfda:1")})。`,
    );
  });

  it("splits bracket-bearing tokens exactly like the judge's _REF_GROUP_RE", () => {
    // `[报告[1].md#L4]` is NOT a citable token by contract (the judge splits
    // cite bodies on /\[(…)\]/ too): the innermost pair wins, and the rest of
    // the cite body is machine-only text that never reaches the reader. The
    // resulting cite:"1" token classifies as unknown and renders 未核实.
    expect(
      citeMarkdownSource("<statement>x<cite>[报告[1].md#L4]</cite></statement>"),
    ).toBe("x[1](cite:1)");
  });
});

describe("parseCitedText malformed input", () => {
  it("keeps orphan close tags visible and only hides strictly-partial tails", () => {
    expect(parseCitedText("数据正常</statement>其余见报告")).toEqual([
      { kind: "text", text: "数据正常</statement>其余见报告" },
    ]);
    // A tail without its `>` is a mid-stream fragment: hidden until the rest
    // arrives, which is exactly what keeps raw markup off the screen.
    expect(parseCitedText("尾部</cite")).toEqual([{ kind: "text", text: "尾部" }]);
    expect(parseCitedText("尾部</cite>")).toEqual([
      { kind: "text", text: "尾部</cite>" },
    ]);
  });
});
