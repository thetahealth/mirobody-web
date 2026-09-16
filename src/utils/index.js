import { FILE_TYPE, FILE_STATUS } from "../enum/file";
import { LANGUAGE_CODE, LANGUAGE_LIST } from "../enum/lang";
import { LANGUAGE, API_BASE_URL } from "../enum/storage";
import { CHART_MESSAGE_TYPE, CHART_MESSAGE_STATUS } from "../enum/chat";
import { v4 as uuidv4 } from "uuid";

/* is cn environment */
export const isCnEnvironment = () => {
  const VITE_ENV = import.meta.env.VITE_ENV;
  return VITE_ENV?.includes("cn");
};

/**
 * A BCP-47 tag from the browser -> one of the codes we actually ship.
 *
 * `navigator.language` returns things like `ja-JP`, `zh-Hant-TW`, `en-GB`, and
 * this function used to return them unchanged. That was harmless only because
 * everything except an exact `zh-CN` fell back to English anyway. Now that
 * 繁體中文 and 日本語 exist, `ja-JP` falling back to English is a visible bug.
 *
 * The Chinese branch is the one with real content in it. Script matters more
 * than region: Hong Kong and Macau read Traditional, Singapore reads
 * Simplified, and an explicit `Hans`/`Hant` subtag outranks the region.
 */
const normalizeLanguage = (tag) => {
  if (!tag) return null;
  const lower = String(tag).toLowerCase();

  if (lower.startsWith("zh")) {
    if (lower.includes("hant")) return LANGUAGE_CODE.ZH_TW;
    if (lower.includes("hans")) return LANGUAGE_CODE.ZH_CN;
    return /-(tw|hk|mo)\b/.test(lower) ? LANGUAGE_CODE.ZH_TW : LANGUAGE_CODE.ZH_CN;
  }

  // Everything else matches on the primary subtag, so `ja-JP` finds `ja`.
  const primary = lower.split("-")[0];
  const hit = LANGUAGE_LIST.find(
    (lang) => lang.code.toLowerCase().split("-")[0] === primary,
  );
  return hit ? hit.code : null;
};

/* get language */
export const getLanguage = () => {
  const { searchParams } = new URL(window.location.href);
  const langFromQuery =
    searchParams.get("lang") || searchParams.get("language");
  // An explicit ?lang= is honoured loosely too — a link that says `zh-Hant` or
  // `ja-JP` means it, and rejecting it for not being spelled our way is not
  // helpful.
  const fromQuery = normalizeLanguage(langFromQuery);
  if (fromQuery) {
    return fromQuery;
  }
  // get language from localStorage — a code we wrote ourselves, so exact
  const language = localStorage.getItem(LANGUAGE);
  if (language && LANGUAGE_LIST.some((lang) => lang.code === language)) {
    return language;
  }
  // get language from browser
  const browserLanguage =
    navigator.language || navigator.userLanguage || navigator.languages?.[0];
  const fromBrowser = normalizeLanguage(browserLanguage);
  if (fromBrowser) {
    return fromBrowser;
  }
  // get env language
  if (isCnEnvironment()) {
    return LANGUAGE_CODE.ZH_CN;
  }
  return LANGUAGE_CODE.EN;
};

/* is Text File */
export const isTextFile = (file) => {
  const filename = file.name.toLowerCase();
  const fileExtension = filename.split(".").pop() || "";
  return fileExtension === "txt" || file.type === "text/plain";
};

/* get file type */
export const getMessageTypeFromFile = (file) => {
  if (file.file_type.includes("image")) {
    return FILE_TYPE.IMAGE;
  }
  if (file.file_type.includes("pdf")) {
    return FILE_TYPE.PDF;
  }
  return FILE_TYPE.FILE;
};

/* transform messages to thinking group */
const THINKING_GROUP_MESSAGE_TYPES = [
  CHART_MESSAGE_TYPE.REASONING,
  CHART_MESSAGE_TYPE.TOOL_CALL,
  CHART_MESSAGE_TYPE.TOOL_RESULT,
];

// Helper: Check if message type is a thinking type
const isThinkingType = (type) => THINKING_GROUP_MESSAGE_TYPES.includes(type);

// Helper: Ensure message has an id
const ensureMessageId = (message) => ({
  ...message,
  id: message.id || uuidv4(),
});

// Helper: Create a new thinking group
const createThinkingGroup = () => ({
  type: CHART_MESSAGE_TYPE.THINKING_GROUP,
  thinking_group_id: uuidv4(),
  content: [],
});

// Helper: find the group holding the call a tool_result belongs to. The call
// id is `tool_call.id` and `tool_result.tool_call_id` — LangChain's two names
// for the same thing.
const findMatchingGroupId = (thinkingGroups, toolCallId) => {
  const matchingGroup = thinkingGroups.findLast((group) =>
    group.content.some(
      (item) =>
        item.type === CHART_MESSAGE_TYPE.TOOL_CALL && item.id === toolCallId,
    ),
  );
  return matchingGroup?.thinking_group_id || null;
};

// Helper: Add message to thinking group (returns new group with updated content)
const addToThinkingGroup = (group, message) => ({
  ...group,
  content: [...group.content, message],
});

export const transformMessagesToThinkingGroup = (messages) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  const initialState = {
    result: [],
    currentGroupId: null,
    thinkingGroups: [],
  };

  const finalState = messages.reduce((state, message) => {
    const msg = ensureMessageId(message);

    // Non-thinking type: close current group and add message to result
    if (!isThinkingType(msg.type)) {
      return {
        ...state,
        result: [...state.result, msg],
        currentGroupId: null,
      };
    }

    // A tool_result: backfill it into the group holding its call
    if (msg.type === CHART_MESSAGE_TYPE.TOOL_RESULT && msg.tool_call_id) {
      const matchingGroupId = findMatchingGroupId(
        state.thinkingGroups,
        msg.tool_call_id,
      );
      if (matchingGroupId) {
        // Update the matching group's content using thinking_group_id
        const updatedGroups = state.thinkingGroups.map((g) =>
          g.thinking_group_id === matchingGroupId
            ? addToThinkingGroup(g, msg)
            : g,
        );
        // Also update in result array using thinking_group_id
        const updatedResult = state.result.map((item) =>
          item.thinking_group_id === matchingGroupId
            ? addToThinkingGroup(item, msg)
            : item,
        );
        return {
          ...state,
          result: updatedResult,
          thinkingGroups: updatedGroups,
        };
      }
    }

    // Thinking type: add to current group or create new one
    if (state.currentGroupId) {
      // Add to existing group using thinking_group_id
      const updatedResult = state.result.map((item) =>
        item.thinking_group_id === state.currentGroupId
          ? addToThinkingGroup(item, msg)
          : item,
      );
      const updatedGroups = state.thinkingGroups.map((g) =>
        g.thinking_group_id === state.currentGroupId
          ? addToThinkingGroup(g, msg)
          : g,
      );
      return {
        ...state,
        result: updatedResult,
        currentGroupId: state.currentGroupId,
        thinkingGroups: updatedGroups,
      };
    }

    // Create new thinking group
    const newGroup = { ...createThinkingGroup(), content: [msg] };
    return {
      result: [...state.result, newGroup],
      currentGroupId: newGroup.thinking_group_id,
      thinkingGroups: [...state.thinkingGroups, newGroup],
    };
  }, initialState);

  return finalState.result;
};

/* can send */
export const canSend = (question, file_list, vs_list) => {
  // Validate required parameters
  if (question == null) {
    throw new Error("canSend: question parameter is required");
  }
  if (file_list == null) {
    throw new Error("canSend: file_list parameter is required");
  }
  if (vs_list == null) {
    throw new Error("canSend: vs_list parameter is required");
  }

  // Business logic checks
  if (!Array.isArray(vs_list) || vs_list.length === 0) {
    return false;
  }
  if (file_list.length > 0) {
    return file_list.every((file) => file.status === FILE_STATUS.SUCCESS);
  }
  return question && question.trim() !== "";
};

/* sleep */
export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/* get api base url */
export const getApiBaseUrl = () => {
  // Priority: user setting in sessionStorage > env VITE_BASE_URL_MCP > empty string
  const userSetting = sessionStorage.getItem(API_BASE_URL);
  if (userSetting && userSetting.trim() !== "") {
    return userSetting.trim();
  }
  const envUrl = import.meta.env.VITE_BASE_URL_MCP;
  return envUrl || "";
};
