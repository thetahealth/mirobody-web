import { describe, expect, it } from "vitest";
import { CHART_MESSAGE_TYPE, TOOL_STATUS_ERROR } from "../../../../../enum/chat";
import {
  STEP_THOUGHT,
  STEP_TOOL,
  argSummary,
  currentStep,
  durationOf,
  kindOf,
  latestHeading,
  toSteps,
  toolCount,
  stepState,
} from "./steps";

const thought = (reasoning, at) => ({ type: CHART_MESSAGE_TYPE.REASONING, id: "t", reasoning, at });
const call = (id, name, args, at) => ({ type: CHART_MESSAGE_TYPE.TOOL_CALL, id, name, args, at });
const result = (id, fields = {}) => ({ type: CHART_MESSAGE_TYPE.TOOL_RESULT, tool_call_id: id, content: "| a |", ...fields });

describe("each tool reads as the work it does", () => {
  it.each([
    ["query_health_indicators", {}, "health"],
    ["eval", {}, "compute"],
    ["python_exec", { code: "print(7 / 3)" }, "compute"],
    ["eval", { code: "const r = await tools.queryHealthIndicators({keywords: ['LDL']})" }, "compute_data"],
    ["eval", { code: "const mean = xs.reduce((a, b) => a + b) / xs.length" }, "compute"],
    ["search_medical_knowledge", {}, "knowledge"],
    ["search_medical_knowledge", { scope: "literature" }, "literature"],
    ["search_medical_knowledge", { scope: "trials" }, "trials"],
    ["read_medical_source", {}, "source"],
    ["read_file", {}, "read_file"],
    ["grep", {}, "files"],
    ["a_tool_from_a_plugin", {}, "tool"],
  ])("%s %o is %s", (name, args, key) => {
    expect(kindOf(name, args).key).toBe(key);
  });
});

describe("truthful lifecycle", () => {
  it("keeps concurrent tools pending when a later call has finished", () => {
    const steps = toSteps([call("a", "python_exec"), call("b", "read_file"), result("b")]);
    expect(currentStep(steps).id).toBe("a");
    expect(stepState(steps[0], true)).toBe("running");
    expect(stepState(steps[0], false)).toBe("unfinished");
    expect(stepState(steps[1], false)).toBe("done");
  });
  it("empty successful results still finish, truncated results are partial", () => {
    const steps = toSteps([call("a", "python_exec"), result("a", { content: "" }), call("b", "read_file"), result("b", { truncated: true })]);
    expect(steps[0].done).toBe(true);
    expect(stepState(steps[1], false)).toBe("partial");
  });
  it("joins actual summary start and completion without exposing summary text", () => {
    const start = { type: "context", phase: "summarization", id: "s1", status: "started", at: 1000 };
    expect(stepState(toSteps([start])[0], true)).toBe("running");
    const steps = toSteps([start, { ...start, status: "completed", at: 7000 }]);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ type: "context", done: true, end: 7000 });
    expect(stepState(toSteps([start, { ...start, status: "failed" }])[0], false)).toBe("failed");
  });
});

describe("the arguments worth showing", () => {
  it("names what a data query asked for, three at most", () => {
    expect(argSummary("query_health_indicators", { keywords: ["LDL", "HDL", "TC", "TG"] })).toBe("LDL, HDL, TC, …");
    expect(argSummary("query_health_indicators", { indicators: ["LDL"], keywords: ["x"] })).toBe("LDL");
  });

  it("shows a file by its name, not its path", () => {
    expect(argSummary("read_file", { file_path: "/library/you_lab_2025-11.md" })).toBe("you_lab_2025-11.md");
  });

  it("shows a search's words and nothing for code", () => {
    expect(argSummary("search_medical_knowledge", { query: "high ALT" })).toBe("high ALT");
    expect(argSummary("eval", { code: "const x = 1" })).toBe("");
    expect(argSummary("query_genetic_data", { rsids: ["rs429358"], gene: "APOE" })).toBe("rs429358, APOE");
  });
});

describe("a group becomes steps", () => {
  const blocks = [
    thought("**Checking the panel**\nLooking at lipids", 1000),
    call("c1", "query_health_indicators", { keywords: ["LDL"] }, 3000),
    result("c1", { at: 4000 }),
    call("c2", "eval", {}, 5000),
    result("c2", { status: TOOL_STATUS_ERROR, at: 9000 }),
  ];

  it("folds each result into its call, in order", () => {
    const steps = toSteps(blocks);
    expect(steps.map((s) => s.type)).toEqual([STEP_THOUGHT, STEP_TOOL, STEP_TOOL]);
    expect(steps[1]).toMatchObject({ done: true, failed: false, summary: "LDL" });
    expect(steps[2]).toMatchObject({ done: true, failed: true });
    expect(toolCount(steps)).toBe(2);
  });

  it("times the group from its first block to its last", () => {
    expect(durationOf(blocks)).toBe(8);
    expect(durationOf(blocks, 21000)).toBe(20);
    expect(durationOf([thought("x")])).toBe(null); // a stored conversation
  });

  it("knows what is running now", () => {
    expect(currentStep(toSteps(blocks))).toBe(null);
    const running = toSteps([...blocks, call("c3", "read_file", { file_path: "/a/b.pdf" })]);
    expect(currentStep(running)).toMatchObject({ name: "read_file", summary: "b.pdf" });
    expect(currentStep(toSteps([thought("hmm")])).type).toBe(STEP_THOUGHT);
  });

  it("drops an empty reasoning stretch", () => {
    expect(toSteps([thought("  ")])).toEqual([]);
  });
});

describe("the headline of a thought", () => {
  it("is the last bold line or heading, when the model writes one", () => {
    expect(latestHeading("**Reading the report**\ntext\n**Comparing draws**\nmore")).toBe("Comparing draws");
    expect(latestHeading("## Plan\nsteps")).toBe("Plan");
    expect(latestHeading("plain reasoning with **bold** inside")).toBe("");
  });
});
