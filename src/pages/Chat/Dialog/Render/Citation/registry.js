/**
 * The session's citation registry: rid → row and ref → passage, parsed out
 * of every `tool_result` block the session carries, with no backend round
 * trip. The wire already ships the full tables (wire/stream.py passes the
 * tool's content through verbatim), and history replays the same blocks, so
 * one builder serves live streaming and /api/history alike.
 *
 * Scope is the whole session, not one answer: the backend's RidTable keys on
 * the record being read, so a row cited last turn keeps its rid this turn —
 * and across compare panes, which share the record behind one backend (the
 * two panes' tables merge without collision for the same reason).
 *
 * Values are PLAIN OBJECTS keyed by rid/ref, not Maps: the live chat path
 * holds its registry inside immer (store/Chart/data.js) and immer drafts do
 * not take Map assignment.
 */

import { createContext, useContext } from "react";
import { parseToolResultTables } from "./parse";

export const EMPTY_CITE_REGISTRY = { rids: {}, refs: {} };

// Parsed-table cache keyed by the content string itself. Tool results are
// emitted once (the `updates` stream sends a completed result, never deltas),
// so one parse per distinct block is the whole cost; re-renders and history
// transforms hit the cache. Bounded like the backend's RidTable: a drop costs
// one re-parse, never a wrong answer.
const PARSE_CACHE_LIMIT = 256;
const parseCache = new Map();

function parseContentCached(content) {
  let parsed = parseCache.get(content);
  if (parsed) return parsed;
  parsed = parseToolResultTables(content);
  if (parseCache.size >= PARSE_CACHE_LIMIT) parseCache.clear();
  parseCache.set(content, parsed);
  return parsed;
}

/**
 * Fold one block's tables into `registry` (mutates, for immer drafts).
 * First-wins on a repeat rid: the same row keeps one rid across calls (mint
 * is keyed by what the row IS), so repeats agree and either copy is right.
 */
export function mergeCiteBlock(registry, block) {
  if (block?.type !== "tool_result" || typeof block.content !== "string") return;
  const parsed = parseContentCached(block.content);
  for (const [k, v] of parsed.rids) {
    if (!(k in registry.rids)) registry.rids[k] = v;
  }
  for (const [k, v] of parsed.refs) {
    if (!(k in registry.refs)) registry.refs[k] = v;
  }
}

/** All of a session's message arrays → one registry. */
export function buildCiteRegistry(messageLists) {
  const registry = { rids: {}, refs: {} };
  for (const messages of messageLists || []) {
    if (!Array.isArray(messages)) continue;
    for (const block of messages) mergeCiteBlock(registry, block);
  }
  return registry;
}

const CiteRegistryContext = createContext(EMPTY_CITE_REGISTRY);

/** Backing context for CiteRegistryProvider (its own file — the fast-refresh
 * rule keeps component exports and helpers apart). */
export { CiteRegistryContext };

export function useCiteRegistry() {
  return useContext(CiteRegistryContext);
}

// ---------------------------------------------------------------------------
// file name → file_key, for [file#Lx-Ly] click-through
// ---------------------------------------------------------------------------

// The pipe table hides file_key from the model on purpose (the model gets the
// human `file` name; `_render.py` keeps key columns out of its view), so
// opening the cited file means one lazy call to the Drive page's existing
// uploaded-files list, cached per try. Resolution failure degrades the chip
// to tooltip-only — it never blocks render.
let fileListCache = null; // Promise<Map<name, file_key>> | null

async function loadFileKeys() {
  // Lazy, dynamic: a static import would drag the api→store graph (which
  // touches localStorage at module scope) into a module the parser tests
  // import as a pure helper. The click path already round-trips, so the
  // module split costs nothing at runtime.
  const { default: api } = await import("../../../../../api");
  const map = new Map();
  let offset = 0;
  const limit = 500;
  // Unbounded lists page until the first short page; a record's attachments
  // are tens, not thousands.
  for (;;) {
    const { files = [], total = 0 } = await api.getUploadedFiles({ limit, offset });
    for (const f of files) {
      if (f?.file_name && f?.file_key) map.set(normalizeName(f.file_name), f.file_key);
    }
    offset += files.length;
    if (!files.length || files.length < limit || offset >= total) break;
  }
  return map;
}

function normalizeName(name) {
  return String(name || "")
    .replace(/^\/?(library|uploads)\//, "")
    .trim()
    .toLocaleLowerCase();
}

/** The cited file's key, or "" when it cannot be resolved. Never rejects. */
export async function resolveFileKey(citedName) {
  try {
    if (!fileListCache) fileListCache = loadFileKeys();
    const map = await fileListCache;
    return map.get(normalizeName(citedName)) || "";
  } catch {
    fileListCache = null; // a failed list retries on the next click
    return "";
  }
}
