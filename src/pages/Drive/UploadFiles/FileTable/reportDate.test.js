import { describe, it, expect } from "vitest";
import { needsDateConfirm, reportDateOf, siblingReportDates } from "./reportDate.js";

const doc = (file_key, batch, date_source, report_date, create_time = "2026-09-03T12:01:00+08:00") => ({
  file_key, created_source_id: batch, date_source, report_date, create_time,
});

describe("reportDate", () => {
  it("asks only for upload-time dates the user has not confirmed", () => {
    expect(needsDateConfirm({ date_source: "upload_time" })).toBe(true);
    expect(needsDateConfirm({ date_source: "upload_time", date_confirmed: true })).toBe(false);
    expect(needsDateConfirm({ date_source: "extracted" })).toBe(false);
    expect(needsDateConfirm({ date_source: "manual" })).toBe(false);
    // files extracted before the label existed, or with no readings: nothing to ask
    expect(needsDateConfirm({})).toBe(false);
    expect(needsDateConfirm(null)).toBe(false);
  });

  it("reportDateOf keeps the day only", () => {
    expect(reportDateOf({ report_date: "2025-08-15 00:00:00" })).toBe("2025-08-15");
    expect(reportDateOf({})).toBe("");
  });

  // Issue case 2: three screenshots, one report, page 1 dated → the other pages
  // are OFFERED that date (never silently given it).
  it("offers the upload's extracted date to its undated siblings", () => {
    const files = [
      doc("s1", "m1", "extracted", "2025-08-15 00:00:00"),
      doc("s2", "m1", "upload_time", "2026-09-03 12:01:00"),
      doc("s3", "m1", "upload_time", "2026-09-03 12:01:00"),
    ];
    expect(siblingReportDates(files, files[1])).toEqual(["2025-08-15"]);
    expect(siblingReportDates(files, files[2])).toEqual(["2025-08-15"]);
  });

  // Issue case 3: two dated reports in one upload → both dates, newest first,
  // and the user picks; a third undated file is not assigned either one.
  it("lists every distinct date the upload carries", () => {
    const files = [
      doc("a", "m2", "extracted", "2023-01-10 00:00:00"),
      doc("b", "m2", "extracted", "2024-06-01 00:00:00"),
      doc("b2", "m2", "extracted", "2024-06-01 00:00:00"),
      doc("c", "m2", "upload_time", "2026-09-03 12:01:00"),
    ];
    expect(siblingReportDates(files, files[3])).toEqual(["2024-06-01", "2023-01-10"]);
  });

  it("a date the user set by hand on a sibling counts as an answer too", () => {
    const files = [
      doc("a", "m3", "manual", "2025-02-02 00:00:00"),
      doc("b", "m3", "upload_time", "2026-09-03 12:01:00"),
    ];
    expect(siblingReportDates(files, files[1])).toEqual(["2025-02-02"]);
  });

  it("one session per file: files uploaded within 15 minutes are siblings, later ones are not", () => {
    const files = [
      doc("p1", "s-a", "extracted", "2025-08-15 00:00:00", "2026-09-03T12:01:00+08:00"),
      doc("p2", "s-b", "upload_time", "2026-09-03 12:08:00", "2026-09-03T12:08:00+08:00"),
      doc("old", "s-c", "extracted", "2024-01-01 00:00:00", "2026-09-03T09:00:00+08:00"),
    ];
    expect(siblingReportDates(files, files[1])).toEqual(["2025-08-15"]);
  });

  it("another upload-time fallback is not a candidate, nor is the file itself", () => {
    const files = [
      doc("x", "m4", "upload_time", "2026-09-03 12:01:00"),
      doc("y", "m4", "upload_time", "2026-09-03 12:01:00"),
    ];
    expect(siblingReportDates(files, files[0])).toEqual([]);
    expect(siblingReportDates([], { file_key: "q" })).toEqual([]);
    expect(siblingReportDates(files, null)).toEqual([]);
  });
});
