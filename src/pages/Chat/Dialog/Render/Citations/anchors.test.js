// Where cite groups land, pinned on real answers: every input below is
// cut from an answer a model gave on a demo account (CN test for TH-2134,
// 2026-10-30, and a local stack the same day), markup as it arrived.
import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkRehype from "remark-rehype";
import { prepareCitations } from "./markup";
import { findValues, groupsOf, rehypeCiteAnchors } from "./anchors";

// The same parse react-markdown runs, then the plugin; returns each anchor
// set as `[ids, kind, [texts]]`, in reading order.
function anchors(text) {
  const { markdown, groups } = prepareCitations(text);
  const parser = unified().use(remarkParse).use(remarkGfm).use(remarkCjkFriendly);
  const tree = unified().use(remarkRehype).runSync(parser.parse(markdown));
  rehypeCiteAnchors({ groups })(tree);
  const sets = new Map();
  const walk = (node) => {
    const cite = node.properties?.dataCite;
    if (node.tagName === "span" && cite != null) {
      if (!sets.has(cite)) sets.set(cite, [groupsOf(cite).flatMap((g) => groups[g].ids).join(" "), node.properties.dataCiteKind, []]);
      sets.get(cite)[2].push(node.children[0].value);
    }
    (node.children || []).forEach(walk);
  };
  walk(tree);
  return [...sets.values()];
}

const values = (text) => findValues(text).map(([s, e]) => text.slice(s, e));

describe("findValues", () => {
  it("reads a number with its unit, a range and a reading pair as one value each", () => {
    expect(values("体重 69.5 kg，范围 69.2–70.6 kg，血压 150/95，步数 271,971 步")).toEqual([
      "69.5 kg",
      "69.2–70.6 kg",
      "150/95",
      "271,971 步",
    ]);
    expect(values("−0.8 kg（−1.1%），59.1 /min，LDL < 3.4 mmol/L，HbA1c 5.8%")).toEqual([
      "−0.8 kg",
      "−1.1%",
      "59.1 /min",
      "< 3.4 mmol/L",
      "5.8%",
    ]);
  });

  it("leaves out dates, times, years, kinds and the digits inside names", () => {
    expect(values("2026-10-30 早上 08:00，2025 年 9 月，6 月 10 日 73 kg，9、10 月，7–9 月")).toEqual(["73 kg"]);
    expect(values("2 型糖尿病，CYP2C19，B12 180 pg/mL，第 3 次")).toEqual(["180 pg/mL"]);
  });

  it("does not read a verb or a preposition as a unit", () => {
    expect(values("从 71.6 升到 74.4 次/分")).toEqual(["71.6", "74.4 次/分"]);
    expect(values("7.659 in the first third")).toEqual(["7.659"]);
    expect(values("about 1 hour, then 2 hours")).toEqual(["1 hour", "2 hours"]);
  });

  it("keeps a decimal whole before a month", () => {
    expect(values("7 月开始出现 7.7，8 月 9.1，9 月 9.47")).toEqual(["7.7", "9.1", "9.47"]);
  });
});

describe("rehypeCiteAnchors", () => {
  it("marks the values of a statement, not its words", () => {
    expect(anchors("<statement>HbA1c 为 5.8%，高于参考上限 5.6%<cite>[r2]</cite></statement>")).toEqual([
      ["r2", "value", ["5.8%", "5.6%"]],
    ]);
  });

  it("marks a guideline statement with no value as a whole", () => {
    expect(
      anchors("<statement>HbA1c 反映的是过去两到三个月的平均血糖水平<cite>[ref:medlineplus_test:hemoglobin-a1c-hba1c-test]</cite></statement>，"),
    ).toEqual([["ref:medlineplus_test:hemoglobin-a1c-hba1c-test", "claim", ["HbA1c 反映的是过去两到三个月的平均血糖水平"]]]);
  });

  it("marks a loose cite's own clause inside brackets", () => {
    expect(
      anchors("中间还出现过 7.7、9.1、9.5 这样的峰值（9.1 那次在 8 月 18 日<cite>[r48]</cite>，9.5 那次在 9 月 20 日<cite>[r52]</cite>）。"),
    ).toEqual([
      ["r48", "value", ["9.1"]],
      ["r52", "value", ["9.5"]],
    ]);
  });

  it("keeps a bracket the claim closed before its cite", () => {
    expect(anchors("| 指标 | 变化 |\n|---|---|\n| 体重 | −0.8 kg（−1.1%） <cite>[r33][r45]</cite> |")).toEqual([
      ["r33 r45", "value", ["−0.8 kg", "−1.1%"]],
    ]);
  });

  it("reaches back to the sentence for readings its clause does not state", () => {
    expect(
      anchors("静息心率是唯一有方向的变化：从 9 月的 59.1 /min，一路降到 9 月的 55.7 /min，中间几乎没有反弹段 <cite>[r46][r58]</cite>。"),
    ).toEqual([["r46 r58", "value", ["59.1 /min", "55.7 /min"]]]);
    expect(
      anchors("空腹血糖 5.6 mmol/L（参考 3.9–6.1），没有标记，但距离上限 6.1 只差 0.5<cite>[r3]</cite>。"),
    ).toEqual([["r3", "value", ["5.6 mmol/L", "3.9–6.1", "6.1", "0.5"]]]);
  });

  it("reads 「；」 as joining clauses one cite closes", () => {
    expect(
      anchors("- 血脂：LDL 3.56 → 4.11 mmol/L；甘油三酯 1.84 → 2.85 mmol/L<cite>[r78][r63][r84][r69]</cite>。"),
    ).toEqual([["r78 r63 r84 r69", "value", ["3.56", "4.11 mmol/L", "1.84", "2.85 mmol/L"]]]);
  });

  it("does not widen a document cite to numbers it did not read", () => {
    expect(
      anchors("受检者信息写的是另一个账户（63 岁），如果这是家人的单子，请以你自己的原始报告为准<cite>[/library/mom_lab_2025-11.md#L3-L5]</cite>。"),
    ).toEqual([["/library/mom_lab_2025-11.md#L3-L5", "claim", ["请以你自己的原始报告为准"]]]);
  });

  it("marks a finding resting on several rows from after its label", () => {
    expect(
      anchors("**乳腺与妇科：** 2026 年 7 月 29 日超声提示双侧乳腺结节、双侧乳腺小叶增生、盆腔积液 <cite>[r138][r139][r140]</cite>；"),
    ).toEqual([["r138 r139 r140", "claim", ["2026 年 7 月 29 日超声提示双侧乳腺结节、双侧乳腺小叶增生、盆腔积液"]]]);
  });

  it("marks each cited cell of a table on its own value", () => {
    const table = [
      "| 指标 | 起点 | 终点 | 全年范围 |",
      "| :--- | :--- | :--- | :--- |",
      "| 收缩压 | 114 mmHg <cite>[r28]</cite> | 112 mmHg <cite>[r15]</cite> | 109–119，均值 114.5<cite>[r32]</cite> <cite>[r32]</cite> |",
    ].join("\n");
    expect(anchors(table)).toEqual([
      ["r28", "value", ["114 mmHg"]],
      ["r15", "value", ["112 mmHg"]],
      ["r32", "value", ["114.5"]],
    ]);
  });

  it("moves a cite from a flag or verdict cell onto the row's value, past the reference range", () => {
    const table = [
      "| 指标 | 结果 | 报告参考范围 | 标记 |",
      "| :--- | :--- | :--- | :--- |",
      "| Glycated Hemoglobin-HbA1c（糖化血红蛋白） | 5.8 % | 4.0–5.6 | H <cite>[r4]</cite> |",
      "| 总胆固醇 | 5.30 mmol/L | 3.0–5.18 | 高于参考范围 <cite>[r2]</cite> |",
    ].join("\n");
    expect(anchors(table)).toEqual([
      ["r4", "value", ["5.8 %"]],
      ["r2", "value", ["5.30 mmol/L"]],
    ]);
  });

  it("moves a cite in the reference-range column onto the row's result", () => {
    // The release e2e, 2026-10-31: the row's cite after its printed range,
    // as the prompt's own example writes it.
    const table = [
      "| 项目 | 结果 | 单位 | 报告参考范围 | 判断 | 与 2026-01-05 相比 |",
      "| :--- | :--- | :--- | :--- | :--- | :--- |",
      "| 总胆固醇 TC | 4.45 | mmol/L | 3.0–5.18 <cite>[r4]</cite> | 正常 | 下降（4.72）<cite>[r11]</cite> |",
    ].join("\n");
    expect(anchors(table)).toEqual([
      ["r4", "value", ["4.45"]],
      ["r11", "value", ["4.72"]],
    ]);
  });

  it("keeps a cite on the person's own range, which is a value", () => {
    const table = ["| 指标 | 起点 | 全年范围 |", "| :--- | :--- | :--- |", "| 体重 | 70.3 kg | 69.2–70.6 kg <cite>[r29]</cite> |"].join("\n");
    expect(anchors(table)).toEqual([["r29", "value", ["69.2–70.6 kg"]]]);
  });

  it("folds a second cite with nothing of its own into the cite before it", () => {
    const table = [
      "| 指标 | 判定 |",
      "| :--- | :--- |",
      "| 体重 | 基本持平（趋势判为 flat，−0.67 kg<cite>[r29]</cite>） <cite>[r29]</cite> |",
    ].join("\n");
    expect(anchors(table)).toEqual([["r29 r29", "value", ["−0.67 kg"]]]);
  });

  it("reads an English answer, a cite after its statement's close included", () => {
    expect(
      anchors("<statement>The first third averaged 5.86 h and the last 5.46 h, a fall of about 24 minutes<cite>[r6]</cite></statement>."),
    ).toEqual([["r6", "value", ["5.86 h", "5.46 h", "24 minutes"]]]);
    // DeepSeek, 2026-10-30: every statement of an English answer closed this way.
    expect(anchors("<statement>HbA1c was 5.8%, above the report's upper limit of 5.6%</statement><cite>[r2]</cite>.")).toEqual([
      ["r2", "value", ["5.8%", "5.6%"]],
    ]);
    expect(anchors("Steps changed by +239 steps/day (+5.5%) <cite>[r5][r2]</cite>, small against ±1,500.")).toEqual([
      ["r5 r2", "value", ["+239 steps/day", "+5.5%"]],
    ]);
  });

  it("keeps two statements apart when nothing separates them", () => {
    expect(anchors("<statement>降到 68 kg<cite>[r1]</cite></statement><statement>血压正常<cite>[r2]</cite></statement>")).toEqual([
      ["r1", "value", ["68 kg"]],
      ["r2", "claim", ["血压正常"]],
    ]);
  });

  it("falls back to the words when the only value is inside code", () => {
    expect(anchors("数值 `HbA1c<6.5` 正常<cite>[r1]</cite>。")).toEqual([["r1", "claim", ["数值 ", " 正常"]]]);
  });

  it("never cuts into emphasis", () => {
    expect(anchors("你最近一次空腹血糖是 **5.6 mmol/L**<cite>[r1]</cite>，在范围内。")).toEqual([
      ["r1", "value", ["5.6 mmol/L"]],
    ]);
  });
});
