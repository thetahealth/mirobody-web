/**
 * The citation contract, client side. Mirrors:
 * - `<statement>…<cite>[a][b]</cite></statement>` — the model's answer markup
 *   (process/judge/format.py; the prompt change itself lands on the backend
 *   separately — until then these functions simply never match).
 * - cite token shapes — process/judge/citations.py::_classify:
 *   `r\d+` (a readings/stats row), `ref:…` (medref passage),
 *   `<name>#L<x>(-L<y>)?` (a document line range).
 * - the `tool_result` pipe table — mirobody/kernel/query.py::compact:
 *   `(constants: k=v, …)`, a `|`-joined header, then data rows with
 *   `\`→`\\`, `|`→`\|`, newline→`\n` cell escaping. `rid` is always the
 *   first column (agent/tools/_render.py).
 *
 * Everything here is pure: no imports, no IO — this is what vitest covers.
 */

const OPEN_STMT = "<statement>";
const CLOSE_STMT = "</statement>";
const OPEN_CITE = "<cite>";
const CLOSE_CITE = "</cite>";
const ALL_TAGS = [OPEN_STMT, CLOSE_STMT, OPEN_CITE, CLOSE_CITE];

/** Segment shapes: {kind:"text", text} | {kind:"cites", tokens:[raw,…]}. */
export function parseCitedText(text) {
  const out = [];
  if (typeof text !== "string" || !text) return out;
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) {
      out.push({ kind: "text", text: buf });
      buf = "";
    }
  };
  let stmtDepth = 0;
  while (i < text.length) {
    const at = text.indexOf("<", i);
    if (at === -1) {
      buf += text.slice(i);
      break;
    }
    buf += text.slice(i, at);
    if (text.startsWith(OPEN_STMT, at)) {
      stmtDepth++;
      i = at + OPEN_STMT.length;
      continue;
    }
    if (text.startsWith(CLOSE_STMT, at) && stmtDepth > 0) {
      stmtDepth--;
      i = at + CLOSE_STMT.length;
      continue;
    }
    // No CLOSE_CITE branch: a complete stray `</cite>` (or `</statement>`
    // with no opener) is malformed input, not markup — it stays visible,
    // same standard as an unresolvable cite: shown, never silently cleaned.
    if (text.startsWith(OPEN_CITE, at)) {
      const close = text.indexOf(CLOSE_CITE, at + OPEN_CITE.length);
      if (close === -1) {
        // Still streaming: the cite's tokens have not arrived yet, so nothing
        // becomes a chip — but the text already inside the tag is real answer
        // text and must render. The raw `<cite` itself never flashes on
        // screen, and neither does a half-streamed `</cite` at the tail.
        const inner = text.slice(at + OPEN_CITE.length);
        const lastLt = inner.lastIndexOf("<");
        const tail = lastLt === -1 ? "" : inner.slice(lastLt);
        const partialTag = tail && ALL_TAGS.some((tag) => tail.length < tag.length && tag.startsWith(tail));
        buf += partialTag ? inner.slice(0, lastLt) : inner;
        i = text.length;
        break;
      }
      flush();
      const inner = text.slice(at + OPEN_CITE.length, close);
      const tokens = [];
      for (const m of inner.matchAll(/\[([^\][]+)\]/g)) {
        const tok = m[1].trim();
        if (tok) tokens.push(tok);
      }
      // An empty <cite></cite> carries no citation: the whole tag goes, which
      // is also what longcite's clean_answer does at data build time.
      if (tokens.length) out.push({ kind: "cites", tokens });
      i = close + CLOSE_CITE.length;
      continue;
    }
    // A trailing partial tag ("<state", "</ci") is markup still streaming in:
    // leave it out entirely. Text before it is already rendered, so when the
    // rest arrives the reader sees chips attach, never raw angle brackets.
    // STRICTLY partial: a tail that already IS a complete (stray) tag renders
    // raw — malformed is visible, unfinished is not.
    const tail = text.slice(at);
    if (ALL_TAGS.some((tag) => tail.length < tag.length && tag.startsWith(tail))) break;
    // A literal '<' (math, "<3.4"): keep it verbatim.
    buf += "<";
    i = at + 1;
  }
  flush();
  return out;
}

const RID_RE = /^r\d+$/;
const FILE_RE = /^(.+?)#L(\d+)(?:-L?(\d+))?$/;

/**
 * One bracket group's shape. Same regexes as the judge's `_classify`, because
 * a chip and a score must agree on what a token IS.
 */
export function classifyCiteToken(raw) {
  const ref = String(raw ?? "").trim();
  if (RID_RE.test(ref)) return { kind: "rid", rid: ref, raw: ref };
  if (ref.startsWith("ref:")) return { kind: "ref", ref, raw: ref };
  const m = FILE_RE.exec(ref);
  if (m) {
    return {
      kind: "file",
      file: m[1],
      lineStart: Number(m[2]),
      lineEnd: m[3] ? Number(m[3]) : Number(m[2]),
      raw: ref,
    };
  }
  return { kind: "unknown", raw: ref };
}

// medref source short names, from mirobody/agent/medref.py::_SOURCE_LABEL.
const REF_SOURCE_SHORT = {
  medlineplus: "MedlinePlus",
  openfda: "FDA label",
};

export const refSourceShort = (ref) => {
  const source = String(ref || "").split(":")[1] || "";
  return REF_SOURCE_SHORT[source] || source || "ref";
};

// ---------------------------------------------------------------------------
// tool_result pipe tables (mirrors kernel/query.py::compact)
// ---------------------------------------------------------------------------

/** Reverse compact's cell escaping: iterate so `\\|` never feeds `\\\\`. */
function unescapeCell(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "n") {
        out += "\n";
      } else if (next === "|") {
        out += "|";
      } else if (next === "\\") {
        out += "\\";
      } else {
        out += s[i] + next;
      }
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
}

/** Split one table line on unescaped pipes. */
function splitRow(line) {
  const cells = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\" && i + 1 < line.length) {
      cur += line[i] + line[i + 1];
      i++;
    } else if (line[i] === "|") {
      cells.push(cur);
      cur = "";
    } else {
      cur += line[i];
    }
  }
  cells.push(cur);
  return cells;
}

const CONSTANTS_PREFIX = "(constants:";

/**
 * The `(constants: k=v, k=v)` line. compact joins with ", ", so a value that
 * itself contains ", " merges back onto the previous key.
 */
function parseConstants(line) {
  let body = line.trim().slice(CONSTANTS_PREFIX.length).trim();
  if (body.endsWith(")")) body = body.slice(0, -1);
  const out = {};
  let lastKey = null;
  for (const part of body.split(", ")) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      lastKey = unescapeCell(part.slice(0, eq).trim());
      out[lastKey] = unescapeCell(part.slice(eq + 1).trim());
    } else if (lastKey) {
      out[lastKey] += ", " + unescapeCell(part.trim());
    }
  }
  return out;
}

// medref's result lines: `[ref:s:i] SOURCE · title › section (lang)` followed
// by indented snippet and URL lines (agent/medref.py::_render).
const REF_LINE_RE = /^\[(ref:[^\]]+)\]\s+(.+)$/;
const URL_LINE_RE = /^\s*(https?:\/\/\S+)\s*$/;

function parseRefBlock(lines, startAt, refs) {
  const m = REF_LINE_RE.exec(lines[startAt]);
  if (!m) return startAt;
  const [, ref, label] = m;
  let rest = label;
  // label = "<source> · <title> › <section> (<lang>)"; fields after the first
  // are optional when a corpus entry is thin, so each stage is best-effort.
  let source = rest;
  const dot = rest.indexOf(" · ");
  if (dot !== -1) {
    source = rest.slice(0, dot);
    rest = rest.slice(dot + 3);
  }
  let url = "";
  for (let j = startAt + 1; j < lines.length && j < startAt + 4; j++) {
    const um = URL_LINE_RE.exec(lines[j]);
    if (um) {
      url = um[1];
      break;
    }
    if (REF_LINE_RE.test(lines[j])) break;
  }
  refs.set(ref, { ref, source, title: rest.trim(), url });
  return startAt;
}

/**
 * One `tool_result.content` → {rids: Map, refs: Map}.
 *
 * Table detection: a line with a `|` starts a header when no table is open;
 * following lines with the same cell count are data. Anything else (meta
 * line, notes, the reported-rows heading, a truncated partial row) closes
 * the table. A single-row table has every column hoisted into constants —
 * including `rid` — and no header at all, so a constants line that carries
 * a rid IS a row.
 */
export function parseToolResultTables(content) {
  const rids = new Map();
  const refs = new Map();
  if (typeof content !== "string" || !content) return { rids, refs };
  const lines = content.split("\n");
  let constants = null;
  let header = null;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (REF_LINE_RE.test(trimmed)) {
      parseRefBlock(lines, li, refs);
      header = null;
      continue;
    }
    if (trimmed.startsWith(CONSTANTS_PREFIX)) {
      constants = parseConstants(trimmed);
      header = null;
      if (RID_RE.test(constants.rid || "")) {
        rids.set(constants.rid, { ...constants });
      }
      continue;
    }
    if (!trimmed.includes("|")) {
      header = null;
      continue;
    }
    const cells = splitRow(trimmed);
    if (!header) {
      header = cells.map(unescapeCell);
      continue;
    }
    if (cells.length !== header.length) {
      // A different width is a new table (or the MAX_RENDER_CHARS cut mid-row);
      // either way the next lines must re-anchor on a header.
      header = cells.map(unescapeCell);
      continue;
    }
    const row = { ...(constants || {}) };
    header.forEach((col, idx) => {
      row[col] = unescapeCell(cells[idx]);
    });
    if (RID_RE.test(row.rid || "") && !rids.has(row.rid)) {
      rids.set(row.rid, row);
    }
  }
  return { rids, refs };
}

/** Short label for a record chip: the row's name and its date, when present. */
export function rowLabel(row) {
  if (!row) return "";
  const name = row.name || row.indicator || "";
  const when = row.date || row.time || row.period || row.last_date || row.first_date || "";
  return [name, when].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// markdown hand-off
// ---------------------------------------------------------------------------

//: The link scheme chips are emitted as. react-markdown's urlTransform
//: strips unknown schemes, so Markdown/index.jsx whitelists exactly this one.
export const CITE_SCHEME = "cite:";

function escapeLinkLabel(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

/**
 * Answer text → markdown source with every complete `<cite>` re-expressed as
 * `cite:` links and the statement tags consumed. Text outside any markup is
 * byte-identical. Chips resolve their label at render time from the registry
 * (the raw token is the link label, so a still-parsing answer shows the
 * token, and the chip swaps in the resolved row/file label).
 */
export function citeMarkdownSource(text) {
  if (typeof text !== "string" || !text || !text.includes("<")) return text || "";
  return parseCitedText(text)
    .map((seg) => {
      if (seg.kind !== "cites") return seg.text;
      return seg.tokens
        .map((tok) => `[${escapeLinkLabel(tok)}](${CITE_SCHEME}${encodeURIComponent(tok)})`)
        .join(" ");
    })
    .join("");
}
