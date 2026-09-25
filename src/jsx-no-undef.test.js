/**
 * Every component a .jsx file renders is imported or defined in that file.
 *
 * ESLint's `no-undef` is on, but ESLint 9 does not track JSX element names as
 * references, so `<IconChevronDown />` with no import passes lint, passes the
 * build (an undefined identifier is not a syntax error), and throws only when
 * that component renders. That is how the Data page's Files tab shipped a
 * ReferenceError that took the whole page down to the error boundary.
 *
 * This is a textual check, not a parser: it collects `<Name` / `<Name.` tags
 * that start with a capital letter and looks for a binding of that name in
 * the same file — an import specifier (default, named or `as`), a
 * `const` / `let` / `function` / `class` declaration, or a destructured one,
 * including a component passed in as a prop (`({ OkButton }) => …`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL(".", import.meta.url).pathname;

const jsxFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsxFiles(path);
    return path.endsWith(".jsx") ? [path] : [];
  });

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const renderedComponents = (source) =>
  new Set([...source.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s./>]/g)].map((m) => m[1]));

const isBound = (source, name) =>
  new RegExp(
    [
      `import\\s+${name}\\b`, // default import
      `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`, // named / aliased
      `import\\s+[A-Za-z_$][\\w$]*\\s*,\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`, // default + named
      `import\\s*\\*\\s*as\\s+${name}\\b`,
      `(?:const|let|var|function|class)\\s+${name}\\b`,
      `(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=`, // destructured
      `\\(\\s*\\{[^)]*\\b${name}\\b[^)]*\\}\\s*\\)`, // a prop destructured in the parameters
    ].join("|"),
  ).test(source);

describe("jsx components are bound", () => {
  it.each(jsxFiles(SRC).map((f) => [f.slice(SRC.length), f]))("%s", (_rel, file) => {
    const source = stripComments(readFileSync(file, "utf8"));
    const unbound = [...renderedComponents(source)].filter((name) => !isBound(source, name));
    expect(unbound).toEqual([]);
  });
});
