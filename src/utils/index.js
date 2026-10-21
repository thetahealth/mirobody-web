import { FILE_TYPE, FILE_STATUS } from "../enum/file";
import { LANGUAGE_CODE, LANGUAGE_LIST } from "../enum/lang";
import { LANGUAGE, API_BASE_URL } from "../enum/storage";
import { CHART_MESSAGE_TYPE } from "../enum/chat";

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

/* Group work without letting invisible usage receipts end the thinking UI. */
const THINKING_GROUP_MESSAGE_TYPES = new Set([
  CHART_MESSAGE_TYPE.REASONING, CHART_MESSAGE_TYPE.TOOL_CALL,
  CHART_MESSAGE_TYPE.TOOL_RESULT, CHART_MESSAGE_TYPE.CONTEXT,
]);

export const transformMessagesToThinkingGroup = (messages) => {
  if (!Array.isArray(messages)) return [];
  const result = [];
  const calls = new Map();
  const contexts = new Map();
  let current = null;
  messages.forEach((message, index) => {
    const msg = { ...message, id: message.id || `${message.type}-${index}` };
    if (msg.type === CHART_MESSAGE_TYPE.USAGE) {
      result.push(msg);
      return;
    }
    if ([CHART_MESSAGE_TYPE.TEXT, CHART_MESSAGE_TYPE.REASONING].includes(msg.type) &&
        !String(msg.text ?? msg.reasoning ?? "").trim()) return;
    if (!THINKING_GROUP_MESSAGE_TYPES.has(msg.type)) {
      if (current) current.endedAt = msg.at;
      current = null;
      result.push(msg);
      return;
    }
    const matched = msg.type === CHART_MESSAGE_TYPE.TOOL_RESULT ? calls.get(msg.tool_call_id)
      : msg.type === CHART_MESSAGE_TYPE.CONTEXT ? contexts.get(msg.id) : null;
    if (matched) {
      matched.content.push(msg);
      return;
    }
    if (!current) {
      current = { type: CHART_MESSAGE_TYPE.THINKING_GROUP, id: `work-${msg.id}`, content: [] };
      result.push(current);
    }
    current.content.push(msg);
    if (msg.type === CHART_MESSAGE_TYPE.TOOL_CALL) calls.set(msg.id, current);
    if (msg.type === CHART_MESSAGE_TYPE.CONTEXT) contexts.set(msg.id, current);
  });
  return result;
};

export const markActiveGroup = (grouped, streaming) => {
  if (!streaming) return grouped;
  const last = grouped.findLast((item) => item.type !== CHART_MESSAGE_TYPE.USAGE);
  if (last?.type !== CHART_MESSAGE_TYPE.THINKING_GROUP) return grouped;
  return grouped.map((item) => item === last ? { ...item, active: true } : item);
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
