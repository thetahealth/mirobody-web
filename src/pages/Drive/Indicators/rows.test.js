import { describe, it, expect } from "vitest";
import { toTableRows, toReadingList, truncationOf } from "./rows";

// Fixtures copy the server's own row builders field for field (`_catalog_row` /
// `_reading_row` in mirobody/pulse/query.py, wrapped in `render_rest`), so a
// changed key fails here instead of on screen (issue #62).
const catalogEnvelope = {
  rows: [
    {
      indicator: "bodyMasss",
      system: "loinc",
      code: "29463-7",
      count: 6,
      unit: "kg",
      latest_value: "69.6",
      first_date: "2025-03-03",
      last_date: "2025-04-07",
      total: 6,
      day_known: true,
    },
    {
      indicator: "hemoglobin",
      system: "",
      code: "",
      count: 1,
      unit: "g/L",
      latest_value: "141",
      first_date: "2025-01-09",
      last_date: "2025-01-09",
      total: 6,
      day_known: true,
    },
  ],
  count: 2,
  total: 2,
  truncated: false,
  resolution: "raw",
  aggregate: "none",
  status: "ok",
};

const readingsEnvelope = {
  rows: [
    {
      indicator: "bodyMasss",
      time: "2025-04-07 08:00:00",
      value: "69.6",
      unit: "kg",
      file_key: "f_2f9c",
      row_id: 558281,
      system: "loinc",
      code: "29463-7",
      total: 6,
      day_known: true,
      provenance: "measured",
    },
    {
      indicator: "bodyMasss",
      time: "2025-03-03 08:00:00",
      value: "71.2",
      unit: "kg",
      file_key: "",
      row_id: 558280,
      system: "loinc",
      code: "29463-7",
      total: 6,
      day_known: true,
      provenance: "measured",
    },
  ],
  count: 2,
  total: 2,
  truncated: false,
  resolution: "raw",
  aggregate: "none",
  status: "ok",
};

describe("toTableRows — catalog grain", () => {
  const rows = toTableRows(catalogEnvelope);

  it("keeps one row per indicator, with its own count", () => {
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.indicator)).toEqual(["bodyMasss", "hemoglobin"]);
    // The row's count, not the length of a readings array it does not carry.
    expect(rows[0].count).toBe(6);
  });

  it("reads the latest value and its date off the row", () => {
    expect(rows[0].latest_value).toBe("69.6");
    expect(rows[0].latest_time).toBe("2025-04-07");
    expect(rows[0].unit).toBe("kg");
  });

  it("carries the code when there is one, and no em-dash placeholder when not", () => {
    expect(rows[0].code).toBe("29463-7");
    expect(rows[0].system).toBe("loinc");
    expect(rows[1].code).toBe("");
  });

  it("has no readings — the drawer fetches them", () => {
    expect(rows[0].readings).toEqual([]);
  });
});

describe("toTableRows — readings grain", () => {
  const rows = toTableRows(readingsEnvelope);

  it("groups readings into one row per indicator", () => {
    expect(rows).toHaveLength(1);
    expect(rows[0].indicator).toBe("bodyMasss");
    expect(rows[0].readings).toHaveLength(2);
  });

  it("counts the whole series, not the returned page", () => {
    // `limit` caps what arrives; `total` counts everything.
    expect(rows[0].count).toBe(6);
  });

  it("picks the newest reading as the latest, whatever order rows arrive in", () => {
    expect(rows[0].latest_value).toBe("69.6");
    expect(rows[0].latest_time).toBe("2025-04-07 08:00:00");

    const reversed = { ...readingsEnvelope, rows: [...readingsEnvelope.rows].reverse() };
    expect(toTableRows(reversed)[0].latest_value).toBe("69.6");
  });
});

describe("toReadingList", () => {
  it("maps row_id to id, because that is what the edit and delete buttons need", () => {
    const readings = toReadingList(readingsEnvelope);
    expect(readings[0].id).toBe(558281);
    expect(readings.every((r) => r.id != null)).toBe(true);
  });

  it("keeps value, unit, time and the source file handle", () => {
    const [first] = toReadingList(readingsEnvelope);
    expect(first).toMatchObject({
      indicator: "bodyMasss",
      value: "69.6",
      unit: "kg",
      time: "2025-04-07 08:00:00",
      file_key: "f_2f9c",
    });
  });

  it("returns nothing for a catalog answer", () => {
    // What a no-match search falls back to.
    expect(toReadingList(catalogEnvelope)).toEqual([]);
  });
});

describe("empty and malformed answers", () => {
  it("survives an empty, missing or non-array rows key", () => {
    for (const res of [{ rows: [] }, {}, undefined, { rows: null }]) {
      expect(toTableRows(res)).toEqual([]);
      expect(toReadingList(res)).toEqual([]);
    }
  });

  it("skips rows with no indicator name", () => {
    const res = { rows: [{ ...readingsEnvelope.rows[0], indicator: "" }] };
    expect(toTableRows(res)).toEqual([]);
  });
});

describe("truncationOf", () => {
  it("is null when the answer is complete", () => {
    expect(truncationOf(catalogEnvelope)).toBeNull();
    expect(truncationOf({ rows: [], truncated: false })).toBeNull();
  });

  it("reports shown-of-total when the server capped the catalog", () => {
    expect(
      truncationOf({ rows: new Array(2000).fill(catalogEnvelope.rows[0]), total: 2400, truncated: true }),
    ).toEqual({ shown: 2000, total: 2400 });
  });

  it("stays quiet when the flag is set but nothing was actually left out", () => {
    expect(truncationOf({ rows: [1, 2], total: 2, truncated: true })).toBeNull();
  });
});
