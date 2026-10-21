import { expect, it } from "vitest";
import { markActiveGroup, transformMessagesToThinkingGroup } from "./index";

it("keeps work active across usage receipts and reuses its identity as tokens arrive", () => {
  const reasoning = { type: "reasoning", id: "r1", reasoning: "Checking" };
  const first = transformMessagesToThinkingGroup([reasoning]);
  const next = markActiveGroup(transformMessagesToThinkingGroup([reasoning, { type: "usage", context: {} }, { type: "tool_call", id: "c1", name: "python_exec" }]), true);
  expect(next[0].id).toBe(first[0].id);
  expect(next[0].active).toBe(true);
  expect(next[0].content).toHaveLength(2);
  expect(markActiveGroup(next.map(({ active: _active, ...rest }) => rest), false)[0].active).toBeUndefined();
});

it("backfills results by call ID without putting them into the final answer", () => {
  const groups = transformMessagesToThinkingGroup([
    { type: "tool_call", id: "c1", name: "read_file" },
    { type: "text", id: "t1", text: "Answer" },
    { type: "tool_result", tool_call_id: "c1", content: "raw evidence" },
  ]);
  expect(groups).toHaveLength(2);
  expect(groups[0].content).toHaveLength(2);
  expect(groups[1].text).toBe("Answer");
});

it("ignores empty token blocks and closes thinking at the first answer", () => {
  const groups = markActiveGroup(transformMessagesToThinkingGroup([
    { type: "reasoning", reasoning: " " },
    { type: "context", phase: "summarization", status: "started", id: "s1", at: 1 },
    { type: "context", phase: "summarization", status: "completed", id: "s1", at: 4 },
    { type: "text", text: "Done", at: 5 },
  ]), true);
  expect(groups[0].endedAt).toBe(5);
  expect(groups[0].active).toBeUndefined();
});
