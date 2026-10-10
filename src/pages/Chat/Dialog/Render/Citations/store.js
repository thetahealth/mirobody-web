import { create } from "zustand";
import { resolveCitations } from "../../../../../api/chat";

// What each cited row stands for, per conversation. Chips ask for their rid;
// the asks of one render are sent as one request a moment later.
const FLUSH_MS = 40;
const pending = new Map(); // session -> Set of rids
let timer = null;

export const useCitationStore = create((set, get) => ({
  resolved: {}, // session -> { rid: row | { status } }

  request(sessionId, rid) {
    if (!sessionId || !rid) return;
    const known = get().resolved[sessionId] || {};
    if (rid in known) return;
    if (!pending.has(sessionId)) pending.set(sessionId, new Set());
    pending.get(sessionId).add(rid);
    if (!timer) timer = setTimeout(() => get().flush(), FLUSH_MS);
  },

  async flush() {
    timer = null;
    const batches = [...pending.entries()];
    pending.clear();
    await Promise.all(
      batches.map(async ([sessionId, rids]) => {
        const asked = [...rids];
        let rows = [];
        try {
          rows = (await resolveCitations({ session_id: sessionId, rids: asked })) || [];
        } catch {
          rows = asked.map((rid) => ({ rid, status: "unavailable" }));
        }
        set((state) => {
          const current = { ...(state.resolved[sessionId] || {}) };
          for (const row of rows) current[row.rid] = row;
          for (const rid of asked) if (!(rid in current)) current[rid] = { rid, status: "unknown" };
          return { resolved: { ...state.resolved, [sessionId]: current } };
        });
      }),
    );
  },
}));
