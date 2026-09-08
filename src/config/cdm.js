// Optional link-out to a separate developer / API-platform app: the Settings
// card and the /developer route exist only once its URL is configured (it used
// to fall back to a hardcoded vendor host, which shipped that host in every
// build). Gates `isShowDeveloper` in store/system.js.
export const CDM_URL = (import.meta.env.VITE_CDM_URL || "").replace(/\/+$/, "");

export const IS_CDM_ENABLED = CDM_URL !== "";
