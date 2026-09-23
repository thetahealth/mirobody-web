/**
 * The pure half of 记录 — everything that can be decided without React.
 *
 * It lives apart because the vitest config runs every `.test.js` under `src/`
 * in a node environment: a helper here is testable, the same logic inlined in
 * a component is not.
 *
 * Nothing here calls `new Date()` with no argument. Every function that needs
 * "now" or "today" takes it as an argument, so a test states the day it is
 * talking about instead of depending on the day it runs.
 */

/** `YYYY-MM-DD` for a Date, in the viewer's own timezone. */
export const isoDay = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * The window the feed asks for: `days` back from `today`, both ends inclusive.
 *
 * The backend defaults to 30 days and refuses more than 400, so a caller that
 * wants "everything" still has to name a number.
 */
export const rangeFor = (today, days = 30) => {
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDay(from), to: isoDay(today) };
};

/**
 * `days[]` out of the response, defensively.
 *
 * The envelope is unwrapped by the request instance, so this receives the
 * `data` object — but an error path can resolve to `undefined`, and a day with
 * no entries is not worth a card.
 *
 * Entries are filtered individually, not just counted: the feed keys rows on
 * `entry.id`, so one null in the array takes the whole panel down rather than
 * one row.
 */
export const readDays = (data) => {
  const days = data && Array.isArray(data.days) ? data.days : [];
  return days
    .filter((d) => d && d.date && Array.isArray(d.entries))
    .map((d) => ({ date: d.date, entries: d.entries.filter((e) => e && e.id != null) }))
    .filter((d) => d.entries.length);
};

/**
 * What the classification calls this entry, or "" when it could not say.
 *
 * Deliberately not "the display name, falling back to what the person wrote":
 * the list shows BOTH names, and a fallback would quietly turn an abstention
 * into a coded-looking row.
 */
export const standardName = (entry) => (entry && entry.coded ? entry.display || "" : "");

/** `{total, coded}` over a day list — the one number the header states. */
export const countEntries = (days) => {
  const entries = days.flatMap((d) => d.entries);
  return { total: entries.length, coded: entries.filter((e) => e.coded).length };
};

/**
 * The weekday for a `YYYY-MM-DD`, short, in the reader's language.
 *
 * Built from the parts rather than `new Date(dayIso)`: that parses a bare
 * date string as UTC midnight, which is the previous day for anyone west of
 * Greenwich, so the card would be labelled with the wrong weekday.
 */
export const weekdayOf = (dayIso, locale) => {
  const [y, m, d] = String(dayIso).split("-").map(Number);
  if (!y || !m || !d) return "";
  try {
    return new Date(y, m - 1, d).toLocaleDateString(locale || undefined, { weekday: "short" });
  } catch {
    return "";
  }
};

/**
 * Which heading a day gets: a token the component translates, never a
 * localized string. Returns "today", "yesterday" or "" (use the date itself).
 */
export const dayToken = (dayIso, today) => {
  if (dayIso === isoDay(today)) return "today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return dayIso === isoDay(yesterday) ? "yesterday" : "";
};

/** `HH:mm` from an entry's `at`, or "" when it carries none. */
export const timeOf = (entry) => {
  if (!entry || !entry.at) return "";
  const when = new Date(entry.at);
  if (Number.isNaN(when.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(when.getHours())}:${pad(when.getMinutes())}`;
};

/**
 * `<input type="datetime-local">` speaks local wall-clock with no offset, and
 * the backend stores an instant. Converting here rather than posting the bare
 * string is the difference between "14:30" meaning the person's 14:30 and
 * meaning 14:30 UTC.
 */
export const isoFromLocalInput = (value) => {
  if (!value) return "";
  const when = new Date(value);
  return Number.isNaN(when.getTime()) ? "" : when.toISOString();
};

/** The reverse, for prefilling the field with "now". */
export const localInputFromDate = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${isoDay(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Which sentence an abstention deserves.
 *
 * The three the vocabulary actually returns mean different things to the
 * person who typed the words, and collapsing them into one "not recognized"
 * throws away the only actionable one: `ambiguous` says the word names more
 * than one standard term, which a more specific word fixes. `no-match` says
 * there is nothing to be more specific about.
 *
 * Reasons are namespaced strings (`icpc3:ambiguous`) and the set can grow, so
 * an unknown one falls back to the generic line rather than rendering a key.
 */
export const reasonKey = (reason) => {
  const known = ["ambiguous", "no_match", "too_broad"];
  const tail = String(reason || "").split(":")[1] || "";
  const slug = tail.replace(/-/g, "_");
  return known.includes(slug) ? `journal_reason_${slug}` : "journal_not_coded_hint";
};

/**
 * The two ICPC-3 axes the endpoint writes on, in the order they are offered.
 *
 * `symptom` is what a person feels now and resolves on the S component;
 * `condition` is what they have been diagnosed with and resolves on D. They
 * are not interchangeable: 头痛 is a symptom and 高血压 is a diagnosis, and
 * coding one as the other files it under the wrong axis for good.
 */
export const KINDS = ["symptom", "condition"];

/**
 * The copy key for an entry's kind, guarded.
 *
 * The server owns this enum and can grow it. An unknown value must not render
 * as its own key name in the feed, so it falls back to the raw string, which
 * at least says something true.
 */
export const kindKey = (kind) =>
  KINDS.includes(kind) ? `journal_kind_${kind}` : "";

/** What the backend accepts, so the composer can stop a doomed submit itself. */
export const TEXT_MAX = 200;
export const NOTE_MAX = 2000;

/**
 * Whether this entry may be submitted, and why not.
 *
 * Returns "" when it may. The reasons are tokens, translated by the caller.
 */
export const submitBlocker = ({ text, note }) => {
  const body = (text || "").trim();
  if (!body) return "empty";
  if (body.length > TEXT_MAX) return "too_long";
  if ((note || "").length > NOTE_MAX) return "note_too_long";
  return "";
};
