/**
 * `tokens.css` carries every colour of the production base palette.
 *
 * The palette is the Theta Smart iOS app's (its ThemeTokens), which is the
 * design this client converges on. The iOS values are copied here rather than
 * read from source because CI cannot reach that repository — so this list is
 * the baseline, and a palette change there is a change here, by hand.
 *
 * Only the base palette is checked: brand, surfaces, lines, ink, the four
 * semantic colours, and the solid container + text pair each of those uses.
 * Feature-specific colours on the iOS side (cycle phases, paywall, stress and
 * body-age charts, activity gold, teal) are deliberately absent here — this
 * client has none of those features — so they are not listed, and there is no
 * whitelist to keep.
 *
 * It checks values, not names: a colour can be renamed without failing this,
 * but it cannot be dropped, and it cannot drift to an approximation (the soft
 * containers were 12% rgba tints before they were the palette's own solids).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const BASE_PALETTE = {
  active: "#0e3880",
  navy: "#0d1e3a",
  "warm bg": "#f4f1ec",
  paper: "#fbfaf7",
  line: "#e8e4dc",
  "line-soft": "#efece5",
  ink: "#1a1a1a",
  "ink-soft": "#5c5a57",
  "ink-faint": "#9b9894",
  success: "#2f4a3a",
  "success bg": "#e6ede6",
  "success text": "#1f3328",
  warning: "#c07a3a",
  "warning bg": "#faf0e3",
  "warning text": "#8c5624",
  error: "#b03a2e",
  "error bg": "#fceaea",
  "error text": "#7a1f19",
  info: "#3b6b9c",
  "info bg": "#e4edf5",
  "info text": "#264867",
  gold: "#a88658",
  "gold bg": "#f5efe4",
  "gold text": "#6b5036",
};

// The light `:root` block only: its custom properties and their values.
const rootValues = () => {
  const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
  const root = css.match(/:root\s*\{([^}]*)\}/);
  if (!root) throw new Error("tokens.css has no :root block");
  const body = root[1].replace(/\/\*[\s\S]*?\*\//g, "");
  return [...body.matchAll(/--[\w-]+\s*:\s*([^;]+);/g)].map((m) =>
    m[1].trim().toLowerCase(),
  );
};

describe("tokens.css", () => {
  const values = rootValues();

  it.each(Object.entries(BASE_PALETTE))("carries %s (%s)", (_role, hex) => {
    expect(values).toContain(hex);
  });
});
