import { describe, it, expect } from "vitest";
import { citationsToMarkdown, citeIdFromHref, citeKind, linesOf, stripCitations } from "./markup";

const ANSWER =
  "<statement>LDL 从 3.8 降到 2.9 mmol/L<cite>[r3][r9]</cite></statement>，" +
  "<statement>范围 <3.4<cite>[r9]</cite></statement>。" +
  "<statement>病历写着复查<cite>[/library/门诊 病历.pdf#L12-L14]</cite></statement>";

describe("citation markup", () => {
  it("turns cites into numbered links and drops the statement tags", () => {
    expect(citationsToMarkdown(ANSWER)).toBe(
      "LDL 从 3.8 降到 2.9 mmol/L[1](cite:r3)[2](cite:r9)，范围 <3.4[2](cite:r9)。" +
        "病历写着复查[3](cite:%2Flibrary%2F%E9%97%A8%E8%AF%8A%20%E7%97%85%E5%8E%86.pdf%23L12-L14)",
    );
  });

  it("holds back a tag that has not finished streaming", () => {
    expect(citationsToMarkdown("体重 69.2 kg<cite>[r")).toBe("体重 69.2 kg");
    expect(citationsToMarkdown("体重 69.2 kg<sta")).toBe("体重 69.2 kg");
    expect(citationsToMarkdown("a < b")).toBe("a < b");
  });

  it("leaves text without markup alone", () => {
    expect(citationsToMarkdown("plain text")).toBe("plain text");
    expect(citationsToMarkdown(undefined)).toBe("");
  });

  it("reads back the id a link carries", () => {
    expect(citeIdFromHref("cite:r3")).toBe("r3");
    expect(citeIdFromHref("cite:%2Flibrary%2Fa.pdf%23L3")).toBe("/library/a.pdf#L3");
    expect(citeIdFromHref("https://example.org")).toBeNull();
  });

  it("knows the three kinds of cite", () => {
    expect(citeKind("r12")).toBe("row");
    expect(citeKind("ref:medlineplus:2241")).toBe("ref");
    expect(citeKind("/library/a.pdf#L3-L5")).toBe("lines");
    expect(citeKind("web_uploads/x.pdf")).toBe("unknown");
    expect(linesOf("/library/a.pdf#L3-L5")).toEqual({ path: "/library/a.pdf", start: 3, end: 5 });
  });

  it("strips the markup for plain text", () => {
    expect(stripCitations(ANSWER)).toBe("LDL 从 3.8 降到 2.9 mmol/L，范围 <3.4。病历写着复查");
  });
});
