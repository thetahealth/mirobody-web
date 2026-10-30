import { describe, it, expect } from "vitest";
import { citeKind, groupFromHref, linesOf, prepareCitations, stripCitations } from "./markup";

const ANSWER =
  "<statement>LDL 从 3.8 降到 2.9 mmol/L<cite>[r3][r9]</cite></statement>，" +
  "<statement>范围 <3.4<cite>[r9]</cite></statement>。" +
  "<statement>病历写着复查<cite>[/library/门诊 病历.pdf#L12-L14]</cite></statement>";

describe("citation markup", () => {
  it("turns each cite into a zero-width group marker and keeps the statement opening", () => {
    const { markdown, groups } = prepareCitations(ANSWER);
    expect(markdown).toBe(
      "[](statement:)LDL 从 3.8 降到 2.9 mmol/L[](cite:0)，[](statement:)范围 <3.4[](cite:1)。" +
        "[](statement:)病历写着复查[](cite:2)",
    );
    expect(groups).toEqual([{ ids: ["r3", "r9"] }, { ids: ["r9"] }, { ids: ["/library/门诊 病历.pdf#L12-L14"] }]);
  });

  it("makes adjacent cites one group, without the space a chip needed", () => {
    const { markdown, groups } = prepareCitations("均值 114.5<cite>[r32]</cite> <cite>[r32][r31]</cite> |");
    expect(markdown).toBe("均值 114.5[](cite:0) |");
    expect(groups).toEqual([{ ids: ["r32", "r31"] }]);
    expect(prepareCitations("反弹段 <cite>[r46]</cite>。").markdown).toBe("反弹段[](cite:0)。");
    expect(prepareCitations("fell to 69.5 kg <cite>[r1]</cite> by May").markdown).toBe("fell to 69.5 kg[](cite:0) by May");
  });

  it("keeps statements written back to back from running together", () => {
    const text =
      "<statement>HDL 被称为“好”胆固醇<cite>[ref:a:1]</cite></statement><statement>血胆固醇过高会增加风险<cite>[ref:a:2]</cite></statement>。";
    expect(prepareCitations(text).markdown).toBe(
      "[](statement:)HDL 被称为“好”胆固醇[](cite:0) [](statement:)血胆固醇过高会增加风险[](cite:1)。",
    );
    expect(stripCitations(text)).toBe("HDL 被称为“好”胆固醇 血胆固醇过高会增加风险。");
    // Punctuated, nothing is added.
    expect(stripCitations("<statement>甲。<cite>[r1]</cite></statement><statement>乙<cite>[r2]</cite></statement>")).toBe("甲。乙");
  });

  it("reads a misspelt tag as the tag it meant", () => {
    // DeepSeek, 2026-10-30: the statement closed with <xcite>.
    const text = "<statement>均值从 71.6 升到 74.4 次/分<xcite>[r4]</cite></statement>，月均";
    expect(prepareCitations(text)).toEqual({
      markdown: "[](statement:)均值从 71.6 升到 74.4 次/分[](cite:0)，月均",
      groups: [{ ids: ["r4"] }],
    });
    expect(stripCitations(text)).toBe("均值从 71.6 升到 74.4 次/分，月均");
    expect(stripCitations("a</cite> b < c <Cite >[r1]</ cite>")).toBe("a b < c ");
  });

  it("leaves prose and a chart's JSON alone", () => {
    expect(stripCitations("Caffeine can <excite>raise heart rate</excite>.")).toBe("Caffeine can raise heart rate.");
    expect(prepareCitations("a <restatement> b 1<cite>[r1]</cite>").markdown).toBe("a <restatement> b 1[](cite:0)");
    const chart = '```vis-chart\n{"title":"<cite>[r1]</cite> HR"}\n```';
    expect(prepareCitations(`HR 56 bpm<cite>[r2]</cite>\n\n${chart}`)).toEqual({
      markdown: `HR 56 bpm[](cite:0)\n\n${chart}`,
      groups: [{ ids: ["r2"] }],
    });
  });

  it("holds back a tag that has not finished streaming", () => {
    expect(prepareCitations("体重 69.2 kg<cite>[r").markdown).toBe("体重 69.2 kg");
    expect(prepareCitations("体重 69.2 kg<sta").markdown).toBe("体重 69.2 kg");
    expect(prepareCitations("体重 69.2 kg<xci").markdown).toBe("体重 69.2 kg");
    expect(prepareCitations("a < b").markdown).toBe("a < b");
    expect(prepareCitations("a <b").markdown).toBe("a <b");
  });

  it("does not hold back a finished answer whose cite was left open", () => {
    const text = "LDL 5.6 mmol/L<cite>[r1]</cite>，医生建议<cite>[r2] 每三个月复查一次。";
    expect(prepareCitations(text).markdown).toBe("LDL 5.6 mmol/L[](cite:0)，医生建议[](cite:1) 每三个月复查一次。");
    expect(prepareCitations("体重 69.2 kg<cite>[r1][r").markdown).toBe("体重 69.2 kg");
    expect(prepareCitations("图表\n```vis-chart\n{\"title\":\"a <").markdown).toBe("图表\n```vis-chart\n{\"title\":\"a <");
  });

  it("does not let a cite missing its close swallow the answer", () => {
    expect(stripCitations("体重 69.2 kg<cite>[r1] 之后的话")).toBe("体重 69.2 kg 之后的话");
  });

  it("leaves text without markup alone", () => {
    expect(prepareCitations("plain text")).toEqual({ markdown: "plain text", groups: [] });
    expect(prepareCitations(undefined)).toEqual({ markdown: "", groups: [] });
  });

  it("reads back the group a marker carries", () => {
    expect(groupFromHref("cite:3")).toBe(3);
    expect(groupFromHref("statement:")).toBeNull();
    expect(groupFromHref("https://example.org")).toBeNull();
  });

  it("knows the three kinds of cite", () => {
    expect(citeKind("r12")).toBe("row");
    expect(citeKind("ref:medlineplus:2241")).toBe("ref");
    expect(citeKind("/library/a.pdf#L3-L5")).toBe("lines");
    expect(citeKind("web_uploads/x.pdf")).toBe("unknown");
    expect(linesOf("/library/a.pdf#L3-L5")).toEqual({ path: "/library/a.pdf", start: 3, end: 5 });
  });

  it("strips the markup for plain text", () => {
    expect(stripCitations(ANSWER)).toBe("LDL 从 3.8 降到 2.9 mmol/L，范围 <3.4。病历写着复查");
  });
});
