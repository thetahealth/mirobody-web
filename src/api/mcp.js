import { mcpRequestInstance } from "../service/request";

// Personal MCP links, `{origin}/mcp/<secret>`. The server keeps only a hash of
// the secret, so the URL exists in exactly one response: the POST that made
// it. Listing never returns it, and POST replaces the caller's live link, so
// the Settings page lists on open and posts only when the person asks.

// `{made, holders}`: the links the caller made (their own among them, marked
// `own`), and the ones someone else made that read the caller's record.
export const listPersonalMcp = (signal) => {
  return mcpRequestInstance.get("/personal/mcp", { signal });
};

// A new link for the caller's own record; the old one stops working.
export const createPersonalMcp = (signal) => {
  return mcpRequestInstance.post("/personal/mcp", {}, { signal });
};

// Revoke one link: one the caller made, or one reading the caller's record.
export const revokePersonalMcp = (id, signal) => {
  return mcpRequestInstance.delete(`/personal/mcp/${encodeURIComponent(id)}`, { signal });
};
