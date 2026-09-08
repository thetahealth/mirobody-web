import { describe, it, expect } from "vitest";
import { pendingBatches } from "./pendingBatches.js";

const v = (file_key, sessionId, date_source, report_date, extra = {}) => ({
  file_key, sessionId, date_source, report_date, file_name: file_key + ".jpg", ...extra,
});

describe("pendingBatches", () => {
  it("issue case 2: one report, three pages, page 1 dated → one bar offering that date to the other two", () => {
    const b = pendingBatches({
      s1: v("s1", "S", "extracted", "2025-08-15 00:00:00"),
      s2: v("s2", "S", "upload_time", "2026-09-03 12:01:00"),
      s3: v("s3", "S", "upload_time", "2026-09-03 12:01:00"),
    });
    expect(b).toHaveLength(1);
    expect(b[0].pending.map((p) => p.file_key)).toEqual(["s2", "s3"]);
    expect(b[0].candidates).toEqual(["2025-08-15"]);
    expect(b[0].total).toBe(3);
    expect(b[0].uploadDay).toBe("2026-09-03");
  });

  it("issue case 3: two dated reports and one undated in a selection → both dates offered, none assumed", () => {
    const b = pendingBatches({
      a: v("a", "S", "extracted", "2023-01-10 00:00:00"),
      b: v("b", "S", "extracted", "2024-06-01 00:00:00"),
      c: v("c", "S", "upload_time", "2026-09-03 12:01:00"),
    });
    expect(b[0].candidates).toEqual(["2024-06-01", "2023-01-10"]);
    expect(b[0].pending.map((p) => p.file_key)).toEqual(["c"]);
  });

  it("issue case 5: a whole selection without a date → a bar with no candidate (the picker is the answer)", () => {
    const b = pendingBatches({
      x: v("x", "S", "upload_time", "2026-09-03 12:01:00"),
      y: v("y", "S", "upload_time", "2026-09-03 12:01:00"),
    });
    expect(b).toHaveLength(1);
    expect(b[0].candidates).toEqual([]);
    expect(b[0].pending).toHaveLength(2);
  });

  it("separate selections never share a bar or a default", () => {
    const b = pendingBatches({
      p: v("p", "S1", "extracted", "2025-08-15 00:00:00"),
      q: v("q", "S2", "upload_time", "2026-09-03 12:01:00"),
    });
    expect(b).toHaveLength(1);
    expect(b[0].sessionId).toBe("S2");
    expect(b[0].candidates).toEqual([]);
  });

  it("nothing to ask when every file is dated, confirmed, or answered", () => {
    expect(pendingBatches({
      a: v("a", "S", "extracted", "2025-08-15 00:00:00"),
      b: v("b", "S", "manual", "2025-08-15 00:00:00"),
      c: v("c", "S", "upload_time", "2026-09-03 12:01:00", { date_confirmed: true }),
    })).toEqual([]);
    expect(pendingBatches({})).toEqual([]);
  });
});
