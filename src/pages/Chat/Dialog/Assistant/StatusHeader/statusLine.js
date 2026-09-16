/**
 * What the status line above an answer should say, as a pure function of the
 * messages received so far.
 *
 * Pulled out of the component for the same reason `frameCoalescer` is its own
 * file: the decision is the part worth testing, and it cannot be tested
 * through a render without also standing up the store, i18n and the API layer.
 *
 * The two fields this reads:
 *
 * - `tool_result.status` — `ok` / `partial` / `error`, taken off the tool's
 *   envelope, plus `error_kind` and `truncated` when they apply. The envelope
 *   exists so a reader does not have to recover "the tool refused" from a
 *   rendered table.
 * - `end.finish_reason` — `stop` / `error` / `unavailable` / `empty`. They all
 *   used to print "Answer Completed", including `unavailable`, where the model
 *   was never reached. An empty answer under a tick mark reads as "it
 *   answered, and the answer is nothing".
 */

import {
  CHART_MESSAGE_STATUS,
  CHART_MESSAGE_TYPE,
  FINISH_EMPTY,
  FINISH_ERROR,
  FINISH_UNAVAILABLE,
  TOOL_STATUS_ERROR,
  TOOL_STATUS_PARTIAL,
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

/** The most recent tool result, which carries the envelope's verdict. */
export const lastToolResultOf = (messages) =>
  [...(messages || [])]
    .reverse()
    .find((m) => m.type === CHART_MESSAGE_TYPE.TOOL_RESULT) ?? null;

const lastToolName = (messages) =>
  [...(messages || [])]
    .reverse()
    .find((m) => m.type === CHART_MESSAGE_TYPE.TOOL_CALL)?.name ?? "";

/**
 * @param {Array} messages - the assistant entry's `messages`
 * @returns {{ kind: string, text: string }}
 */
export const statusLineFor = (messages) => {
  const status = statusOf(messages);

  switch (status) {
    case CHART_MESSAGE_TYPE.TEXT:
      return { kind: LINE_LOADING, text: "Analyzing..." };

    case CHART_MESSAGE_TYPE.REASONING:
      return { kind: LINE_LOADING, text: "Thinking..." };

    case CHART_MESSAGE_TYPE.TOOL_CALL:
    case CHART_MESSAGE_TYPE.TOOL_RESULT: {
      const result = lastToolResultOf(messages);
      // The tool has answered but the turn is still open. Saying what the
      // answer WAS beats leaving "Running tool" up while the model reads a
      // refusal — and the refusal is the case a user most needs to see, since
      // the model may go on to answer from nothing.
      if (result?.status === TOOL_STATUS_ERROR) {
        return {
          kind: LINE_ERROR,
          text:
            "Tool refused" + (result.error_kind ? `: ${result.error_kind}` : ""),
        };
      }
      if (result?.truncated || result?.status === TOOL_STATUS_PARTIAL) {
        return { kind: LINE_LOADING, text: "Tool result truncated" };
      }
      return { kind: LINE_LOADING, text: "Running tool: " + lastToolName(messages) };
    }

    case CHART_MESSAGE_TYPE.END: {
      const reason = finishReasonOf(messages);
      if (reason === FINISH_UNAVAILABLE) {
        return { kind: LINE_ERROR, text: "The model could not be reached" };
      }
      if (reason === FINISH_ERROR) {
        return { kind: LINE_ERROR, text: "The answer stopped early" };
      }
      if (reason === FINISH_EMPTY) {
        return { kind: LINE_ERROR, text: "The model returned no answer" };
      }
      // `stop`, or an older backend that sends no reason at all.
      return { kind: LINE_DONE, text: "Answer Completed" };
    }

    case CHART_MESSAGE_TYPE.ERROR:
      return { kind: LINE_ERROR, text: "Something went wrong, please retry" };

    default:
      return { kind: LINE_LOADING, text: "Analyzing..." };
  }
};
