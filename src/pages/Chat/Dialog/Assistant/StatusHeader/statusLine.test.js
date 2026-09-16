import { describe, it, expect } from "vitest";
import {
  LINE_DONE,
  LINE_ERROR,
  LINE_LOADING,
  finishReasonOf,
  lastToolResultOf,
  statusLineFor,
} from "./statusLine";
import {
  CHART_MESSAGE_TYPE,
  FINISH_ERROR,
  FINISH_STOP,
  FINISH_UNAVAILABLE,
  TOOL_STATUS_ERROR,
  TOOL_STATUS_OK,
  TOOL_STATUS_PARTIAL,
} from "../../../../../enum/chat";

// `internal/frontend-single-agent-2026-09-05.md` §2.3: two additive fields the
// backend has sent since Mirobody 1.4.0 and this client dropped.
//
// The `end` half is the one that mattered: `stop`, `error` and `unavailable`
// all rendered as "Answer Completed" with a tick mark, so a turn where the
// model was never reached looked like a successful empty answer.

const end = (finish_reason) => ({
  type: CHART_MESSAGE_TYPE.END,
  ...(finish_reason ? { finish_reason } : {}),
});
const tool = (fields = {}) => ({
  type: CHART_MESSAGE_TYPE.TOOL_RESULT,
  tool_call_id: "c1",
  content: "| a | b |",
  ...fields,
});
const title = (name) => ({ type: CHART_MESSAGE_TYPE.TOOL_CALL, id: "c1", name });
const reply = () => ({ type: CHART_MESSAGE_TYPE.TEXT, text: "hi" });

describe("end: finish_reason decides the closing line", () => {
  it("stop is the only one that gets the tick and 'Answer Completed'", () => {
    expect(statusLineFor([reply(), end(FINISH_STOP)])).toEqual({
      kind: LINE_DONE,
      text: "Answer Completed",
    });
  });

  it("unavailable says the model was never reached", () => {
    const line = statusLineFor([end(FINISH_UNAVAILABLE)]);
    expect(line.kind).toBe(LINE_ERROR);
    expect(line.text).toMatch(/could not be reached/);
  });

  it("error says the answer stopped early", () => {
    const line = statusLineFor([reply(), end(FINISH_ERROR)]);
    expect(line.kind).toBe(LINE_ERROR);
    expect(line.text).toMatch(/stopped early/);
  });

  it("an end frame with NO finish_reason still reads as done", () => {
    // An older backend, or a replayed history row. Absence must not turn a
    // finished answer into an error.
    expect(statusLineFor([reply(), end()])).toEqual({
      kind: LINE_DONE,
      text: "Answer Completed",
    });
  });
});

describe("queryDetail: the envelope's verdict, not the rendered table", () => {
  it("a refusal is named, with its error_kind", () => {
    const line = statusLineFor([
      title("query_health_indicators"),
      tool({ status: TOOL_STATUS_ERROR, error_kind: "denied" }),
    ]);
    expect(line.kind).toBe(LINE_ERROR);
    expect(line.text).toBe("Tool refused: denied");
  });

  it("a refusal with no error_kind still says refused", () => {
    expect(statusLineFor([tool({ status: TOOL_STATUS_ERROR })]).text).toBe(
      "Tool refused",
    );
  });

  it("truncated and partial both say truncated, and keep spinning", () => {
    for (const fields of [{ truncated: true }, { status: TOOL_STATUS_PARTIAL }]) {
      const line = statusLineFor([title("t"), tool(fields)]);
      expect(line).toEqual({ kind: LINE_LOADING, text: "Tool result truncated" });
    }
  });

  it("an ok result keeps the running-tool line", () => {
    expect(
      statusLineFor([title("query_medications"), tool({ status: TOOL_STATUS_OK })]),
    ).toEqual({ kind: LINE_LOADING, text: "Running tool: query_medications" });
  });

  it("a result with no status makes no claim — unchanged behaviour", () => {
    expect(statusLineFor([title("resolve_indicator"), tool()])).toEqual({
      kind: LINE_LOADING,
      text: "Running tool: resolve_indicator",
    });
  });

  it("the LAST tool result is the one that counts", () => {
    const line = statusLineFor([
      title("first"),
      tool({ status: TOOL_STATUS_ERROR, error_kind: "no_data" }),
      title("second"),
      tool({ status: TOOL_STATUS_OK }),
    ]);
    expect(line.text).toBe("Running tool: second");
  });
});

describe("an explicit error frame still wins over whatever arrived last", () => {
  it("beats a later end frame", () => {
    const line = statusLineFor([
      { type: CHART_MESSAGE_TYPE.ERROR, content: "boom" },
      end(FINISH_STOP),
    ]);
    expect(line.kind).toBe(LINE_ERROR);
    expect(line.text).toMatch(/went wrong/);
  });
});

describe("edges", () => {
  it.each([[undefined], [null], [[]]])("no messages: %s", (messages) => {
    expect(statusLineFor(messages)).toEqual({
      kind: LINE_LOADING,
      text: "Analyzing...",
    });
    expect(finishReasonOf(messages)).toBeNull();
    expect(lastToolResultOf(messages)).toBeNull();
  });

  it("finishReasonOf reads the LAST frame, not any earlier end", () => {
    expect(finishReasonOf([end(FINISH_ERROR), reply()])).toBeNull();
    expect(finishReasonOf([reply(), end(FINISH_ERROR)])).toBe(FINISH_ERROR);
  });

  it("lastToolResultOf does not mutate the array it is given", () => {
    const messages = [title("a"), tool({ status: TOOL_STATUS_OK }), reply()];
    const before = [...messages];
    lastToolResultOf(messages);
    expect(messages).toEqual(before);
  });
});
