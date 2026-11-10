import { describe, it, expect } from "vitest";
import { hasProcessingRows, rowActions } from "./rowActions.js";

describe("rowActions", () => {
  it("cancels an upload still in flight instead of deleting it", () => {
    // thetahealth/mirobody#240: the in-flight row offered 删除, the server had
    // nothing to delete yet, and the upload was filed minutes later.
    for (const upload_status of ["uploading", "received", "processing"]) {
      expect(rowActions({ isUploading: true, upload_status })).toEqual(["cancel"]);
    }
    expect(rowActions({ isUploading: true, upload_status: "failed" })).toEqual(["delete"]);
  });

  it("offers to read a failed file again", () => {
    expect(rowActions({ upload_status: "failed", file_key: "k" })).toEqual(["reprocess", "delete"]);
  });

  it("deletes a file the server is still reading, and views a finished one", () => {
    expect(rowActions({ upload_status: "processing", file_key: "k" })).toEqual(["delete"]);
    expect(rowActions({ upload_status: "complete" })).toEqual(["view", "delete"]);
    expect(rowActions({ upload_status: "complete", date_source: "upload_time" })).toEqual([
      "view", "set_report_date", "delete",
    ]);
    expect(rowActions(null)).toEqual([]);
  });

  it("asks again only while the server lists a file as processing", () => {
    expect(hasProcessingRows([{ upload_status: "complete" }, { upload_status: "processing" }])).toBe(true);
    expect(hasProcessingRows([{ isUploading: true, upload_status: "processing" }])).toBe(false);
    expect(hasProcessingRows([{ upload_status: "failed" }])).toBe(false);
    expect(hasProcessingRows(undefined)).toBe(false);
  });
});
