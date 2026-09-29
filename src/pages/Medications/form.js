/**
 * The medication form, as data: what the inputs hold, and what goes to
 * `/api/v1/medications`.
 *
 * The backend's instruction takes exactly one timing shape (clock times,
 * weekdays with optional times, or as needed), so the form picks one with
 * `frequency` rather than letting fields combine into something it refuses.
 *
 * An edit sends only what changed. PATCH keeps every field it is not sent, so
 * a plan with several instructions (an import, or "morning 1, evening ½")
 * keeps them when only its name is corrected here; the form shows one
 * instruction and never claims to edit more.
 */

export const FREQUENCIES = ["daily", "weekly", "as_needed"];
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]; // ISO: Monday = 1

/** Today's date where the browser is, not in UTC: at 07:00 in UTC+8,
 * `toISOString()` still says yesterday. */
export const localToday = (now = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const emptyForm = (today = localToday()) => ({
  name: "", form: "", strength: "",
  doseValue: "", doseUnit: "mg",
  frequency: "daily", times: "", weekdays: [],
  startDate: today, endDate: "",
});

export const parseTimes = (text = "") =>
  text.split(/[,，;；\s]+/).map((t) => t.trim()).filter(Boolean);

export const scheduleFromForm = (f) => {
  const dose = f.doseValue !== "" && f.doseValue != null
    ? { value: Number(f.doseValue), unit: String(f.doseUnit || "").trim() }
    : null;
  if (f.frequency === "as_needed") return [{ dose, as_needed: true }];
  if (f.frequency === "weekly") {
    return [{ dose, weekdays: [...f.weekdays].map(Number).sort((a, b) => a - b), times: parseTimes(f.times) }];
  }
  return [{ dose, times: parseTimes(f.times) }];
};

/** Whether this form can faithfully show the plan's schedule. */
export const scheduleEditable = (item) => (item?.schedule?.length || 0) <= 1;

export const formFromPlan = (item, today = localToday()) => {
  const first = item?.schedule?.[0] || {};
  const frequency = first.as_needed ? "as_needed" : first.weekdays?.length ? "weekly" : "daily";
  return {
    name: item?.name || "", form: item?.form || "", strength: item?.strength || "",
    doseValue: first.dose?.value ?? "", doseUnit: first.dose?.unit || "mg",
    frequency, times: (first.times || []).join(", "), weekdays: [...(first.weekdays || [])],
    startDate: item?.start_date || today, endDate: item?.end_date || "",
  };
};

export const createPayload = (f) => ({
  name: f.name.trim(), form: f.form.trim(), strength: f.strength.trim(),
  schedule: scheduleFromForm(f),
  start_date: f.startDate,
  end_date: f.endDate || null,
});

/** "08:00" and "8:00" are one time; the backend normalises, so compare as it does. */
const normTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t).trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}${m[3] ? `:${m[3]}` : ""}` : String(t).trim();
};

const scheduleKey = (instruction = {}) => JSON.stringify({
  dose: instruction.dose ? [Number(instruction.dose.value), String(instruction.dose.unit || "")] : null,
  times: [...(instruction.times || [])].map(normTime).sort(),
  weekdays: [...(instruction.weekdays || [])].map(Number).sort((a, b) => a - b),
  as_needed: !!instruction.as_needed,
});

/** Only the fields the person changed, against the plan as loaded. */
export const patchPayload = (f, item) => {
  const out = {};
  for (const [field, key] of [["name", "name"], ["form", "form"], ["strength", "strength"]]) {
    if (f[field].trim() !== (item[key] || "")) out[key] = f[field].trim();
  }
  if (scheduleEditable(item)) {
    const next = scheduleFromForm(f);
    if (scheduleKey(next[0]) !== scheduleKey(item.schedule?.[0])) out.schedule = next;
  }
  if (f.startDate && f.startDate !== item.start_date) out.start_date = f.startDate;
  const end = f.endDate || null;
  if (end !== (item.end_date || null)) out.end_date = end;
  return out;
};

/** One line saying how often, for a card. `t` is i18next's. */
export const scheduleSummary = (item, t) => {
  const parts = (item?.schedule || []).map((i) => {
    const dose = i.dose ? `${i.dose.value} ${i.dose.unit}` : "";
    if (i.as_needed) return [dose, t("medications_frequency_as_needed")].filter(Boolean).join(" · ");
    const days = i.weekdays?.length ? i.weekdays.map((d) => t(`weekday_short_${d}`)).join(" ") : "";
    const times = (i.times || []).join(" / ");
    return [dose, days, times].filter(Boolean).join(" · ");
  });
  return parts.filter(Boolean).join("; ");
};
