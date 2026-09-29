/**
 * Correcting a medication plan, as data: what the edit form holds, and the
 * PATCH that goes to `/api/v1/medications/{id}`.
 *
 * Plans are not typed in here. They come from 数据 › 记录, where a sentence
 * like "每天早晚吃二甲双胍500mg" becomes one; this form fixes what the reading
 * got wrong. So an edit sends only what changed: PATCH keeps every field it
 * is not sent, and a plan with several instructions ("morning 1, evening ½")
 * keeps them when only its name is corrected; the form shows one instruction
 * and never claims to edit more. Saving marks the plan confirmed, which is
 * what drops its "from your journal" label.
 *
 * The backend's instruction takes exactly one timing shape (clock times,
 * weekdays with optional times, or as needed), so the form picks one with
 * `frequency` rather than letting fields combine into something it refuses.
 */

/** `daily` is clock times; `daily_count` is "twice a day" with no clock,
 * which is how most sentences say it (每天早晚, 一天三次). */
export const FREQUENCIES = ["daily", "daily_count", "weekly", "as_needed"];
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]; // ISO: Monday = 1

/** Today's date where the browser is, not in UTC: at 07:00 in UTC+8,
 * `toISOString()` still says yesterday. */
export const localToday = (now = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const parseTimes = (text = "") =>
  text.split(/[,，;；\s]+/).map((t) => t.trim()).filter(Boolean);

/** The dose forms the backend knows (`res/dose_forms.tsv`), by annotation. */
const DOSE_FORMS = [
  "tablet", "capsule", "drop", "puff", "actuat", "spray", "patch", "sachet",
  "suppository", "ampule", "vial", "pill", "lozenge", "scoop", "dose", "application",
];

/** A dose form's annotation as the form's input shows it (`{tablet}` → 片). */
const formUnitLabel = (unit, t) => {
  const m = /^\{(\w+)\}$/.exec(String(unit || ""));
  return m && t ? t(`dose_form_${m[1]}`, m[1]) : String(unit || "");
};

/** Back from what the input holds to the annotation, so an untouched 片 is
 * the `{tablet}` it came from and opening a plan and saving changes nothing. */
const unitFromInput = (text, t) => {
  const raw = String(text || "").trim();
  const form = DOSE_FORMS.find((f) => raw === f || (t && raw === t(`dose_form_${f}`, f)));
  return form ? `{${form}}` : raw;
};

export const scheduleFromForm = (f, t) => {
  const dose = f.doseValue !== "" && f.doseValue != null
    ? { value: Number(f.doseValue), unit: unitFromInput(f.doseUnit, t) }
    : null;
  const text = String(f.instructions || "").trim();
  if (f.frequency === "as_needed") return [{ dose, as_needed: true, text }];
  if (f.frequency === "weekly") {
    return [{ dose, weekdays: [...f.weekdays].map(Number).sort((a, b) => a - b), times: parseTimes(f.times), text }];
  }
  if (f.frequency === "daily_count") return [{ dose, doses_per_day: Number(f.dosesPerDay) || 1, text }];
  return [{ dose, times: parseTimes(f.times), text }];
};

/** Doses a day for an instruction with no clock times: its count, or 1 for
 * "once a day", which the kernel stores as `period_days: 1`. */
const perDayOf = (i = {}) => Number(i.doses_per_day) || (i.period_days === 1 ? 1 : 0);

/** Whether this form can faithfully show the plan's schedule. */
export const scheduleEditable = (item) => (item?.schedule?.length || 0) <= 1;

export const formFromPlan = (item, today = localToday(), t = null) => {
  const first = item?.schedule?.[0] || {};
  const frequency = first.as_needed ? "as_needed"
    : first.weekdays?.length ? "weekly"
      : !first.times?.length && perDayOf(first) > 0 ? "daily_count" : "daily";
  return {
    name: item?.name || "", form: item?.form || "", strength: item?.strength || "",
    doseValue: first.dose?.value ?? "", doseUnit: formUnitLabel(first.dose?.unit || "mg", t),
    frequency, times: (first.times || []).join(", "), weekdays: [...(first.weekdays || [])],
    dosesPerDay: perDayOf(first) || 2, instructions: first.text || "",
    startDate: item?.start_date || today, endDate: item?.end_date || "",
  };
};

/** "08:00" and "8:00" are one time; the backend normalises, so compare as it does. */
const normTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t).trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}${m[3] ? `:${m[3]}` : ""}` : String(t).trim();
};

const scheduleKey = (instruction = {}) => JSON.stringify({
  dose: instruction.dose ? [Number(instruction.dose.value), String(instruction.dose.unit || "")] : null,
  times: [...(instruction.times || [])].map(normTime).sort(),
  weekdays: [...(instruction.weekdays || [])].map(Number).sort((a, b) => a - b),
  per_day: instruction.times?.length ? 0 : perDayOf(instruction),
  as_needed: !!instruction.as_needed,
  text: String(instruction.text || "").trim(),
});

/** Only the fields the person changed, against the plan as loaded. */
export const patchPayload = (f, item, t = null) => {
  const out = {};
  for (const [field, key] of [["name", "name"], ["form", "form"], ["strength", "strength"]]) {
    if (f[field].trim() !== (item[key] || "")) out[key] = f[field].trim();
  }
  if (scheduleEditable(item)) {
    const next = scheduleFromForm(f, t);
    if (scheduleKey(next[0]) !== scheduleKey(item.schedule?.[0])) out.schedule = next;
  }
  if (f.startDate && f.startDate !== item.start_date) out.start_date = f.startDate;
  const end = f.endDate || null;
  if (end !== (item.end_date || null)) out.end_date = end;
  // Saving is the person's word on it: the plan is theirs now, not the reader's.
  if (Object.keys(out).length && item.confirmed === false) out.confirmed = true;
  return out;
};

/** A dose unit as a reader says it. The backend speaks UCUM: a dose form is
 * an annotation (`{tablet}`, what 片 normalises to) and a unit may be
 * bracketed (`[IU]`); neither belongs on screen as is. */
export const doseUnitLabel = (unit, t) =>
  String(unit || "")
    .replace(/\{(\w+)\}/g, (_, form) => t(`dose_form_${form}`, form))
    .replace(/\[(\w+)\]/g, "$1");

/** One line saying how often, from the structure alone. `t` is i18next's. */
export const scheduleSummary = (item, t) => {
  const parts = (item?.schedule || []).map((i) => {
    const dose = i.dose ? `${i.dose.value} ${doseUnitLabel(i.dose.unit, t)}` : "";
    if (i.as_needed) return [dose, t("medications_frequency_as_needed")].filter(Boolean).join(" · ");
    const days = i.weekdays?.length ? i.weekdays.map((d) => t(`weekday_short_${d}`)).join(" ") : "";
    const times = (i.times || []).join(" / ");
    const perDay = !i.times?.length && !days && perDayOf(i) > 0 ? t("medications_per_day", { count: perDayOf(i) }) : "";
    return [dose, days, times, perDay].filter(Boolean).join(" · ");
  });
  return parts.filter(Boolean).join("; ");
};

/** The person's own words for the schedule, as written ("500mg 每天早晚，饭后"):
 * shown beside the summary, not folded into it, because a parsed sentence's
 * words repeat what the structure already says. */
export const scheduleWords = (item) =>
  (item?.schedule || []).map((i) => i.text).filter(Boolean).join("; ");
