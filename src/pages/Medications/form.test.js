import { describe, it, expect } from "vitest";

import {
  createPayload, emptyForm, formFromPlan, localToday, parseTimes,
  patchPayload, scheduleEditable, scheduleFromForm, scheduleSummary,
} from "./form.js";

const plan = (over = {}) => ({
  plan_id: "p1", name: "Metformin", form: "tablet", strength: "500 mg",
  schedule: [{ dose: { value: 500, unit: "mg" }, times: ["08:00", "20:00"], weekdays: [], as_needed: false }],
  start_date: "2026-09-01", end_date: null, ...over,
});

describe("localToday", () => {
  it("is the browser's date, not UTC's", () => {
    // 2026-09-29 07:00 in UTC+8 is still the 28th in UTC.
    const d = new Date(2026, 8, 29, 7, 0, 0);
    expect(localToday(d)).toBe("2026-09-29");
  });
});

describe("the form's schedule", () => {
  it("takes one timing shape at a time", () => {
    const f = { ...emptyForm("2026-09-29"), doseValue: "1", doseUnit: "tablet", times: "8:00, 20:00" };
    expect(scheduleFromForm(f)).toEqual([{ dose: { value: 1, unit: "tablet" }, times: ["8:00", "20:00"] }]);
    expect(scheduleFromForm({ ...f, frequency: "weekly", weekdays: [5, 1] }))
      .toEqual([{ dose: { value: 1, unit: "tablet" }, weekdays: [1, 5], times: ["8:00", "20:00"] }]);
    expect(scheduleFromForm({ ...f, frequency: "as_needed" }))
      .toEqual([{ dose: { value: 1, unit: "tablet" }, as_needed: true }]);
  });

  it("reads times written with Chinese punctuation too", () => {
    expect(parseTimes("08:00，20:00；12:00")).toEqual(["08:00", "20:00", "12:00"]);
  });

  it("sends no dose rather than a zero dose when none is given", () => {
    expect(createPayload({ ...emptyForm("2026-09-29"), name: " Vitamin D " }))
      .toEqual({ name: "Vitamin D", form: "", strength: "", schedule: [{ dose: null, times: [] }],
                 start_date: "2026-09-29", end_date: null });
  });
});

describe("editing", () => {
  it("round-trips a plan into the form without a change", () => {
    const item = plan();
    expect(patchPayload(formFromPlan(item), item)).toEqual({});
  });

  it("sends only what changed", () => {
    const item = plan();
    const f = { ...formFromPlan(item), strength: "850 mg", endDate: "2026-12-31" };
    expect(patchPayload(f, item)).toEqual({ strength: "850 mg", end_date: "2026-12-31" });
  });

  it("sends the schedule when a time changes, and not for 8:00 vs 08:00", () => {
    const item = plan();
    expect(patchPayload({ ...formFromPlan(item), times: "8:00, 20:00" }, item)).toEqual({});
    expect(patchPayload({ ...formFromPlan(item), times: "08:00" }, item).schedule)
      .toEqual([{ dose: { value: 500, unit: "mg" }, times: ["08:00"] }]);
  });

  it("never overwrites a plan with several instructions from a one-instruction form", () => {
    const item = plan({ schedule: [
      { dose: { value: 1, unit: "tablet" }, times: ["08:00"] },
      { dose: { value: 0.5, unit: "tablet" }, times: ["20:00"] },
    ] });
    expect(scheduleEditable(item)).toBe(false);
    const f = { ...formFromPlan(item), name: "Metformin XR", times: "12:00" };
    expect(patchPayload(f, item)).toEqual({ name: "Metformin XR" });
  });

  it("clears an end date with null", () => {
    const item = plan({ end_date: "2026-10-01" });
    expect(patchPayload({ ...formFromPlan(item), endDate: "" }, item)).toEqual({ end_date: null });
  });
});

describe("scheduleSummary", () => {
  const t = (k) => ({ medications_frequency_as_needed: "as needed", weekday_short_1: "Mon", weekday_short_5: "Fri" }[k] || k);
  it("says dose, days and times", () => {
    expect(scheduleSummary(plan(), t)).toBe("500 mg · 08:00 / 20:00");
    expect(scheduleSummary(plan({ schedule: [{ dose: null, weekdays: [1, 5], times: [] }] }), t)).toBe("Mon Fri");
    expect(scheduleSummary(plan({ schedule: [{ dose: { value: 1, unit: "puff" }, as_needed: true }] }), t))
      .toBe("1 puff · as needed");
  });
});
