// What the work behind an answer looks like as steps: which tool did what, in
// words a person reads ("Looking up your health data · LDL"), how long the
// thinking took, and what is happening right now. Pure functions of the
// streamed blocks, so they are tested without rendering.

import { CHART_MESSAGE_TYPE, TOOL_STATUS_ERROR, TOOL_STATUS_PARTIAL } from "../../../../../enum/chat";

export const STEP_THOUGHT = "thought";
export const STEP_TOOL = "tool";
export const STEP_CONTEXT = "context";

// One entry per kind of work. `key` names the i18n pair
// `process_<key>_running` / `process_<key>_done`; `icon` is resolved by the
// component. Tool names are the engine's (agent/tools, deepagents).
const KINDS = {
  query_health_indicators: { key: "health", icon: "data" },
  query_medications: { key: "medications", icon: "pill" },
  query_genetic_data: { key: "genetics", icon: "dna" },
  query_pharmacogenomics: { key: "pharmacogenomics", icon: "dna" },
  eval: { key: "compute", icon: "calculator" },
  python_exec: { key: "compute", icon: "calculator" },
  search_medical_knowledge: { key: "knowledge", icon: "book" },
  read_medical_source: { key: "source", icon: "book" },
  read_file: { key: "read_file", icon: "file" },
  ls: { key: "files", icon: "folder" },
  glob: { key: "files", icon: "folder" },
  grep: { key: "files", icon: "folder" },
  write_file: { key: "notes", icon: "pencil" },
  edit_file: { key: "notes", icon: "pencil" },
  write_todos: { key: "plan", icon: "list" },
  resolve_indicator: { key: "terms", icon: "language" },
  normalize_unit: { key: "terms", icon: "language" },
  convert_unit: { key: "terms", icon: "language" },
  ask_user: { key: "ask", icon: "question" },
};
// A knowledge search names its scope; each reads differently.
const KNOWLEDGE_SCOPES = { literature: "literature", trials: "trials" };

// `eval` can call the record tools itself (`tools.queryHealthIndicators(...)`).
const FETCHES_IN_CODE = /\btools\.(?:query|search|read)\w*\s*\(/;

export const kindOf = (name, args) => {
  const kind = KINDS[name];
  if (!kind) return { key: "tool", icon: "tool" };
  if (name === "search_medical_knowledge" && KNOWLEDGE_SCOPES[args?.scope]) {
    return { key: KNOWLEDGE_SCOPES[args.scope], icon: "book" };
  }
  if (name === "eval" && FETCHES_IN_CODE.test(String(args?.code || ""))) {
    return { key: "compute_data", icon: "calculator" };
  }
  return kind;
};

const MAX_ITEMS = 3;
const basename = (path) => String(path || "").split("/").filter(Boolean).pop() || "";
const list = (items) => {
  const shown = items.filter(Boolean).map(String);
  return shown.slice(0, MAX_ITEMS).join(", ") + (shown.length > MAX_ITEMS ? ", …" : "");
};

/** The part of a call's arguments worth showing beside its label. */
export const argSummary = (name, args) => {
  if (!args || typeof args !== "object") return "";
  switch (name) {
    case "query_health_indicators": {
      const names = args.indicators?.length ? args.indicators : args.keywords;
      return Array.isArray(names) ? list(names) : "";
    }
    case "search_medical_knowledge":
      return String(args.query || "");
    case "read_medical_source":
      return String(args.ref || "");
    case "read_file":
    case "write_file":
    case "edit_file":
      return basename(args.file_path || args.path);
    case "ls":
      return String(args.path || "");
    case "glob":
    case "grep":
      return String(args.pattern || "");
    case "resolve_indicator":
    case "normalize_unit":
      return Array.isArray(args.names || args.units) ? list(args.names || args.units) : "";
    case "query_genetic_data":
    case "query_pharmacogenomics": {
      const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
      return list([...arr(args.rsids), ...arr(args.genes), ...arr(args.gene), ...arr(args.drugs)]);
    }
    default:
      return "";
  }
};

// The headline of a reasoning stretch, when the model writes one ("**Checking
// the lipid panel**" at a line's start, the way Gemini and Claude think).
const HEADING = /^\s*(?:#{1,4}\s+(.+?)|\*\*(.+?)\*\*)\s*$/gm;
export const latestHeading = (text) => {
  let found = "";
  for (const match of String(text || "").matchAll(HEADING)) {
    found = (match[1] || match[2] || "").trim();
  }
  return found.length > 80 ? `${found.slice(0, 79)}…` : found;
};

/**
 * The group's blocks as steps, in order: a reasoning stretch is one thought, a
 * tool call is one tool step with its result folded in (joined on the call id,
 * `tool_call.id` = `tool_result.tool_call_id`).
 */
export const toSteps = (blocks) => {
  const results = new Map();
  for (const block of blocks || []) {
    if (block.type === CHART_MESSAGE_TYPE.TOOL_RESULT && block.tool_call_id) {
      results.set(block.tool_call_id, block);
    }
  }
  const steps = [];
  const contexts = new Map();
  for (const block of blocks || []) {
    if (block.type === CHART_MESSAGE_TYPE.REASONING) {
      const text = block.reasoning ?? block.content ?? "";
      if (String(text).trim()) steps.push({ type: STEP_THOUGHT, id: block.id, text, at: block.at, end: block.end });
    } else if (block.type === CHART_MESSAGE_TYPE.TOOL_CALL) {
      const result = block.id ? results.get(block.id) : null;
      steps.push({
        type: STEP_TOOL,
        id: block.id,
        name: block.name || "",
        args: block.args,
        kind: kindOf(block.name, block.args),
        summary: argSummary(block.name, block.args),
        detail: result ? (result.content ?? "") : "",
        done: Boolean(result),
        failed: result?.status === TOOL_STATUS_ERROR,
        partial: result?.status === TOOL_STATUS_PARTIAL || result?.truncated === true,
        at: block.at,
        end: result?.at,
      });
    } else if (block.type === CHART_MESSAGE_TYPE.CONTEXT && block.phase === "summarization") {
      const step = contexts.get(block.id) || {
        type: STEP_CONTEXT, id: block.id, name: "", kind: { key: "context", icon: "file" }, at: block.at,
      };
      if (!contexts.has(block.id)) {
        contexts.set(block.id, step);
        steps.push(step);
      }
      step.done = block.status === "completed" || block.status === "failed";
      step.failed = block.status === "failed";
      if (step.done) step.end = block.at;
    }
  }
  return steps;
};

/** Seconds from the group's first block to its last, when they were timed live. */
export const durationOf = (blocks, now) => {
  const times = (blocks || []).flatMap((b) => [b.at, b.end]).filter((t) => typeof t === "number");
  if (!times.length) return null;
  const last = now ?? Math.max(...times);
  return Math.max(1, Math.round((last - Math.min(...times)) / 1000));
};

/** A still-pending parallel call stays visible after a later one returns. */
export const currentStep = (steps) => steps.findLast((step) => step.type !== STEP_THOUGHT && !step.done)
  || (steps.at(-1)?.type === STEP_THOUGHT ? steps.at(-1) : null);

export const stepState = (step, active) => step.failed ? "failed"
  : step.partial ? "partial" : step.done ? "done" : active ? "running" : "unfinished";

export const toolCount = (steps) => steps.filter((s) => s.type === STEP_TOOL).length;
