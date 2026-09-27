# Genomics data page: backend contract

The `feat/genomics-upload` page uses the existing WebSocket upload protocol. It sends one raw export per `upload_start`/`upload_chunk`/`upload_end` session with `query_user_id` set to the selected Drive person and a caller-generated `messageId`. The server sniffs content rather than trusting the filename or browser MIME type. The upload extension gate and genetic handler accept supported vendor text/CSV, VCF, gzip and single-member ZIP exports.

An initial `upload_completed` means the file was received, **not** that a new genotype set is active. The page waits for `upload_completed` with the same `messageId`, `status: "completed"` and `genetic_processing_final: true`. `upload_error` or `upload_completed` with `status: "failed"` leaves the previous set active. Processing progress uses `upload_progress` with the same `messageId`, numeric `progress` (0–100) and `status: "processing"`. Messages must be scoped to the selected person's WebSocket connection. The browser displays counts and state only; no genotype rows are sent to this page.

## Active collection summary

`GET /api/v1/genomics/active-set?target_user_id=<selected-person-id>` uses the standard `{code: 0, data: ...}` envelope and the same bearer token and care-circle read authorization as other `/api/v1` data routes. Omitting `target_user_id` means the caller. A successful response has this exact `data` shape:

```json
{
  "active_set": {
    "id": 42,
    "status": "active",
    "format_id": "23andme_genotype",
    "vendor": "23andMe",
    "build_declared": "GRCh37",
    "build_detected": "GRCh37",
    "n_rows": 1000,
    "n_called": 947,
    "sex_inferred": "unknown",
    "pgx_decidable_genes": null,
    "activated_at": "2026-09-26T12:00:00Z"
  }
}
```

The example values are illustrative, not a patient record. `active_set` is `null` when the person has no active collection. The endpoint must never return a `loading`, `failed` or `superseded` set. `n_rows` is a positive integer; `n_called` is an integer from zero through `n_rows`. The client derives call rate as `n_called / n_rows`. `vendor`, `build_declared`, `build_detected`, `sex_inferred`, `pgx_decidable_genes` and `activated_at` may be null/unknown while normalization or PGx knowledge is unavailable; the UI omits or labels unknown fields without fabricating values. For a replacement, the endpoint continues to return the old active set until the atomic activation transaction commits, then returns the new set.

The endpoint is implemented in the backend 1.5.2 branch. A 404 shows “summary unavailable” rather than “no data.” Other errors show a retryable load error. The frontend still shows upload processing state and never claims that a newly received file has become active.
