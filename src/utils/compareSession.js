// cdm codec for multi-model compare sessions.
//
// A compare conversation is ONE frontend-generated group. Each pane (model)
// gets its own backend session_id encoding the group + pane index, so the
// backend isolates each model's context by session_id. The group key is the
// frontend-only chartData/routing key; pane ids are only sent to the backend.
//
//   group key (chartData key / URL)  : cmp_<groupUuid>
//   pane session_id (sent to backend): cmp_<groupUuid>_<paneIndex>
//
// uuid v4 contains hyphens but never underscores, so the trailing `_<digits>`
// pane suffix is unambiguous. The `cmp_` prefix avoids colliding with plain
// backend uuids and with the `temp_` pending-key prefix.

export const COMPARE_PREFIX = "cmp_";

// The `cmp_` prefix and trailing `_<digits>` pane suffix are the real
// discriminators; the group token itself is an opaque id we generate (a uuid
// today), so the middle charset only needs to exclude `_`.
const PANE_RE = /^cmp_[0-9a-zA-Z-]+_\d+$/;
const GROUP_RE = /^cmp_[0-9a-zA-Z-]+$/;

/** Build the backend session_id for one pane. */
export const encodePaneSessionId = (groupUuid, paneIndex) =>
  `${COMPARE_PREFIX}${groupUuid}_${paneIndex}`;

/** Build the group key (chartData key / URL) from a raw uuid. */
export const encodeGroupKey = (groupUuid) => `${COMPARE_PREFIX}${groupUuid}`;

/** True only for `cmp_<uuid>_<idx>` pane ids. */
export const isPaneSessionId = (id) =>
  typeof id === "string" && PANE_RE.test(id);

/** True only for `cmp_<uuid>` group keys (no trailing pane index). */
export const isCompareGroupKey = (id) =>
  typeof id === "string" && GROUP_RE.test(id);

/** Pane id -> its group key. Non-pane ids are returned unchanged. */
export const decodeGroupKey = (id) =>
  isPaneSessionId(id) ? id.replace(/_\d+$/, "") : id;

/** Pane id -> its numeric pane index, or null if not a pane id. */
export const paneIndexOf = (id) => {
  if (!isPaneSessionId(id)) return null;
  return Number(id.match(/_(\d+)$/)[1]);
};

/**
 * Collapse sibling compare sessions into one list item per group.
 * Non-compare rows pass through unchanged. Order = first appearance.
 * The folded item's session_id is the group key; summary is the first
 * non-empty summary seen among siblings.
 * @param {Array<{session_id:string, summary?:string}>} summaries
 * @returns {Array}
 */
export const foldSiblingSummaries = (summaries) => {
  if (!Array.isArray(summaries)) return [];
  const byKey = new Map();
  for (const row of summaries) {
    const key = decodeGroupKey(row.session_id);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...row, session_id: key });
    } else if (!existing.summary && row.summary) {
      existing.summary = row.summary;
    }
  }
  return [...byKey.values()];
};

/**
 * Split one pane's flat history into [{ user, assistant }] turns.
 * A turn is a user item optionally followed by its assistant item.
 */
const splitTurns = (history) => {
  const turns = [];
  let current = null;
  for (const item of history || []) {
    if (item.role === "user") {
      if (current) turns.push(current);
      current = { user: item, assistant: null };
    } else if (item.role === "assistant") {
      if (!current) current = { user: null, assistant: null };
      current.assistant = item;
    }
  }
  if (current) turns.push(current);
  return turns;
};

/**
 * Zip N panes' per-session histories into one multi-column history aligned
 * by turn index. The user item is taken from the first pane that has one;
 * the assistant item merges every pane's `datasource` for that turn.
 * @param {Array<{paneIndex:number, history:Array}>} paneHistories
 * @returns {Array} merged history list
 */
export const zipPaneHistories = (paneHistories) => {
  const ordered = [...(paneHistories || [])].sort(
    (a, b) => a.paneIndex - b.paneIndex,
  );
  const perPaneTurns = ordered.map((p) => splitTurns(p.history));
  const turnCount = perPaneTurns.reduce((max, t) => Math.max(max, t.length), 0);

  const merged = [];
  for (let k = 0; k < turnCount; k++) {
    const userItem = perPaneTurns.map((t) => t[k]?.user).find(Boolean);
    if (userItem) merged.push(userItem);

    const datasource = [];
    for (const turns of perPaneTurns) {
      const a = turns[k]?.assistant;
      if (a?.datasource) datasource.push(...a.datasource);
    }
    const assistantTemplate = perPaneTurns
      .map((t) => t[k]?.assistant)
      .find(Boolean);
    if (assistantTemplate) {
      merged.push({ ...assistantTemplate, datasource });
    }
  }
  return merged;
};
