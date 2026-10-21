import { CHART_MESSAGE_TYPE, FINISH_EMPTY, FINISH_ERROR, FINISH_UNAVAILABLE } from "../../../../../enum/chat";

export const LINE_LOADING = "loading";
export const LINE_DONE = "done";
export const LINE_ERROR = "error";

export const finishReasonOf = (messages) => messages?.findLast((m) => m.type === CHART_MESSAGE_TYPE.END)?.finish_reason ?? null;

// Transport EOF, cancellation and a model's terminal frame mean different
// things. Historical turns have status=end even when old rows lack end frames.
export const statusLineFor = (messages = [], status = "streaming", completionReason) => {
  const reason = finishReasonOf(messages);
  const ended = status === "end" || messages.some((m) => m.type === CHART_MESSAGE_TYPE.END);
  if (messages.some((m) => m.type === CHART_MESSAGE_TYPE.ERROR)) return { kind: LINE_ERROR, key: "status_error" };
  if (completionReason === "cancelled") return { kind: LINE_DONE, key: "status_cancelled" };
  if (completionReason === "disconnected" || completionReason === "error") return { kind: LINE_ERROR, key: "status_stopped_early" };
  if (reason === FINISH_UNAVAILABLE) return { kind: LINE_ERROR, key: "status_unavailable" };
  if (reason === FINISH_ERROR) return { kind: LINE_ERROR, key: "status_stopped_early" };
  if (messages.some((m) => m.type === CHART_MESSAGE_TYPE.INTERRUPT)) return { kind: LINE_DONE, key: "" };
  const answer = messages.some((m) => m.type === CHART_MESSAGE_TYPE.TEXT && m.text?.trim());
  if (ended) return reason === FINISH_EMPTY || !answer
    ? { kind: LINE_ERROR, key: "status_empty" } : { kind: LINE_DONE, key: "" };
  const work = messages.some((m) => m.type === CHART_MESSAGE_TYPE.TOOL_CALL ||
    m.type === CHART_MESSAGE_TYPE.CONTEXT || (m.type === CHART_MESSAGE_TYPE.REASONING && m.reasoning?.trim()));
  return { kind: LINE_LOADING, key: work || answer ? "" : "process_preparing" };
};
