import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";

// One list for the renderer and for the citation tests: a cite anchor is
// placed on the parsed tree, so the tests must parse exactly as the page does.
export const remarkPlugins = [
  // singleTilde: GFM's default also reads a pair of SINGLE tildes as
  // strikethrough, and a Chinese lab report writes its reference ranges with
  // one: in "谷丙转氨酶 11 U/L（7~40）、谷草转氨酶 16 U/L（13~35）" everything
  // from the first `~` to the second was struck through and both tildes were
  // dropped, so the reader saw "（740）" and "（1335）". `~~text~~` still strikes.
  [remarkGfm, { singleTilde: false }],
  // cjk-friendly: CommonMark's emphasis delimiter rules treat full-width
  // punctuation as punctuation, so the ** in `**基因位点（rsID）**数据` renders
  // literally instead of as bold — and models write exactly that in Chinese
  // answers. This plugin relaxes the delimiter test for CJK text.
  remarkCjkFriendly,
];
