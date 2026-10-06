import { describe, it, expect } from "vitest";
import { fromMarkdown } from "mdast-util-from-markdown";
import { fenceClosed, normalizeChartFences, parseChartSource } from "./parseSource";

// The block the agent's prompt teaches (mirobody/agent/prompts/mirobody.jinja).
const CHART = {
  type: "line",
  title: "Steps",
  data: [
    { time: "2026-09-01", value: 9800 },
    { time: "2026-09-02", value: 7412 },
  ],
};
const JSON_TEXT = JSON.stringify(CHART);

// The raw markdown span react-markdown gives the `code` element of each
// fenced block, as mdast-util-to-hast patches it from the mdast node.
const codeSpans = (md) =>
  fromMarkdown(md)
    .children.filter((n) => n.type === "code")
    .map((n) => ({ lang: n.lang, value: n.value, raw: md.slice(n.position.start.offset, n.position.end.offset) }));

describe("parseChartSource", () => {
  it("reads a well-formed block as it is", () => {
    expect(parseChartSource(JSON_TEXT)).toEqual({ config: CHART, repaired: false });
  });

  it("mends the slip that drew nothing: one closing brace too many", () => {
    // MiniCPM5-2B on a steps chart, 2026-10-06.
    expect(parseChartSource(JSON_TEXT + "}", { repair: true })).toEqual({ config: CHART, repaired: true });
    expect(parseChartSource(JSON_TEXT + "}}\n]", { repair: true })?.config).toEqual(CHART);
  });

  it("mends a closer that skips one, and closers left off the end", () => {
    const skipped = '{"type":"line","data":[{"time":"a","value":1}}';
    expect(parseChartSource(skipped, { repair: true })?.config).toEqual({
      type: "line",
      data: [{ time: "a", value: 1 }],
    });
    const short = '{"type":"line","data":[{"time":"a","value":1}';
    expect(parseChartSource(short, { repair: true })?.config.data).toEqual([{ time: "a", value: 1 }]);
  });

  it("drops a comma before a closer, and a stray closer inside", () => {
    expect(parseChartSource('{"type":"pie","data":[{"category":"a","value":1},]}', { repair: true })?.config.data)
      .toEqual([{ category: "a", value: 1 }]);
    expect(parseChartSource('{"type":"pie",]"data":[]}', { repair: true })?.config).toEqual({ type: "pie", data: [] });
  });

  it("reads JSON fenced a second time inside the chart block", () => {
    expect(parseChartSource("```json\n" + JSON_TEXT, { repair: true })?.config).toEqual(CHART);
    expect(parseChartSource("```json\n" + JSON_TEXT + "\n```", { repair: true })?.config).toEqual(CHART);
  });

  it("leaves braces and commas inside strings alone", () => {
    const text = '{"type":"bar","title":"a}, b]","data":[]}}';
    expect(parseChartSource(text, { repair: true })?.config.title).toBe("a}, b]");
  });

  it("does not guess at what is not one value with slips", () => {
    expect(parseChartSource("not a chart", { repair: true })).toBeNull();
    expect(parseChartSource('{"type":"line","title":"cut mid-str', { repair: true })).toBeNull();
    expect(parseChartSource('{"type":"line"} {"type":"bar"}', { repair: true })).toBeNull();
  });

  it("never mends a block still streaming", () => {
    // Half a block parses only once it is whole; closing it early would draw
    // a chart of the points written so far.
    expect(parseChartSource(JSON_TEXT.slice(0, 50))).toBeNull();
    expect(parseChartSource(JSON_TEXT + "}")).toBeNull();
  });
});

describe("fenceClosed", () => {
  it("is true once the closing fence has arrived, false while the block streams", () => {
    const [closed] = codeSpans("Text\n\n```vis-chart\n" + JSON_TEXT + "\n```\n\nAfter.");
    const [streaming] = codeSpans("Text\n\n```vis-chart\n" + JSON_TEXT.slice(0, 40));
    const [opened] = codeSpans("```vis-chart\n");
    expect(fenceClosed(closed.raw)).toBe(true);
    expect(fenceClosed(streaming.raw)).toBe(false);
    expect(fenceClosed(opened.raw)).toBe(false);
  });

  it("holds for tildes and longer fences", () => {
    expect(fenceClosed("~~~vis-chart\n{}\n~~~")).toBe(true);
    expect(fenceClosed("````vis-chart\n{}\n````\n")).toBe(true);
  });
});

describe("normalizeChartFences", () => {
  it("collapses a doubled fence, so the text after the chart stays text", () => {
    const md = "```vis-chart\n```json\n" + JSON_TEXT + "\n```\n```\n\nAfter the chart.";
    // Unnormalized: the outer closer opens a code block holding the rest.
    expect(codeSpans(md).map((c) => c.lang)).toEqual(["vis-chart", null]);
    const spans = codeSpans(normalizeChartFences(md));
    expect(spans.map((c) => c.lang)).toEqual(["vis-chart"]);
    expect(JSON.parse(spans[0].value)).toEqual(CHART);
    expect(fenceClosed(spans[0].raw)).toBe(true);
  });

  it("leaves other fences and a single chart fence alone", () => {
    const md = "```js\nconst a = 1;\n```\n\n```vis-chart\n" + JSON_TEXT + "\n```\n";
    expect(normalizeChartFences(md)).toBe(md);
  });
});
