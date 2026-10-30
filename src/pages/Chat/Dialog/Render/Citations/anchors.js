// Where a cite group is drawn: under the VALUES of the claim it closes, or,
// when the claim states no value (a guideline, a line of a clinic note),
// under the claim itself. Nothing is numbered.
//
// Measured on 40 cited answers from CN test (TH-2134, 2026-10-30): 70% of
// cites close no <statement>, 49% sit in a table, and 81% can land on a
// value. So the claim is found from the cite backwards (its statement, else
// its clause, else its sentence), and the value is what gets the underline:
// it is the thing a reader checks, and in a table it is the cell.
//
// This runs on the parsed tree (a rehype plugin), never on the markdown
// string: the claim's words are text nodes there, so an underline can never
// cut into `**bold**` or a table's pipes.

import { CITE_SCHEME, STATEMENT_SCHEME, citeKind } from "./markup";

// ── values ──────────────────────────────────────────────────────────────

// Digits that are not values: dates, clock times, years, list ordinals and
// unit exponents. The same list as `kernel/citations.py`'s `_NOT_VALUES`,
// plus the Chinese ranges of days and months an answer writes ("7–9 月").
const MONTHS = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const RANGE_DASH = "[-–—~～至到]";
const NOT_VALUE = new RegExp(
  [
    String.raw`https?:\/\/\S+`,
    String.raw`(?:^|\n)[ \t]*\d{1,2}[.)、](?=\s)`,
    String.raw`\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?`,
    String.raw`(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])(?![\d.])`,
    String.raw`\d{4}\s*年(?:\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*[日号])?)?`,
    // "9、10 月" lists months; a comma does not ("7.7，8 月 9.1" is a value
    // and then a month), and neither does the tail of a decimal.
    String.raw`(?<![\d.])\d{1,2}(?:\s*(?:${RANGE_DASH}|[、和与及])\s*\d{1,2})*\s*月(?:\s*\d{1,2}\s*(?:${RANGE_DASH}\s*\d{1,2}\s*)?[日号])?`,
    String.raw`(?<![\d.])\d{1,2}\s*(?:${RANGE_DASH}\s*\d{1,2}\s*)?[日号](?!本)`,
    // "2 型糖尿病", "type 2 diabetes": a kind, not a quantity.
    String.raw`\d\s*型|\btype\s+\d\b`,
    String.raw`\b(?:${MONTHS})\.?\s+\d{1,2}(?:st|nd|rd|th)?\b(?:,?\s+\d{4})?`,
    String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+(?:${MONTHS})\b`,
    String.raw`\b\d{1,2}:\d{2}(?::\d{2})?\b`,
    String.raw`[*^×xX]\s*10\s*[\^*]?\s*\d+`,
    String.raw`\b10\s*[\^*]\s*\d+`,
    String.raw`第\s*\d+\s*[次天周个年]`,
    String.raw`\b(?:19|20)\d{2}\b(?!\s*(?:步|次|千卡|kcal|steps?))`,
  ].join("|"),
  "gi",
);

const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
// A unit is written right after its number, with at most one space. Latin
// units are a list, or anything with a slash ("mmol/L", "U/L", "/min"):
// an open pattern read "7.659 in the" as seven point six five nine inches.
const UNIT = [
  // No bare 升 or 降: "从 71.6 升到 74.4" is a verb.
  String.raw`%|‰|个百分点|百分点|次\/分钟?|步|次|小时|分钟|秒|公斤|千克|斤|毫克|克|毫升|厘米|公分|毫米|米|公里|千卡|大卡|级|岁|天|周|个月`,
  String.raw`[A-Za-zµμ°][A-Za-z0-9µμ°²³.]*\/[A-Za-z0-9µμ°²³.]+(?:\/[A-Za-z0-9µμ.²³]+)*`,
  String.raw`\/\s?[A-Za-z]+`,
  String.raw`(?:kg|mg|µg|μg|mcg|g|lbs?|cm|mm|km|m²|m|mmHg|bpm|BPM|kcal|kJ|ms|min|hrs?|h|s|mL|ml|dL|L|IU|U|°C|°F|fL|pg|ng|nmol|pmol|mmol|µmol|umol|mEq|steps?|cal)(?![A-Za-z])`,
  // English answers spell their durations and counts out: "24 minutes".
  String.raw`(?:minutes?|mins?|hours?|seconds?|beats?|nights?|days?|weeks?|months?|years?|times|readings?)(?![A-Za-z])`,
].join("|");
const VALUE = new RegExp(
  String.raw`(?<![A-Za-z0-9_.\u0001])(?:[<>≤≥＜＞]=?\s*)?[-+−±]?(?:${NUMBER})` +
    String.raw`(?:\s*${RANGE_DASH}\s*[-−]?(?:${NUMBER})|\s*\/\s*(?:${NUMBER}))?` +
    String.raw`(?![\d\u0001]|(?:st|nd|rd|th)\b)(?:\s?[万千])?(?:\s?(?:${UNIT}))?`,
  "g",
);

/** The values written in `text`, as [start, end) offsets. */
export function findValues(text) {
  const masked = text.replace(NOT_VALUE, (m) => "\u0001".repeat(m.length));
  const out = [];
  for (const m of masked.matchAll(VALUE)) {
    const value = m[0].replace(/\s+$/, "");
    if (/\d/.test(value)) out.push([m.index, m.index + value.length]);
  }
  return out;
}

// ── claims ──────────────────────────────────────────────────────────────

// "；" joins clauses of one sentence ("LDL 3.56 → 4.11；甘油三酯 1.84 →
// 2.85<cite>…" cites both), so it is a clause end here, not a sentence end.
// "、" ends nothing: it lists ("乳腺结节、小叶增生、盆腔积液<cite>" is one
// finding per cited row).
const SENTENCE_END = /[。！？\n]/;
const LATIN_END = /[.!?]/;
const CLAUSE_END = /[，：；,:;]/;
const OPEN = "（([【「『“‘";
const CLOSE = "）)]】」』”’";
const TRAILING = /[\s。！？；.!?;，,、：:]+$/;
const EDGE_PUNCT = /^[\s，。、：；！？,.:;!?（）()【】「」『』“”‘’"'—-]+|[\s，。、：；！？,.:;!?（）()【】「」『』“”‘’"'—-]+$/g;

// The clause and the sentence a loose cite closes, as start offsets into
// `text` (which ends at the cite). Brackets the claim closed before the cite
// are part of it: "−0.8 kg（−1.1%）<cite>" cites both numbers. An opening
// bracket the claim is still inside starts the clause: in "峰值（9.1 那次在
// 8 月 18 日<cite>" the cite is about 9.1, not the peak before it.
function claimBounds(text) {
  const end = text.length - (TRAILING.exec(text)?.[0].length || 0);
  let depth = 0;
  let clause = -1;
  let colon = -1;
  let i = end - 1;
  for (; i >= 0; i--) {
    const c = text[i];
    const next = text[i + 1] || "";
    if (c === "\n") break;
    if (CLOSE.includes(c)) depth++;
    else if (OPEN.includes(c)) {
      if (depth > 0) depth--;
      else if (clause === -1) clause = i + 1;
    } else if (depth === 0 && (SENTENCE_END.test(c) || (LATIN_END.test(c) && /\s/.test(next)))) break;
    else if (depth === 0 && CLAUSE_END.test(c) && !(/[,:]/.test(c) && /\d/.test(next))) {
      if (clause === -1) clause = i + 1;
      if (colon === -1 && /[：:]/.test(c)) colon = i + 1;
    }
  }
  const sentence = i + 1;
  // What follows a colon is what the sentence says; before it is its label
  // ("**乳腺与妇科：** 超声提示…").
  return { end, clause: clause === -1 ? sentence : clause, sentence, body: Math.max(sentence, colon) };
}

const trimRange = (text, start, end) => {
  const slice = text.slice(start, end);
  const lead = slice.length - slice.replace(/^[\s，。、：；！？,.:;!?（）()【】「」『』“”‘’"'—-]+/, "").length;
  const trail = slice.length - slice.replace(/[\s，。、：；！？,.:;!?（）()【】「」『』“”‘’"'—-]+$/, "").length;
  return start + lead < end - trail ? [start + lead, end - trail] : null;
};

const shift = (ranges, by) => ranges.map(([s, e]) => [s + by, e + by]);

const quoteOf = (text) => text.replace(EDGE_PUNCT, "").replace(/\s+/g, " ").slice(0, 140);

// What one cite marks inside its block: `{anchors, quote, kind}`, anchors as
// [start, end) offsets into the block's flat text. `from` is where the claim
// may begin (the previous cite), `statement` where its <statement> opened.
//
// A loose cite marks its clause's values. It reaches back to the whole
// sentence only for readings the clause cannot account for: "从 59.1 /min
// 降到 55.7 /min，中间几乎没有反弹段<cite>[r46][r58]" cites two readings from
// a clause with none, and "空腹血糖 5.6 mmol/L，…距离上限 6.1 只差 0.5<cite>"
// cites a reading whose measured value (the one with a unit) is earlier. A
// cite of a document or a guideline never widens: its claim is words, and
// the sentence's other numbers are not what it read.
function claimAnchors({ flat, seen }, from, at, statement, readings) {
  if (statement != null) {
    const values = shift(findValues(seen.slice(statement, at)), statement);
    const quote = quoteOf(flat.slice(statement, at));
    if (values.length) return { anchors: values, quote, kind: "value" };
    const whole = trimRange(flat, statement, at);
    return { anchors: whole ? [whole] : [], quote, kind: "claim" };
  }
  const before = flat.slice(from, at);
  const { end, clause, sentence, body } = claimBounds(before);
  const valuesIn = (start) => shift(findValues(seen.slice(from + start, from + end)), from + start);
  const inClause = valuesIn(clause);
  if (sentence < clause && readings > 0) {
    const inSentence = valuesIn(sentence);
    const measured = (ranges) => ranges.some(([s, e]) => hasUnit(seen.slice(s, e)));
    const short = inClause.length < readings && inSentence.length > inClause.length;
    if (short || (!measured(inClause) && measured(inSentence))) {
      return { anchors: inSentence, quote: quoteOf(before.slice(sentence, end)), kind: "value" };
    }
  }
  if (inClause.length) return { anchors: inClause, quote: quoteOf(before.slice(clause, end)), kind: "value" };
  // No value at all: a finding ("超声提示…") is the clause, or the whole
  // sentence when it rests on several rows.
  const wide = readings > 1 && trimRange(flat, from + body, from + end);
  const narrow = wide || trimRange(flat, from + clause, from + end) || trimRange(flat, from + sentence, from + end);
  return { anchors: narrow ? [narrow] : [], quote: quoteOf(before.slice(sentence, end)), kind: "claim" };
}

const UNIT_AT_END = new RegExp(String.raw`(?:${UNIT})$`);
const hasUnit = (value) => UNIT_AT_END.test(value);

// ── the tree ────────────────────────────────────────────────────────────

const BLOCKS = new Set(["p", "li", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "dt", "dd", "figcaption"]);
const NESTED = new Set(["p", "ul", "ol", "li", "table", "pre", "blockquote", "div", "h1", "h2", "h3", "h4", "h5", "h6", "hr"]);
// Text a reader sees but an underline must not enter: another link, code.
const OPAQUE = new Set(["a", "code", "kbd", "img", "sup", "sub"]);

const textOf = (node) =>
  node.type === "text" ? node.value : (node.children || []).map(textOf).join("");

const hrefOf = (node) => (node.type === "element" && node.tagName === "a" ? node.properties?.href : null);

// A block's inline content, flattened: the text a reader sees, the text
// nodes it lives in, and where each marker sits in it.
function readBlock(block) {
  const atoms = [];
  let flat = "";
  // `flat` with code and links masked: a value inside `HbA1c<6.5` is not
  // one the cite can be drawn on, since the underline cannot enter it.
  let seen = "";
  const walk = (node) => {
    for (const child of node.children || []) {
      if (child.type === "text") {
        atoms.push({ kind: "text", node: child, start: flat.length });
        flat += child.value;
        seen += child.value;
        continue;
      }
      if (child.type !== "element" || NESTED.has(child.tagName)) continue;
      const href = hrefOf(child);
      if (typeof href === "string" && href.startsWith(CITE_SCHEME)) {
        atoms.push({ kind: "cite", group: Number(href.slice(CITE_SCHEME.length)), at: flat.length });
      } else if (typeof href === "string" && href.startsWith(STATEMENT_SCHEME)) {
        atoms.push({ kind: "statement", at: flat.length });
      } else if (child.tagName === "br") {
        flat += "\n";
        seen += "\n";
      } else if (OPAQUE.has(child.tagName)) {
        const text = textOf(child);
        flat += text;
        seen += "\u0001".repeat(text.length);
      } else {
        walk(child);
      }
    }
  };
  walk(block);
  return { block, atoms, flat, seen, cites: atoms.filter((a) => a.kind === "cite") };
}

// A printed reference range, not the person's own range ("全年范围" is a
// value the answer computed, and is cited as one).
const REFERENCE_HEADER = /参考|參考|参照|正常值|正常范围|正常範圍|基準|reference|\bref\b|normal range/i;

// A cite whose own cell states no value ("H", "高于参考范围", a source
// column), or that sits in the reference-range column, marks the row's
// values instead: the other cells that carry no cite of their own, leaving
// out a reference-range column. The prompt's own table example ends a row
// with `| <3.4 <cite>[r9]</cite> |`, and models follow it.
const cellsOf = (row) =>
  (row?.children || []).filter((c) => c.type === "element" && (c.tagName === "td" || c.tagName === "th"));

function rowFallback(info, infos, headers) {
  const cell = info.block;
  const row = info.parent;
  if (!row || row.tagName !== "tr") return [];
  const out = [];
  cellsOf(row).forEach((other, column) => {
    if (other === cell) return;
    const sibling = infos.get(other);
    if (!sibling || sibling.cites.length) return;
    if (REFERENCE_HEADER.test(headers[column] || "")) return;
    for (const range of findValues(sibling.seen)) out.push({ info: sibling, range });
  });
  return out;
}

function headersOf(table) {
  const head = (table.children || []).find((c) => c.tagName === "thead");
  const row = head?.children?.find((c) => c.tagName === "tr");
  return (row?.children || []).filter((c) => c.tagName === "th").map(textOf);
}

/**
 * rehype plugin: wraps the words each cite group stands behind in
 * `<span data-cite="2,3" data-cite-kind="value|claim" data-cite-quote="…">`.
 * A group that finds nothing of its own (a second cite on a claim already
 * cited) joins the anchors of the cite before it in the same block.
 */
export function rehypeCiteAnchors({ groups = [] } = {}) {
  const readingsOf = (group) => (groups[group]?.ids || []).filter((id) => citeKind(id) === "row").length;
  return (tree) => {
    const infos = new Map();
    const order = [];
    const visit = (node, parent, table) => {
      if (node.type !== "element" && node.type !== "root") return;
      const inTable = node.tagName === "table" ? node : table;
      if (node.type === "element" && BLOCKS.has(node.tagName)) {
        const info = { ...readBlock(node), parent, table: inTable };
        infos.set(node, info);
        order.push(info);
      }
      for (const child of node.children || []) visit(child, node, inTable);
    };
    visit(tree, null, null);

    const marks = new Map(); // text node -> [{start, end, groups, kind, quote}]
    const mark = (info, [start, end], entry) => {
      for (const atom of info.atoms) {
        if (atom.kind !== "text") continue;
        const s = Math.max(start, atom.start);
        const e = Math.min(end, atom.start + atom.node.value.length);
        if (s >= e) continue;
        if (!marks.has(atom.node)) marks.set(atom.node, []);
        marks.get(atom.node).push({ ...entry, start: s - atom.start, end: e - atom.start });
      }
    };

    for (const info of order) {
      if (!info.cites.length) continue;
      const headers = info.table ? headersOf(info.table) : [];
      let from = 0;
      let previous = null;
      // The statement a cite closes is the one opened since the cite before
      // it, in document order: back to back, `…<cite>[r1]</cite></statement>
      // <statement>…` puts the next opening at the same offset as this cite.
      let statement = null;
      for (const cite of info.atoms) {
        if (cite.kind === "statement") statement = cite;
        if (cite.kind !== "cite") continue;
        let { anchors, quote, kind } = claimAnchors(info, from, cite.at, statement?.at, readingsOf(cite.group));
        statement = null;
        let targets = anchors.map((range) => ({ info, range }));
        const inCell = info.block.tagName === "td" || info.block.tagName === "th";
        const cells = inCell ? cellsOf(info.parent) : [];
        const column = cells.indexOf(info.block);
        const fallback =
          inCell && (kind === "claim" || REFERENCE_HEADER.test(headers[column] || ""))
            ? rowFallback(info, infos, headers)
            : [];
        if (fallback.length) {
          targets = fallback;
          kind = "value";
          quote = quoteOf(cells.map(textOf).filter((t) => t.trim()).join(" · "));
        } else if (inCell) {
          // A cell alone ("69.2–70.6 kg") does not say what it is: its row
          // and its column do.
          const label = column > 0 ? textOf(cells[0]).trim() : "";
          quote = quoteOf([label, headers[column], quote].filter(Boolean).join(" · "));
        }
        if (!targets.length && previous) {
          previous.groups.push(cite.group);
        } else if (targets.length) {
          const entry = { groups: [cite.group], kind, quote };
          for (const target of targets) mark(target.info, target.range, entry);
          previous = entry;
        }
        from = cite.at;
      }
    }

    // `data-cite-at` tells one anchor from another of the same group: the
    // popover opens on the one clicked.
    let at = 0;
    const split = (node) => {
      const ranges = (marks.get(node) || []).sort((a, b) => a.start - b.start);
      const out = [];
      let pos = 0;
      for (const r of ranges) {
        if (r.start < pos) continue;
        if (r.start > pos) out.push({ type: "text", value: node.value.slice(pos, r.start) });
        out.push({
          type: "element",
          tagName: "span",
          properties: { dataCite: r.groups.join(","), dataCiteKind: r.kind, dataCiteQuote: r.quote, dataCiteAt: String(at++) },
          children: [{ type: "text", value: node.value.slice(r.start, r.end) }],
        });
        pos = r.end;
      }
      if (pos < node.value.length) out.push({ type: "text", value: node.value.slice(pos) });
      return out;
    };
    const rewrite = (node) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => (marks.has(child) ? split(child) : [child]));
      for (const child of node.children) rewrite(child);
    };
    if (marks.size) rewrite(tree);
  };
}

/** The group indices a `data-cite` attribute names. */
export const groupsOf = (attribute) =>
  String(attribute || "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0);
