/**
 * "Added since your last visit": the browser's cursor, and the count's chips.
 *
 * The cursor is the browser's own (the server keeps no "last visit" for
 * anyone), one per person viewed, so looking at a family member's record does
 * not use up what is new on your own.
 */

export const cursorKey = (userId) => `mirobody:last-data-visit:${userId || "self"}`;

/**
 * The previous visit's instant, and a function that records this visit.
 * `storage` is injected for the tests; it defaults to localStorage, and a
 * browser that refuses storage (private mode) simply never shows the block.
 */
export const visitCursor = (userId, storage = globalThis.localStorage, now = () => new Date()) => {
  let since = null;
  try {
    since = storage?.getItem(cursorKey(userId)) || null;
  } catch {
    since = null;
  }
  const record = () => {
    try {
      storage?.setItem(cursorKey(userId), now().toISOString());
    } catch {
      // Storage refused: the next visit has no cursor and shows nothing.
    }
  };
  return { since, record };
};

/** The order sources are shown in: what the person did first, then machines. */
export const SOURCE_ORDER = ["file", "manual", "device", "api"];

/** `by_source` buckets as chips, in a stable order, empty ones dropped. */
export const sourceChips = (bySource = []) =>
  [...bySource]
    .filter((b) => Number(b?.count) > 0)
    .sort((a, b) => {
      const ia = SOURCE_ORDER.indexOf(a.name);
      const ib = SOURCE_ORDER.indexOf(b.name);
      return (ia < 0 ? SOURCE_ORDER.length : ia) - (ib < 0 ? SOURCE_ORDER.length : ib);
    })
    .map((b) => ({ name: b.name, count: Number(b.count) }));

/** The i18n key naming a source; an unknown one falls back to its own name. */
export const sourceLabelKey = (name) =>
  SOURCE_ORDER.includes(name) ? `source_kind_${name}` : null;
