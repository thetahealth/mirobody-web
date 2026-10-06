// localstorage
export const ACCESS_TOKEN = "ACCESS_TOKEN";

export const USER_NAME = "USER_NAME";
export const USER_EMAIL = "USER_EMAIL";
export const USER_ID = "USER_ID";
export const CURRENT_QUERY_USER_ID = "CURRENT_QUERY_USER_ID";
export const CURRENT_QUERY_USER_NAME = "CURRENT_QUERY_USER_NAME";

export const LANGUAGE = "LANGUAGE";

// @deprecated - use SELECTED_MODELS_AGENTS instead
export const SELECTED_MODELS = "SELECTED_MODELS";
export const SELECTED_MODELS_CN = "SELECTED_MODELS_CN";

// @deprecated - use SELECTED_MODELS_AGENTS instead
export const SELECTED_AGENTS = "SELECTED_AGENTS";
export const SELECTED_AGENTS_CN = "SELECTED_AGENTS_CN";

// New unified storage for models/agents selection
export const SELECTED_MODELS_AGENTS = "SELECTED_MODELS_AGENTS";
export const SELECTED_MODELS_AGENTS_CN = "SELECTED_MODELS_AGENTS_CN";

export const SELECTED_PROMPT = "SELECTED_PROMPT";
export const SELECTED_PROMPT_CN = "SELECTED_PROMPT_CN";


export const SHOW_MCP_FEATURE_MODAL = "SHOW_MCP_FEATURE_MODAL";

export const SENTRY_FEEDBACK_POSITION = "SENTRY_FEEDBACK_POSITION";
export const WEBAUTHN_SKIPPED = "WEBAUTHN_SKIPPED";
export const SECURITY_SETTINGS = "SECURITY_SETTINGS";

// session storage
export const API_BASE_URL = "API_BASE_URL";
// The first-run page's token, read once from `/setup?token=…` and kept for the
// tab rather than left in the address bar (pages/Setup/setup.js).
export const SETUP_TOKEN = "SETUP_TOKEN";
// "Not now" on the first-run page: stop sending this tab back to it.
export const SETUP_SKIPPED = "SETUP_SKIPPED";
