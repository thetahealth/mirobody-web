// The citation markup an answer carries, turned into markdown links the
// renderer draws as source chips. The format is mirobody's
// `kernel/citations.py`: a claim in <statement>, its evidence in a closing
// <cite>[r3][r9]</cite>. A cite is a row a tool showed in this conversation
// (`r3`), a reference passage (`ref:source:id`) or lines of a document
// (`/library/x.pdf#L12-L14`).

export const CITE_SCHEME = "cite:";

const STATEMENT_OPEN = "<statement>";
const STATEMENT_CLOSE = "</statement>";
const CITE_OPEN = "<cite>";
const CITE_CLOSE = "</cite>";
const TAGS = [STATEMENT_OPEN, STATEMENT_CLOSE, CITE_OPEN, CITE_CLOSE];

const ROW_ID = /^r[1-9]\d*$/;
const REF_ID = /^ref:[a-z0-9_]+:[^\s\]]+$/;
const LINES_ID = /^(\S.*?)#L(\d+)(?:-L?(\d+))?$/;

export function citeKind(id) {
  if (ROW_ID.test(id)) return "row";
  if (REF_ID.test(id)) return "ref";
  if (LINES_ID.test(id)) return "lines";
  return "unknown";
}

export function linesOf(id) {
  const m = LINES_ID.exec(id);
  if (!m) return null;
  const start = Number(m[2]);
  return { path: m[1], start, end: m[3] ? Number(m[3]) : start };
}

// While an answer streams, its last characters can be half a tag ("<sta",
// "<cite>[r1"). Those are held back until they complete, so the reader never
// sees markup flash by.
function pendingTail(text) {
  const lt = text.lastIndexOf("<");
  if (lt === -1) return text.length;
  const tail = text.slice(lt);
  if (tail.startsWith(CITE_OPEN) && !tail.includes(CITE_CLOSE)) return lt;
  if (TAGS.some((tag) => tail.length < tag.length && tag.startsWith(tail))) return lt;
  return text.length;
}

const escapeLabel = (s) => s.replace(/[[\]\\]/g, (c) => `\\${c}`);

// The answer as markdown: statement tags dropped, each cite a link
// `[n](cite:<id>)`. `n` numbers the distinct sources of this answer in the
// order they first appear, the way a paper numbers its references.
export function citationsToMarkdown(text) {
  if (typeof text !== "string" || !text.includes("<")) return text || "";
  const shown = text.slice(0, pendingTail(text));
  const order = new Map();
  let out = "";
  let pos = 0;
  while (pos < shown.length) {
    const lt = shown.indexOf("<", pos);
    if (lt === -1) {
      out += shown.slice(pos);
      break;
    }
    out += shown.slice(pos, lt);
    if (shown.startsWith(STATEMENT_OPEN, lt)) {
      pos = lt + STATEMENT_OPEN.length;
    } else if (shown.startsWith(STATEMENT_CLOSE, lt)) {
      pos = lt + STATEMENT_CLOSE.length;
    } else if (shown.startsWith(CITE_OPEN, lt)) {
      const close = shown.indexOf(CITE_CLOSE, lt);
      const body = shown.slice(lt + CITE_OPEN.length, close === -1 ? shown.length : close);
      const ids = [...body.matchAll(/\[([^[\]]+)\]/g)].map((m) => m[1].trim()).filter(Boolean);
      out += ids
        .map((id) => {
          if (!order.has(id)) order.set(id, order.size + 1);
          return `[${escapeLabel(String(order.get(id)))}](${CITE_SCHEME}${encodeURIComponent(id)})`;
        })
        .join("");
      pos = close === -1 ? shown.length : close + CITE_CLOSE.length;
    } else {
      out += "<";
      pos = lt + 1;
    }
  }
  return out;
}

// The text an answer reads as without its markup (copying, previews).
export function stripCitations(text) {
  if (typeof text !== "string") return "";
  return text.replace(/<\/?statement>|<cite>[\s\S]*?<\/cite>/g, "");
}

export function citeIdFromHref(href) {
  if (typeof href !== "string" || !href.startsWith(CITE_SCHEME)) return null;
  try {
    return decodeURIComponent(href.slice(CITE_SCHEME.length));
  } catch {
    return null;
  }
}
