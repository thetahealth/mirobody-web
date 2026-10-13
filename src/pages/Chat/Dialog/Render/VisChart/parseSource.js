// Reading a ```vis-chart block the model wrote, including the slips it makes.
//
// The agent writes the chart's JSON by hand, token by token, and a small model
// slips: MiniCPM5-2B closed a steps chart with one `}` too many (2026-10-06
// local evaluation), JSON.parse threw, and the answer showed nothing where the
// chart should be, with no sign anything was missing. Nothing on the server
// checks the block: it reaches the browser as it is streamed, so the browser
// is the one place a repair covers both the live answer and a reloaded one.
//
// Two rules keep the repair honest. It runs only once the block's closing
// fence has arrived (`fenceClosed`): mid-stream, unparseable JSON is just
// unfinished, and closing it early would draw a chart of half the points.
// And it mends structure only (brackets, commas, a fence inside the fence),
// never a value, so every point drawn is a point the model wrote.

// A fence line: up to three spaces, then three or more backticks or tildes.
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const OPENING_FENCE_LINE = /^ {0,3}(`{3,}|~{3,})[\w-]*[ \t]*$/;

/**
 * Whether the raw markdown of one fenced block ends with its closing fence,
 * i.e. the model has finished writing it. `raw` is the block's source span:
 * react-markdown hands each `code` element the position of the whole fenced
 * block (mdast-util-to-hast patches the mdast node onto it), and a fence that
 * is still open runs to the end of the text streamed so far.
 */
export function fenceClosed(raw) {
  const lines = String(raw ?? "").replace(/\s+$/, "").split("\n");
  return lines.length > 1 && FENCE_LINE.test(lines[lines.length - 1]);
}

// "```vis-chart" directly followed by "```json": the model fenced its JSON a
// second time. Markdown closes the chart block at the inner closer, and the
// outer closer then OPENS an empty code block that turns the rest of the
// answer into code. Collapsed to one fence before the markdown is parsed.
const DOUBLE_FENCE =
  /```vis-chart[^\n]*\n[ \t]*```[\w-]*[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*\n[ \t]*```[ \t]*(?=\n|$)/g;

// The closer written on the JSON's last line (`…]}```), which markdown does
// not read as a closer: the block ran to the end of the answer and the text
// after the chart was lost with it. MiniCPM5-2B, 2026-10-13 e2e.
const GLUED_CLOSER = /(```vis-chart[^\n]*\n)((?:(?!```)[\s\S])*?[}\]])[ \t]*```[ \t]*(?=\n|$)/g;

/** The answer's markdown with doubled chart fences collapsed to one and a
 * closer glued to the JSON moved onto its own line. */
export function normalizeChartFences(markdown) {
  return String(markdown ?? "")
    .replace(DOUBLE_FENCE, "```vis-chart\n$1\n```")
    .replace(GLUED_CLOSER, "$1$2\n```");
}

// A fence line left inside the block's text (the inner opener whose closer
// never came, or a stray closer).
function stripInnerFence(text) {
  const lines = text.split("\n");
  if (lines.length && OPENING_FENCE_LINE.test(lines[0])) lines.shift();
  if (lines.length && FENCE_LINE.test(lines[lines.length - 1])) lines.pop();
  return lines.join("\n").trim();
}

// The first JSON value in `text`, brackets balanced: a closer that does not
// match closes the brackets it skipped (`[{…}}` → `[{…}]}`), whatever follows
// the value is dropped if it is only stray closers or punctuation, brackets
// left open at the end are closed, and a comma before a closer goes. Returns
// null when the text is not one value with slips (cut inside a string, or a
// second value after the first).
function balance(text) {
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  const closers = [];
  let out = "";
  let inString = false;
  let escaped = false;
  const close = (ch) => {
    out = out.replace(/,\s*$/, "") + ch;
  };
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "{" || ch === "[") {
      closers.push(ch === "{" ? "}" : "]");
      out += ch;
    } else if (ch === "}" || ch === "]") {
      if (!closers.includes(ch)) continue; // closes nothing that is open: dropped
      while (closers[closers.length - 1] !== ch) close(closers.pop());
      close(closers.pop());
      if (!closers.length) {
        return /^[\s}\]`,;]*$/.test(text.slice(i + 1)) ? out : null;
      }
    } else {
      out += ch;
    }
  }
  if (inString) return null;
  while (closers.length) close(closers.pop());
  return out;
}

/**
 * The chart config in a ```vis-chart block's text, or null.
 *
 * `repair` is for a finished block (`fenceClosed`): it strips a fence left
 * inside and balances the brackets before parsing. Without it the text must
 * parse as it is, which is what a block still streaming needs.
 *
 * @returns {{config: object, repaired: boolean} | null}
 */
export function parseChartSource(source, { repair = false } = {}) {
  const text = String(source ?? "").trim();
  try {
    return { config: JSON.parse(text), repaired: false };
  } catch {
    // unfinished, or a slip; only a finished block is mended
  }
  if (!repair) return null;
  const balanced = balance(stripInnerFence(text));
  if (balanced === null) return null;
  try {
    return { config: JSON.parse(balanced), repaired: true };
  } catch {
    return null;
  }
}
