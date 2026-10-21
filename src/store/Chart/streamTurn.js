import { CHART_MESSAGE_TYPE, isValidChartMessageType } from "../../enum/chat";
import { createFrameCoalescer } from "./frameCoalescer";

const IMMEDIATE = new Set(["context", "tool_call", "tool_result", "interrupt", "notice", "error", "end"]);

// One request owns its callbacks, even when Stop is immediately followed by a
// new question. The caller binds apply/finish to that question, never "last".
export async function streamTurn({ request, payload, signal, apply, finish, errorMessage }) {
  let settled = false;
  let receivedEnd = false;
  let interrupted = false;
  let failed = false;
  const visibleChannels = new Set();
  const { push, flush } = createFrameCoalescer(apply);

  const onerror = (error) => {
    if (settled || signal?.aborted || failed) return;
    failed = true;
    push({ type: CHART_MESSAGE_TYPE.ERROR, message: errorMessage(error) });
    flush();
  };

  try {
    await request({
      payload,
      signal,
      onmessage: (block) => {
        if (settled || signal?.aborted || receivedEnd || !isValidChartMessageType(block?.type)) return;
        const { type } = block;
        receivedEnd = type === CHART_MESSAGE_TYPE.END;
        interrupted ||= type === CHART_MESSAGE_TYPE.INTERRUPT;
        failed ||= type === CHART_MESSAGE_TYPE.ERROR;
        push(block);
        const content = type === "reasoning" ? block.reasoning : type === "text" ? block.text : "";
        const firstVisible = typeof content === "string" && content.trim() && !visibleChannels.has(type);
        if (firstVisible) visibleChannels.add(type);
        // The first visible token does not wait behind the batching timer.
        if (firstVisible || IMMEDIATE.has(type)) flush();
      },
      onerror,
      onclose: () => {},
    });
  } catch (error) {
    onerror(error);
  } finally {
    settled = true;
    flush();
  }
  const reason = failed ? "error" : receivedEnd || interrupted ? "completed" : signal?.aborted ? "cancelled" : "disconnected";
  finish(reason);
  return reason;
}
