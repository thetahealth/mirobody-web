import { mcpRequestInstance } from "../service/request";

// Personal MCP links, `{origin}/mcp/<secret>`. The server keeps only a hash of
// the secret, so the URL exists in exactly one response: the POST that made
// it. Listing never returns it, and POST replaces the caller's live link for
// that record, so the Settings page lists on open and posts only when the
// person asks.

// `{made, holders}`: the links the caller made (their own among them, marked
// `own`), and the ones someone else made that read the caller's record.
export const listPersonalMcp = (signal) => {
  return mcpRequestInstance.get("/personal/mcp", { signal });
};

// A new link for the caller's own record, or, given a member's id, for that
// member's: the server lets it through only when the care circle lets the
// caller read that record (403 otherwise). The caller's previous link for the
// same record stops working.
export const createPersonalMcp = (memberId, signal) => {
  const body = memberId ? { user_id: String(memberId) } : {};
  return mcpRequestInstance.post("/personal/mcp", body, { signal });
};

// Revoke one link: one the caller made, or one reading the caller's record.
export const revokePersonalMcp = (id, signal) => {
  return mcpRequestInstance.delete(`/personal/mcp/${encodeURIComponent(id)}`, { signal });
};
