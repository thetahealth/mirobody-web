import { describe, expect, it } from "vitest";
import { formatUiDate } from "./date.js";

describe("formatUiDate", () => {
  it("uses Russian date and time order for Russian UI", () => {
    expect(formatUiDate("2026-11-24T09:07:05", "ru")).toBe("24.11.2026");
    expect(formatUiDate("2026-11-24T09:07:05", "ru-RU", { time: true })).toBe(
      "24.11.2026 09:07",
    );
    expect(
      formatUiDate("2026-11-24T09:07:05", "ru", { time: true, seconds: true }),
    ).toBe("24.11.2026 09:07:05");
  });

  it("preserves the existing format for other language bundles", () => {
    expect(formatUiDate("2026-11-24T09:07:05", "en", { time: true })).toBe(
      "2026-11-24 09:07",
    );
  });

  it("returns an empty string when there is no date", () => {
    expect(formatUiDate(null, "ru")).toBe("");
  });
});
