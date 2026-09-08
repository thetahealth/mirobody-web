import { mcpRequestInstance } from "../service/request";

// Personal MCP URL — POST /personal/mcp mints (or reuses) the caller's
// URL-embedded secret and returns {url}. This file was lost in a refactor
// while SettingModal kept calling api.getPersonMcp, so opening Settings threw
// "api.getPersonMcp is not a function" and the router error page replaced the
// whole app. Only this function is restored: the other members of the old
// mcp.js (/api/user/mcp list/set/delete) had no callers and no backend routes.
export const getPersonMcp = (signal) => {
  return mcpRequestInstance.post("/personal/mcp", {}, { signal });
};
