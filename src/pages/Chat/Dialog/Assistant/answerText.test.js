import { expect, it } from "vitest";
import { answerText } from "./answerText";

it("keeps thinking, tools and context management out of answer consumers", () => {
  expect(answerText([
    { type: "reasoning", reasoning: "I will look up the record" },
    { type: "tool_call", name: "python_exec" },
    { type: "tool_result", content: "raw rows" },
    { type: "context", phase: "summarization", status: "completed" },
    { type: "text", text: "The final answer." },
    { type: "usage", context: { summaries: 2 } },
  ])).toBe("The final answer.");
  expect(answerText([{ type: "reasoning", reasoning: "Working" }])).toBe("");
});
