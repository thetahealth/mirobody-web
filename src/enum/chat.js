export const MESSAGE_ROLE = {
  USER: "user",
  ASSISTANT: "assistant",
};

export const CHAT_HISTORY_SWITCH = {
  CONVERSATION: "conversation",
  PERSON: "person",
};

export const CHART_MESSAGE_TYPE = {
  DEFAULT: "__default__",
  USER_QUESTION: "user_question",
  USER_FILE_LIST: "user_file_list",
  THINKING_GROUP: "__thinking_group__",
  QUERY_GROUP: "__query_group__",
  // backend message type
  REPLY: "reply",
  THINKING: "thinking",
  QUERY_TITLE: "queryTitle",
  QUERY_DETAIL: "queryDetail",
  FILE: "file",
  TEXT: "text",
  PDF: "pdf",
  IMAGE: "image",
  COST_STATISTICS: "costStatistics",
  ERROR: "error",
  // the agent asked the user a question (ask_user) and is waiting: question +
  // one-tap options; the tap sends an ordinary message that resumes the turn
  WIDGET: "widget",
  END: "end",
};

export const CHART_MESSAGE_STATUS = {
  ANALYZING: "analyzing",
  TOOL_CALLING: "tool_calling",
  THINKING: "thinking",
  ERROR: "error",
  END: "end",
};

/**
 * Message types that should be appended when consecutive messages have the same type
 * Only REPLY and THINKING should be merged, other types like queryTitle and queryDetail should remain separate
 */
export const APPENDABLE_MESSAGE_TYPES = [
  CHART_MESSAGE_TYPE.REPLY,
  CHART_MESSAGE_TYPE.THINKING,
];

/**
 * Validate if the given type is a valid CHART_MESSAGE_TYPE
 * @param {string} type - The message type to validate
 * @returns {boolean} - Returns true if type is valid, false otherwise
 */
export const isValidChartMessageType = (type) => {
  const validTypes = Object.values(CHART_MESSAGE_TYPE);
  return validTypes.includes(type);
};

/**
 * `end` chunk's `finish_reason`. Mirror of `FINISH_*` in
 * `mirobody/agent/chat/adapters/base.py`; the wire values are these strings.
 *
 * All three used to render as "Answer Completed" — including `unavailable`,
 * where the model was never reached, which a user reads as "it answered and
 * the answer is empty".
 */
export const FINISH_STOP = "stop";
export const FINISH_ERROR = "error";
export const FINISH_UNAVAILABLE = "unavailable";

/**
 * `queryDetail` chunk's `status`, off the tool's envelope. Mirror of
 * `STATUS_*` in `mirobody/kernel/tools.py`.
 *
 * The point of reading it is that the alternative is recovering "the tool
 * refused" from the rendered table text.
 */
export const TOOL_STATUS_OK = "ok";
export const TOOL_STATUS_PARTIAL = "partial";
export const TOOL_STATUS_ERROR = "error";
