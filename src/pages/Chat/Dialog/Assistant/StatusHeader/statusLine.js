/**
 * What the status line above an answer should say, as a pure function of the
 * messages received so far.
 *
 * Pulled out of the component for the same reason `frameCoalescer` is its own
 * file: the decision is the part worth testing, and it cannot be tested
 * through a render without also standing up the store, i18n and the API layer.
 *
 * It reads `end.finish_reason` (`stop` / `error` / `unavailable` / `empty`).
 * They all used to print "Answer Completed", including `unavailable`, where
 * the model was never reached. A refused tool call (`tool_result.status`) is
 * shown on its own step in the thinking panel.
 */

import {
  CHART_MESSAGE_STATUS,
  CHART_MESSAGE_TYPE,
  FINISH_EMPTY,
  FINISH_ERROR,
  FINISH_UNAVAILABLE,
} from "../../../../../enum/chat";

/** How the line should look: which icon, and whether it is still spinning. */
export const LINE_LOADING = "loading";
export const LINE_DONE = "done";
export const LINE_ERROR = "error";

/**
 * The frame kind that decides the line, with an explicit error message winning
 * over "whatever arrived last".
 */
export const statusOf = (messages) => {
  if (!messages?.length) return null;
  if (messages.find((m) => m.type === CHART_MESSAGE_STATUS.ERROR)) {
    return CHART_MESSAGE_STATUS.ERROR;
  }
  return messages.at(-1)?.type ?? null;
};

/** `finish_reason` off the `end` frame, when one has arrived. */
export const finishReasonOf = (messages) =>
  messages?.at(-1)?.finish_reason ?? null;

/**
 * The line above an answer, as an i18n key. It speaks only when nothing else
 * does: before the first block arrives ("Thinking"), and when the turn ended
 * badly. While the model works, the thinking panel says what it is doing; a
 * finished answer needs no "Answer Completed" (`key` is empty: no line).
 *
 * @param {Array} messages - the assistant entry's `messages`
 * @returns {{ kind: string, key: string }}
 */
export const statusLineFor = (messages) => {
  const status = statusOf(messages);
  if (status === null) return { kind: LINE_LOADING, key: "process_thinking" };
  if (status === CHART_MESSAGE_TYPE.ERROR) return { kind: LINE_ERROR, key: "status_error" };
  if (status !== CHART_MESSAGE_TYPE.END) return { kind: LINE_LOADING, key: "" };
  const reason = finishReasonOf(messages);
  if (reason === FINISH_UNAVAILABLE) return { kind: LINE_ERROR, key: "status_unavailable" };
  if (reason === FINISH_ERROR) return { kind: LINE_ERROR, key: "status_stopped_early" };
  if (reason === FINISH_EMPTY) return { kind: LINE_ERROR, key: "status_empty" };
  // `stop`, or an older backend that sends no reason at all.
  return { kind: LINE_DONE, key: "" };
};
