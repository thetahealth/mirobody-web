import { describe, it, expect } from "vitest";
import {
  COMPARE_PREFIX,
  encodePaneSessionId,
  isPaneSessionId,
  isCompareGroupKey,
  decodeGroupKey,
  paneIndexOf,
  foldSiblingSummaries,
  zipPaneHistories,
} from "./compareSession";

describe("cdm codec", () => {
  const group = "cmp_da63e194-8cea-4581-998a-6f3b404d8ad5";
  const pane0 = "cmp_da63e194-8cea-4581-998a-6f3b404d8ad5_0";
  const pane1 = "cmp_da63e194-8cea-4581-998a-6f3b404d8ad5_1";
  const plainUuid = "da63e194-8cea-4581-998a-6f3b404d8ad5";
  const tempKey = "temp_da63e194-8cea-4581-998a-6f3b404d8ad5";

  it("encodes a pane session id from group uuid + index", () => {
    expect(encodePaneSessionId("da63e194-8cea-4581-998a-6f3b404d8ad5", 0)).toBe(pane0);
    expect(encodePaneSessionId("da63e194-8cea-4581-998a-6f3b404d8ad5", 1)).toBe(pane1);
  });

  it("classifies pane ids only", () => {
    expect(isPaneSessionId(pane0)).toBe(true);
    expect(isPaneSessionId(pane1)).toBe(true);
    expect(isPaneSessionId(group)).toBe(false); // group key, no _<idx>
    expect(isPaneSessionId(plainUuid)).toBe(false);
    expect(isPaneSessionId(tempKey)).toBe(false);
    expect(isPaneSessionId(null)).toBe(false);
  });

  it("classifies group keys only", () => {
    expect(isCompareGroupKey(group)).toBe(true);
    expect(isCompareGroupKey(pane0)).toBe(false); // has _<idx>
    expect(isCompareGroupKey(plainUuid)).toBe(false);
    expect(isCompareGroupKey(tempKey)).toBe(false);
  });

  it("decodes a pane id back to its group key", () => {
    expect(decodeGroupKey(pane0)).toBe(group);
    expect(decodeGroupKey(pane1)).toBe(group);
    expect(decodeGroupKey(plainUuid)).toBe(plainUuid); // non-pane: returned as-is
  });

  it("reads the pane index", () => {
    expect(paneIndexOf(pane0)).toBe(0);
    expect(paneIndexOf(pane1)).toBe(1);
    expect(paneIndexOf(plainUuid)).toBe(null);
  });

  it("exposes the prefix constant", () => {
    expect(COMPARE_PREFIX).toBe("cmp_");
  });
});

describe("foldSiblingSummaries", () => {
  it("collapses sibling panes to one entry keyed by group key", () => {
    const input = [
      { session_id: "cmp_g1_0", summary: "Sleep advice", query_user_id: "u1" },
      { session_id: "cmp_g1_1", summary: "Sleep advice", query_user_id: "u1" },
      { session_id: "plain-uuid-2", summary: "Diet", query_user_id: "u1" },
    ];
    const out = foldSiblingSummaries(input);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ session_id: "cmp_g1", summary: "Sleep advice", query_user_id: "u1" });
    expect(out[1]).toMatchObject({ session_id: "plain-uuid-2", summary: "Diet" });
  });

  it("preserves first-seen order and uses first non-empty summary", () => {
    const input = [
      { session_id: "cmp_g_0", summary: "", query_user_id: "u" },
      { session_id: "cmp_g_1", summary: "Real title", query_user_id: "u" },
    ];
    const out = foldSiblingSummaries(input);
    expect(out).toHaveLength(1);
    expect(out[0].summary).toBe("Real title");
  });

  it("returns [] for empty/nullish input", () => {
    expect(foldSiblingSummaries([])).toEqual([]);
    expect(foldSiblingSummaries(undefined)).toEqual([]);
  });
});

describe("zipPaneHistories", () => {
  const paneHistory = (provider) => [
    { role: "user", id: `u-${provider}`, messages: [{ type: "userQuestion", content: "Q1" }] },
    { role: "assistant", question_id: `q-${provider}`, datasource: [{ provider, content: `A1-${provider}` }] },
    { role: "user", id: `u2-${provider}`, messages: [{ type: "userQuestion", content: "Q2" }] },
    { role: "assistant", question_id: `q2-${provider}`, datasource: [{ provider, content: `A2-${provider}` }] },
  ];

  it("merges assistant datasources turn-by-turn across panes", () => {
    const out = zipPaneHistories([
      { paneIndex: 0, history: paneHistory("gpt") },
      { paneIndex: 1, history: paneHistory("claude") },
    ]);
    // 2 turns => user, assistant, user, assistant
    expect(out.map((x) => x.role)).toEqual(["user", "assistant", "user", "assistant"]);
    // turn 1 assistant has BOTH providers' datasource
    expect(out[1].datasource.map((d) => d.provider)).toEqual(["gpt", "claude"]);
    expect(out[3].datasource.map((d) => d.provider)).toEqual(["gpt", "claude"]);
    // user item comes from pane 0
    expect(out[0].messages[0].content).toBe("Q1");
  });

  it("tolerates a pane with fewer turns (e.g. one model errored)", () => {
    const short = [
      { role: "user", id: "u", messages: [{ content: "Q1" }] },
      { role: "assistant", question_id: "q", datasource: [{ provider: "claude", content: "A1" }] },
    ];
    const out = zipPaneHistories([
      { paneIndex: 0, history: paneHistory("gpt") }, // 2 turns
      { paneIndex: 1, history: short }, // 1 turn
    ]);
    expect(out.map((x) => x.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(out[1].datasource.map((d) => d.provider)).toEqual(["gpt", "claude"]);
    expect(out[3].datasource.map((d) => d.provider)).toEqual(["gpt"]); // pane1 missing turn 2
  });

  it("returns [] when no panes", () => {
    expect(zipPaneHistories([])).toEqual([]);
  });
});
