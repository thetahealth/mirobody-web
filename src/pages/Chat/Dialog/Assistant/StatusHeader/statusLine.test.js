import { describe, it, expect } from "vitest";
import { LINE_DONE, LINE_ERROR, LINE_LOADING, finishReasonOf, statusLineFor } from "./statusLine";
import {
  CHART_MESSAGE_TYPE,
  FINISH_EMPTY,
  FINISH_ERROR,
  FINISH_STOP,
  FINISH_UNAVAILABLE,
  TOOL_STATUS_ERROR,
} from "../../../../../enum/chat";

// The line speaks only when nothing else on the page does. `stop`, `error` and
// `unavailable` all used to render "Answer Completed" with a tick, so a turn
// where the model was never reached looked like a successful empty answer.

const end = (finish_reason) => ({
  type: CHART_MESSAGE_TYPE.END,
  ...(finish_reason ? { finish_reason } : {}),
});
const reply = () => ({ type: CHART_MESSAGE_TYPE.TEXT, text: "hi" });
const thought = () => ({ type: CHART_MESSAGE_TYPE.REASONING, reasoning: "hmm" });
const call = () => ({ type: CHART_MESSAGE_TYPE.TOOL_CALL, id: "c1", name: "query_health_indicators" });
const refused = () => ({ type: CHART_MESSAGE_TYPE.TOOL_RESULT, tool_call_id: "c1", status: TOOL_STATUS_ERROR });

describe("before anything arrives", () => {
  it("acknowledges preparation before a model token exists", () => {
    expect(statusLineFor([])).toEqual({ kind: LINE_LOADING, key: "process_preparing" });
  });
});

describe("transport completion and history", () => {
  it("does not spin after cancellation or a missing end frame", () => {
    expect(statusLineFor([], "end", "cancelled")).toEqual({ kind: LINE_DONE, key: "status_cancelled" });
    expect(statusLineFor([thought()], "end", "disconnected").key).toBe("status_stopped_early");
    expect(statusLineFor([thought()], "end").key).toBe("status_empty");
    expect(statusLineFor([reply()], "end").key).toBe("");
  });
  it("keeps preparation visible after a notice or usage receipt", () => {
    expect(statusLineFor([{ type: "notice", message: "Using local model" }, { type: "usage", context: {} }]).key).toBe("process_preparing");
  });
  it("does not mistake an ask-user pause for an empty answer", () => {
    expect(statusLineFor([call(), { type: "interrupt", question: "Date?" }, end()], "end").key).toBe("");
  });
});

describe("while the model works", () => {
  it.each([[[thought()]], [[thought(), call()]], [[call(), refused()]], [[reply()]]])(
    "stays quiet: the thinking panel or the answer speaks (%#)",
    (messages) => {
      expect(statusLineFor(messages).key).toBe("");
    },
  );
});

describe("end: finish_reason decides the closing line", () => {
  it("stop needs no line", () => {
    expect(statusLineFor([reply(), end(FINISH_STOP)])).toEqual({ kind: LINE_DONE, key: "" });
  });

  it("an end frame with no finish_reason still reads as done", () => {
    expect(statusLineFor([reply(), end()])).toEqual({ kind: LINE_DONE, key: "" });
  });

  it.each([
    [FINISH_UNAVAILABLE, "status_unavailable"],
    [FINISH_ERROR, "status_stopped_early"],
    [FINISH_EMPTY, "status_empty"],
  ])("%s is an error line", (reason, key) => {
    expect(statusLineFor([end(reason)])).toEqual({ kind: LINE_ERROR, key });
  });

  it("finishReasonOf reads the last frame", () => {
    expect(finishReasonOf([reply(), end(FINISH_ERROR)])).toBe(FINISH_ERROR);
    expect(finishReasonOf([reply()])).toBe(null);
  });
});

describe("an error frame anywhere", () => {
  it("wins over whatever arrived last", () => {
    expect(statusLineFor([{ type: CHART_MESSAGE_TYPE.ERROR, message: "x" }, reply()])).toEqual({
      kind: LINE_ERROR,
      key: "status_error",
    });
  });
});
