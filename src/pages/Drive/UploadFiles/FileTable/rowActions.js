// Which buttons a Data-page file row offers, by where the file is in its life
// (thetahealth/mirobody#241).
//
// An upload still in flight has no file row on the server until processing
// ends, only this page's own row, whose id is the upload's message id. It is
// cancelled, not deleted: the server records the cancel and files nothing.
// A file the server lists as `processing` is having its readings extracted;
// deleting it stops them from being kept. A failed file can be read again.

const settled = (status) => status === "complete" || status === "failed";

export const rowActions = (row) => {
  if (!row) return [];
  if (row.isUploading) {
    return settled(row.upload_status) ? ["delete"] : ["cancel"];
  }
  switch (row.upload_status) {
    case "failed":
      return ["reprocess", "delete"];
    case "complete":
      // only files that produced readings carry a date_source
      return row.date_source ? ["view", "set_report_date", "delete"] : ["view", "delete"];
    default:
      return ["delete"];
  }
};

// Whether the server lists a file still being read. A reprocessed file has no
// upload socket to announce its end, so the page asks again while one does.
export const hasProcessingRows = (rows) =>
  (rows || []).some((row) => !row.isUploading && row.upload_status === "processing");

// How long the page waits before asking again.
export const PROCESSING_POLL_MS = 5000;
