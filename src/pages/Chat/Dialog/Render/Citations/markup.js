// The citation markup an answer carries. The format is mirobody's
// `kernel/citations.py`: a claim in <statement>, its evidence in a closing
// <cite>[r3][r9]</cite>. A cite is a row a tool showed in this conversation
// (`r3`), a reference passage (`ref:source:id`) or lines of a document
// (`/library/x.pdf#L12-L14`).
//
// Nothing here draws a number. Each run of adjacent cites becomes one GROUP,
// and the markup becomes zero-width markdown links — `[](cite:<group>)` and
// `[](statement:)` — that `anchors.js` reads off the parsed tree to find the
// words the group stands behind. Links, because a marker has to survive the
// markdown parser without changing it: `[` and `)` are punctuation, so
// `**（加粗）**[](cite:0)` still closes its emphasis, which a private-use
// character would not.

export const CITE_SCHEME = "cite:";
export const STATEMENT_SCHEME = "statement:";

// Models misspell the cite tag: measured 2026-10-30, DeepSeek closed a
// statement with `<xcite>[r4]</cite>`. One or two stray letters before
// "cite", spaces and case are read as the tag it meant, so the markup never
// leaks into the answer; a cite-like tag with no ids (`<excite>`, a `<cite>`
// around a title) has nothing to draw, so only its words are kept.
// `statement` is matched as spelt: `<restatement>` is not one.
const TAG = /<\s*(\/?)\s*(statement|[a-z]{0,2}cite)\s*>/giy;
// A fenced block (a chart's JSON) is data, not markup.
const FENCE = /```[\s\S]*?(?:```|$)/g;
const TAG_START = /^<\/?([a-z]{0,11})$/i;
// A cite's body is its ids; anything else ends it, so a missing `</cite>`
// cannot swallow the rest of the answer.
const CITE_BODY = /\s*((?:\[[^[\]\n]*\]\s*)*)/y;
const CITE_ID = /\[([^[\]\n]+)\]/g;

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

// The answer as a list of text and tags, tags already corrected.
function tokenize(text) {
  const out = [];
  let pos = 0;
  for (const fence of text.matchAll(FENCE)) {
    out.push(...tokenizeProse(text.slice(pos, fence.index)));
    out.push({ type: "text", value: fence[0] });
    pos = fence.index + fence[0].length;
  }
  out.push(...tokenizeProse(text.slice(pos)));
  return out;
}

function tokenizeProse(text) {
  const out = [];
  let pos = 0;
  let plain = "";
  while (pos < text.length) {
    const lt = text.indexOf("<", pos);
    if (lt === -1) break;
    TAG.lastIndex = lt;
    const m = TAG.exec(text);
    if (!m) {
      plain += text.slice(pos, lt + 1);
      pos = lt + 1;
      continue;
    }
    plain += text.slice(pos, lt);
    if (plain) out.push({ type: "text", value: plain });
    plain = "";
    const tag = m[2].toLowerCase() === "statement" ? "statement" : "cite";
    const close = m[1] === "/";
    pos = TAG.lastIndex;
    if (tag === "cite" && !close) {
      CITE_BODY.lastIndex = pos;
      const body = CITE_BODY.exec(text);
      const ids = [...body[1].matchAll(CITE_ID)].map((id) => id[1].trim()).filter(Boolean);
      TAG.lastIndex = CITE_BODY.lastIndex;
      const end = TAG.exec(text);
      if (end && end[1] === "/" && end[2].toLowerCase().endsWith("cite")) pos = TAG.lastIndex;
      else pos = CITE_BODY.lastIndex - (body[0].length - body[0].trimEnd().length);
      out.push({ type: "cite", ids });
    } else if (tag === "statement" && !close) {
      out.push({ type: "statement" });
    }
    // A closing tag carries nothing: a statement ends where its cite does.
  }
  plain += text.slice(pos);
  if (plain) out.push({ type: "text", value: plain });
  return out;
}

// Whether `tail` ("<", "<sta", "</ci", "<xci") can still grow into a tag.
// Stray letters count only once a letter of the tag follows them, or "a < b"
// at the end of an answer would be held back as the start of one.
function isTagStart(tail) {
  const m = TAG_START.exec(tail);
  if (!m) return false;
  const word = m[1].toLowerCase();
  return ["statement", "cite"].some((tag) =>
    [0, 1, 2].some((stray) => {
      const rest = word.slice(stray);
      return word.length >= stray && (stray === 0 || rest) && tag.startsWith(rest);
    }),
  );
}

// While an answer streams, its last characters can be half a tag ("<sta",
// "<cite>[r1"). Those are held back until they complete, so the reader never
// sees markup flash by. Only a cite still receiving its ids is held: one with
// prose after its ids was left open by the model, and holding it back hid the
// rest of a finished answer that its copied text still had. Inside a fence
// that is still open (a chart arriving) nothing is markup.
const OPEN_CITE_TAIL = /^<\s*[a-z]{0,2}cite\s*>(?:\s*\[[^[\]\n]*\]?)*\s*$/i;

function pendingTail(text) {
  if ((text.match(/```/g) || []).length % 2 === 1) return text.length;
  const lt = text.lastIndexOf("<");
  if (lt === -1) return text.length;
  const tail = text.slice(lt);
  if (isTagStart(tail) || OPEN_CITE_TAIL.test(tail)) return lt;
  return text.length;
}

const ALNUM = /[A-Za-z0-9]/;
const ENDS_CLAIM = /[\s。！？；，、：.!?;,:)）\]】」』”’]$/;

// Statements written back to back with no punctuation between them read as
// one run-on line once their numbered chips are gone: four guideline
// statements in a 2026-10-31 DeepSeek answer became "…“好”胆固醇血胆固醇过高
// 会…风险甘油三酯偏高…". A cite that ends one claim right before the next
// statement opens gets a space after it.
const runsOn = (text, next) => next?.type === "statement" && text && !ENDS_CLAIM.test(text);

// The answer as markdown with zero-width markers, and the cite groups they
// number. Adjacent cites (only spaces between) are one group: the claim
// before them rests on all of them, and a reader opens them together.
export function prepareCitations(text) {
  if (typeof text !== "string" || !text.includes("<")) return { markdown: text || "", groups: [] };
  const tokens = tokenize(text.slice(0, pendingTail(text)));
  const groups = [];
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "text") {
      out += token.value;
    } else if (token.type === "statement") {
      out += `[](${STATEMENT_SCHEME})`;
    } else {
      const ids = new Set(token.ids);
      while (
        tokens[i + 1]?.type === "cite" ||
        (tokens[i + 1]?.type === "text" && /^[ \t]*$/.test(tokens[i + 1].value) && tokens[i + 2]?.type === "cite")
      ) {
        i += tokens[i + 1].type === "cite" ? 1 : 2;
        for (const id of tokens[i].ids) ids.add(id);
      }
      if (!ids.size) continue;
      // The space a model leaves before a cite was room for a numbered chip.
      // Kept only where two words would otherwise run together.
      const before = out.replace(/[ \t]+$/, "");
      const trimmed = before.length < out.length;
      const next = tokens[i + 1]?.type === "text" ? tokens[i + 1].value[0] : "";
      out = before + `[](${CITE_SCHEME}${groups.length})`;
      if ((trimmed && ALNUM.test(before.slice(-1)) && next && ALNUM.test(next)) || runsOn(before, tokens[i + 1])) out += " ";
      groups.push({ ids: [...ids] });
    }
  }
  return { markdown: out, groups };
}

// The text an answer reads as without its markup (copying, a shared page).
export function stripCitations(text) {
  if (typeof text !== "string") return "";
  if (!text.includes("<")) return text;
  const tokens = tokenize(text);
  let out = "";
  tokens.forEach((token, i) => {
    if (token.type === "text") out += token.value;
    else if (token.type === "cite" && runsOn(out, tokens[i + 1])) out += " ";
  });
  return out;
}

// The group a marker link stands for, or null for any other link.
export function groupFromHref(href) {
  if (typeof href !== "string" || !href.startsWith(CITE_SCHEME)) return null;
  const n = Number(href.slice(CITE_SCHEME.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}
