import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { toString } from "mdast-util-to-string";
import { remarkPlugins } from "./remarkPlugins";

// The tree react-markdown renders, before it becomes HTML.
const parse = (text) => {
  const processor = unified().use(remarkParse).use(remarkPlugins);
  return processor.runSync(processor.parse(text));
};

const struck = (tree) => {
  const out = [];
  const walk = (node) => {
    if (node.type === "delete") out.push(toString(node));
    (node.children || []).forEach(walk);
  };
  walk(tree);
  return out;
};

describe("remarkPlugins", () => {
  // Cut from a liver-panel answer (2026-11-13): a Chinese lab report writes a
  // reference range with one tilde, and two ranges in a sentence used to strike
  // through everything between them.
  it("leaves a reference range written with a single tilde as text", () => {
    const text = "肝功 7 项：谷丙转氨酶 11 U/L（7~40）、谷草转氨酶 16 U/L（13~35），均在范围内。";
    const tree = parse(text);
    expect(struck(tree)).toEqual([]);
    expect(toString(tree)).toBe(text);
  });

  it("still strikes through text between double tildes", () => {
    expect(struck(parse("二甲双胍 ~~500 mg~~ 改为 850 mg，范围 3.9~6.1"))).toEqual(["500 mg"]);
  });
});
