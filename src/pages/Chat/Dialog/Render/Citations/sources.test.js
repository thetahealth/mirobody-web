import { describe, it, expect } from "vitest";
import { allGone, flagOf, sectionsOf, spanOf, when } from "./sources";

const glucose = (rid, value, time) => ({
  rid,
  status: "ok",
  kind: "reading",
  name: "Fasting Glucose",
  indicator: "Glucose [Moles/volume] in Serum or Plasma",
  value,
  unit: "mmol/L",
  time,
  source_kind: "file",
});

describe("cite sources", () => {
  it("puts the readings of one indicator in one section, in cite order", () => {
    const resolved = {
      r38: glucose("r38", "4.46", "2026-06-23 00:00:00"),
      r39: glucose("r39", "6.61", "2026-07-07 00:00:00"),
      r9: { rid: "r9", status: "ok", kind: "reading", name: "LDL", value: "3.8", unit: "mmol/L" },
    };
    const sections = sectionsOf(["r38", "r9", "r39", "r38"], resolved);
    expect(sections.map((s) => [s.type, s.name, s.items?.map((i) => i.id)])).toEqual([
      ["readings", "Fasting Glucose", ["r38", "r39"]],
      ["readings", "LDL", ["r9"]],
    ]);
  });

  it("shows a one-reading day bucket as that reading", () => {
    const r8 = {
      rid: "r8",
      status: "ok",
      kind: "aggregate",
      indicator: "体脂率",
      period: "2026-10-30",
      total: 1,
      readings: [{ time: "2026-10-30 00:00", value: "25.1", unit: "%", source_kind: "journal" }],
    };
    const [section] = sectionsOf(["r8"], { r8 });
    expect(section.type).toBe("readings");
    expect(section.items[0]).toMatchObject({ value: "25.1", indicator: "体脂率", id: "r8" });
    expect(sectionsOf(["r8"], { r8: { ...r8, total: 53 } })[0].type).toBe("aggregate");
  });

  it("says what it cannot show instead of dropping it", () => {
    const sections = sectionsOf(["r1", "r2", "r0", "/library/a.pdf#L3-L5", "ref:pmid:1"], {
      r2: { rid: "r2", status: "gone" },
      "ref:pmid:1": { status: "ok", title: "Guideline", source: "PubMed", url: "https://example.org" },
    });
    expect(sections.map((s) => s.type + ":" + (s.status || s.file || s.id))).toEqual([
      "status:loading",
      "status:gone",
      "status:unknown",
      "lines:a.pdf",
      "ref:ref:pmid:1",
    ]);
  });

  it("greys an anchor only when nothing behind it is left", () => {
    expect(allGone(["r1", "r2"], { r1: { status: "gone" }, r2: { status: "ok" } })).toBe(false);
    expect(allGone(["r1", "r0"], { r1: { status: "gone" } })).toBe(true);
    expect(allGone(["r1"], {})).toBe(false);
  });

  it("shows the clock only when it was recorded", () => {
    expect(when("2026-10-30 00:00:00")).toBe("2026-10-30");
    expect(when("2026-07-26 22:05:00")).toBe("2026-07-26 22:05");
    expect(when("2026-10-30")).toBe("2026-10-30");
    expect(when("")).toBe("");
  });

  it("reads the flags reports print", () => {
    expect([flagOf("high"), flagOf("H"), flagOf("↓"), flagOf("normal"), flagOf(""), flagOf("critical")]).toEqual([
      "high",
      "high",
      "low",
      "",
      "",
      "critical",
    ]);
  });

  it("names an aggregate's span", () => {
    expect(spanOf({ period: "2026-08" })).toBe("2026-08");
    expect(spanOf({ period: "2025-09-01", from: "2025-09-01", to: "2025-09-30" })).toBe("2025-09-01 – 2025-09-30");
    expect(spanOf({ from: "2025-09-15", to: "2026-09-14" })).toBe("2025-09-15 – 2026-09-14");
    expect(spanOf({ first_day: "2026-10-30", last_day: "2026-10-30" })).toBe("2026-10-30");
  });
});
