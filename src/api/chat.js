import { mcpRequestInstance } from "../service/request";
import { sseRequestInstance } from "../service/sse";

// chat history
export const chatHistory = ({ signal }) => {
  return mcpRequestInstance.get("/api/history", {
    signal,
  });
};

// chat history by session_id
export const chatHistoryBySessionId = ({ session_id }) => {
  return mcpRequestInstance.get("/api/history", {
    params: {
      session_id,
    },
  });
};

// start chat SSE

export const startChatSSE = ({ payload, onmessage, onerror, onclose }) => {
  return sseRequestInstance("/api/chat", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    onmessage,
    onerror,
    onclose,
  });
};

// new chat session /api/session
// session_id is optional: when supplied (compare panes use a cdm-encoded id),
// the backend persists that exact id; when omitted it mints a uuid (single-model).
export const newChatSession = ({ query_user_id, session_id }) => {
  const body = { query_user_id };
  if (session_id) body.session_id = session_id;
  return mcpRequestInstance.post("/api/session", body);
};


// /api/history_by_person
export const historyByPerson = ({ user_id, user_name, signal }) => {
  return mcpRequestInstance.get("/api/history_by_person", {
    params: {
      user_id,
      user_name,
    },
    signal,
  });
};

/* create share */
export const createShare = ({ session_id }) => {
  return mcpRequestInstance.post("/api/share/create", {
    session_id,
  });
};

/* get share content */
export const getShareContent = ({ share_session_id }) => {
  return mcpRequestInstance.get(`/api/share/${share_session_id}`);
};

/* delete history */
export const deleteHistory = ({ session_id }) => {
  return mcpRequestInstance.post(`/api/history/delete`, {
    session_id,
  });
};

// prompt /api/prompts — the only prompt endpoint left.
//
// `/api/agents`, `/api/providers` and `/api/user/prompt{,/set,/delete}` were
// removed by Mirobody 1.4.0: one agent, and nothing in this client ever wrote
// a per-user prompt. Their bindings lived on here, defined and never called,
// which is why nothing broke and why nobody noticed.
export const getPrompts = ({ signal }) => {
  return mcpRequestInstance.get("/api/prompts", {
    signal,
  });
};

// get /api/models — with `labels=1` each entry is `{name, model}` rather than a
// bare name, so the picker can show "qwen3.8-27b" where it showed "local"
// (utils/modelLabels.js).
export const getModels = ({ signal }) => {
  return mcpRequestInstance.get("/api/models", {
    params: { labels: 1 },
    signal,
  });
};
