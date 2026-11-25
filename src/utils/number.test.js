import { describe, expect, it } from "vitest";
import { formatUiNumber } from "./number.js";

describe("formatUiNumber", () => {
  it("uses Russian decimal and grouping separators without dropping precision", () => {
    expect(formatUiNumber("1234.50", "ru")).toBe("1 234,50");
    expect(formatUiNumber("−2.125", "ru-RU")).toBe("-2,125");
  });

  it("leaves non-numeric clinical text and other locale output unchanged", () => {
    expect(formatUiNumber("128/78", "ru")).toBe("128/78");
    expect(formatUiNumber("negative", "ru")).toBe("negative");
    expect(formatUiNumber("1234.50", "en")).toBe("1234.50");
  });
});
