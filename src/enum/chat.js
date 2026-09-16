export const MESSAGE_ROLE = {
  USER: "user",
  ASSISTANT: "assistant",
};

export const CHAT_HISTORY_SWITCH = {
  CONVERSATION: "conversation",
  PERSON: "person",
};

export const CHART_MESSAGE_TYPE = {
  // this client's own grouping, never on the wire
  DEFAULT: "__default__",
  USER_QUESTION: "user_question",
  USER_FILE_LIST: "user_file_list",
  THINKING_GROUP: "__thinking_group__",
  QUERY_GROUP: "__query_group__",
  // Blocks the backend streams, named the way `langchain_core.messages.content`
  // names them. Before Mirobody 1.4.4 these were `reply` / `thinking` /
  // `queryTitle` / `queryArguments` / `queryDetail` / `costStatistics` /
  // `widget`, all carrying a `content` field the backend had invented.
  TEXT: "text",
  REASONING: "reasoning",
  TOOL_CALL: "tool_call",
  TOOL_RESULT: "tool_result",
  USAGE: "usage",
  // the agent asked the user a question (ask_user) and the run is paused:
  // question + one-tap options; a tap sends an ordinary message that resumes it
  INTERRUPT: "interrupt",
  ERROR: "error",
  END: "end",
  // th_messages.message_type, which says what a USER row holds
  FILE: "file",
  PDF: "pdf",
  IMAGE: "image",
};

export const CHART_MESSAGE_STATUS = {
  ANALYZING: "analyzing",
  TOOL_CALLING: "tool_calling",
  THINKING: "thinking",
  ERROR: "error",
  END: "end",
};

/**
 * Which field a block carries its text in. LangChain gives each block type its
 * own name for the payload rather than one shared `content`, and this is that
 * table — `blockText` is how a renderer reads it without branching.
 */
const BLOCK_TEXT_FIELD = {
  [CHART_MESSAGE_TYPE.TEXT]: "text",
  [CHART_MESSAGE_TYPE.REASONING]: "reasoning",
  [CHART_MESSAGE_TYPE.TOOL_CALL]: "name",
  [CHART_MESSAGE_TYPE.TOOL_RESULT]: "content",
  [CHART_MESSAGE_TYPE.ERROR]: "message",
};

/** A block's own text payload, whatever the block type calls it. */
export const blockText = (block) => {
  if (!block) return "";
  const field = BLOCK_TEXT_FIELD[block.type];
  return (field ? block[field] : block.content) ?? "";
};

/**
 * Block types whose text continues the previous block of the same type instead
 * of starting a new one. A turn streams hundreds of `text` blocks and renders
 * one paragraph; a tool call and its result each stand alone.
 */
export const APPENDABLE_MESSAGE_TYPES = [
  CHART_MESSAGE_TYPE.TEXT,
  CHART_MESSAGE_TYPE.REASONING,
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
 * `end` block's `finish_reason`. Mirror of `FINISH_*` in
 * `mirobody/agent/wire/blocks.py`; the wire values are these strings.
 *
 * They used to render as "Answer Completed" alike — including `unavailable`,
 * where the model was never reached, which a user reads as "it answered and
 * the answer is empty".
 */
export const FINISH_STOP = "stop";
export const FINISH_ERROR = "error";
export const FINISH_UNAVAILABLE = "unavailable";
export const FINISH_EMPTY = "empty";

/**
 * `tool_result` block's `status`, off the tool's envelope. Mirror of
 * `STATUS_*` in `mirobody/kernel/tools.py`.
 *
 * The point of reading it is that the alternative is recovering "the tool
 * refused" from the rendered table text.
 */
export const TOOL_STATUS_OK = "ok";
export const TOOL_STATUS_PARTIAL = "partial";
export const TOOL_STATUS_ERROR = "error";
