import { describe, expect, it } from "vitest";
import { formatFileSize } from "./file.js";

describe("formatFileSize", () => {
  it("uses the active locale for decimal separators", () => {
    expect(formatFileSize(1536, "ru")).toBe("1,50 KB");
  });
});
