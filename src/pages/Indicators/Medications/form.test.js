import { describe, it, expect } from "vitest";

import {
  doseUnitLabel, formFromPlan, localToday, parseTimes, patchPayload, scheduleEditable, scheduleFromForm, scheduleSummary, scheduleWords,
} from "./form.js";

const plan = (over = {}) => ({
  plan_id: "p1", name: "Metformin", form: "tablet", strength: "500 mg", confirmed: true,
  schedule: [{ dose: { value: 500, unit: "mg" }, times: ["08:00", "20:00"], weekdays: [], as_needed: false, text: "" }],
  start_date: "2026-09-01", end_date: null, ...over,
});

describe("localToday", () => {
  it("is the browser's date, not UTC's", () => {
    // 2026-09-29 07:00 in UTC+8 is still the 28th in UTC.
    expect(localToday(new Date(2026, 8, 29, 7, 0, 0))).toBe("2026-09-29");
  });
});

describe("the form's schedule", () => {
  const base = formFromPlan(plan());

  it("takes one timing shape at a time, a dose form as its annotation", () => {
    const f = { ...base, doseValue: "1", doseUnit: "tablet", times: "8:00, 20:00" };
    expect(scheduleFromForm(f)).toEqual([{ dose: { value: 1, unit: "{tablet}" }, times: ["8:00", "20:00"], text: "" }]);
    expect(scheduleFromForm({ ...f, frequency: "weekly", weekdays: [5, 1] }))
      .toEqual([{ dose: { value: 1, unit: "{tablet}" }, weekdays: [1, 5], times: ["8:00", "20:00"], text: "" }]);
    expect(scheduleFromForm({ ...f, frequency: "as_needed" }))
      .toEqual([{ dose: { value: 1, unit: "{tablet}" }, as_needed: true, text: "" }]);
    expect(scheduleFromForm({ ...f, frequency: "daily_count", dosesPerDay: "2", instructions: " 饭后 " }))
      .toEqual([{ dose: { value: 1, unit: "{tablet}" }, doses_per_day: 2, text: "饭后" }]);
  });

  it("reads times written with Chinese punctuation too", () => {
    expect(parseTimes("08:00，20:00；12:00")).toEqual(["08:00", "20:00", "12:00"]);
  });
});

describe("editing", () => {
  it("round-trips a plan into the form without a change", () => {
    const item = plan();
    expect(patchPayload(formFromPlan(item), item)).toEqual({});
  });

  it("reads 每天早晚 (two a day, no clock) as a count, and round-trips it", () => {
    const item = plan({ schedule: [{ dose: { value: 500, unit: "mg" }, times: [], doses_per_day: 2, weekdays: [], text: "" }] });
    const f = formFromPlan(item);
    expect([f.frequency, f.dosesPerDay]).toEqual(["daily_count", 2]);
    expect(patchPayload(f, item)).toEqual({});
  });

  it("reads once a day (period_days 1) as one a day, without a spurious change", () => {
    const item = plan({ schedule: [{ dose: null, times: [], doses_per_day: 0, period_days: 1, weekdays: [], text: "" }] });
    const f = formFromPlan(item);
    expect([f.frequency, f.dosesPerDay]).toEqual(["daily_count", 1]);
    expect(patchPayload(f, item)).toEqual({});
  });

  it("sends only what changed", () => {
    const item = plan();
    const f = { ...formFromPlan(item), strength: "850 mg", endDate: "2026-12-31" };
    expect(patchPayload(f, item)).toEqual({ strength: "850 mg", end_date: "2026-12-31" });
  });

  it("confirms a plan the journal made once the person saves a change to it", () => {
    const item = plan({ confirmed: false });
    expect(patchPayload({ ...formFromPlan(item), strength: "850 mg" }, item))
      .toEqual({ strength: "850 mg", confirmed: true });
    expect(patchPayload(formFromPlan(item), item)).toEqual({}, "no change, nothing to confirm");
  });

  it("sends the schedule when a time or the instructions change, and not for 8:00 vs 08:00", () => {
    const item = plan();
    expect(patchPayload({ ...formFromPlan(item), times: "8:00, 20:00" }, item)).toEqual({});
    expect(patchPayload({ ...formFromPlan(item), times: "08:00" }, item).schedule)
      .toEqual([{ dose: { value: 500, unit: "mg" }, times: ["08:00"], text: "" }]);
    expect(patchPayload({ ...formFromPlan(item), instructions: "饭后" }, item).schedule[0].text).toBe("饭后");
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

  it("shows a dose form in words and saves it back unchanged", () => {
    const t = (k, fallback) => ({ dose_form_tablet: "片" }[k] || fallback);
    const item = plan({ schedule: [{ dose: { value: 1, unit: "{tablet}" }, times: ["21:00"], text: "" }] });
    const f = formFromPlan(item, "2026-09-29", t);
    expect(f.doseUnit).toBe("片");
    expect(patchPayload(f, item, t)).toEqual({});
    expect(patchPayload({ ...f, doseValue: "2" }, item, t).schedule[0].dose).toEqual({ value: 2, unit: "{tablet}" });
  });

  it("clears an end date with null", () => {
    const item = plan({ end_date: "2026-10-01" });
    expect(patchPayload({ ...formFromPlan(item), endDate: "" }, item)).toEqual({ end_date: null });
  });
});

describe("scheduleSummary", () => {
  const t = (k, o) => ({
    medications_frequency_as_needed: "as needed", weekday_short_1: "Mon", weekday_short_5: "Fri",
    medications_per_day: `${o?.count}x a day`,
  }[k] || k);
  it("says dose, days, times and count; the person's words stand apart", () => {
    expect(scheduleSummary(plan(), t)).toBe("500 mg · 08:00 / 20:00");
    expect(scheduleSummary(plan({ schedule: [{ dose: null, weekdays: [1, 5], times: [] }] }), t)).toBe("Mon Fri");
    expect(scheduleSummary(plan({ schedule: [{ dose: { value: 1, unit: "puff" }, as_needed: true }] }), t))
      .toBe("1 puff · as needed");
    const parsed = plan({ schedule: [{ dose: { value: 500, unit: "mg" }, times: [], doses_per_day: 2, text: "500mg 每天早晚，饭后" }] });
    expect(scheduleSummary(parsed, t)).toBe("500 mg · 2x a day");
    expect(scheduleWords(parsed)).toBe("500mg 每天早晚，饭后");
  });
});

describe("doseUnitLabel", () => {
  const t = (k, fallback) => ({ dose_form_tablet: "片" }[k] || fallback);
  it("says a dose form in words and drops UCUM's brackets", () => {
    expect(doseUnitLabel("{tablet}", t)).toBe("片");
    expect(doseUnitLabel("{lozenge}", t)).toBe("lozenge");
    expect(doseUnitLabel("[IU]", t)).toBe("IU");
    expect(doseUnitLabel("mg/{tablet}", t)).toBe("mg/片");
    expect(doseUnitLabel("mg", t)).toBe("mg");
  });
});
