import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { message, Popconfirm, Spin } from "antd";
import api from "../../../api";
import { useDriveStore } from "../../../store/Drive";
import { useAccountStore } from "../../../store/account";
import {
  FREQUENCIES, WEEKDAYS, formFromPlan, localToday, patchPayload, scheduleEditable, scheduleSummary, scheduleWords,
} from "./form";
import styles from "./index.module.scss";

/**
 * 指标 › 用药: the medication plans, as the rest of 指标 shows readings.
 *
 * Nothing is typed in here. A plan comes from 数据 › 记录, where "每天早晚吃
 * 二甲双胍500mg" is read into one; this tab lists them, stops and resumes
 * them, shows each one's courses, and corrects what the reading got wrong. A
 * plan the journal made carries a "from your journal" tag until the person
 * saves a correction to it.
 *
 * A family member with a read grant sees the list and each plan's history;
 * only the record's owner gets the buttons (the backend refuses the writes
 * anyway). "Due" and "missed" are not shown: they are computed from the clock
 * on read, and this tab is about the plans themselves.
 */

const History = ({ planId }) => {
  const { t } = useTranslation();
  const [courses, setCourses] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api.getMedication(planId, controller.signal)
      .then((plan) => setCourses(plan?.courses || []))
      .catch(() => {
        if (!controller.signal.aborted) setCourses([]);
      });
    return () => controller.abort();
  }, [planId]);
  if (courses === null) return <Spin size="small" />;
  if (!courses.length) return <p className={styles.history}>{t("medications_history_empty")}</p>;
  return (
    <ol className={styles.history}>
      {/* Stopped and resumed on one day, two courses share both dates. */}
      {courses.map((c, i) => (
        <li key={`${i}:${c.start_date}`}>
          {c.start_date} → {c.end_date || t("medications_course_open")}
          {c.closed_by ? ` · ${t(`medications_course_${c.closed_by}`, c.closed_by)}` : ""}
        </li>
      ))}
    </ol>
  );
};

const EditForm = ({ item, onSaved, onCancel }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => formFromPlan(item, localToday(), t));
  const [saving, setSaving] = useState(false);
  const change = (event) => setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  const toggleWeekday = (day) => setForm((old) => ({
    ...old,
    weekdays: old.weekdays.includes(day) ? old.weekdays.filter((d) => d !== day) : [...old.weekdays, day],
  }));
  const locked = !scheduleEditable(item);

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (!locked && form.frequency === "weekly" && !form.weekdays.length) {
      message.error(t("medications_weekdays_required"));
      return;
    }
    const changes = patchPayload(form, item, t);
    if (!Object.keys(changes).length) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await api.updateMedication(item.plan_id, changes);
      message.success(t("medications_saved"));
      onSaved();
    } catch {
      message.error(t("medications_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={save}>
      <div className={styles.row}>
        <input name="name" value={form.name} onChange={change} placeholder={t("medications_name")} required />
        <input name="strength" value={form.strength} onChange={change} placeholder={t("medications_strength")} />
        <input name="form" value={form.form} onChange={change} placeholder={t("medications_form")} />
      </div>
      {locked ? (
        <p className={styles.note}>{t("medications_schedule_locked")}</p>
      ) : (
        <>
          <div className={styles.row}>
            <input name="doseValue" type="number" min="0" step="any" value={form.doseValue} onChange={change} placeholder={t("medications_dose")} />
            <input name="doseUnit" value={form.doseUnit} onChange={change} aria-label={t("medications_unit")} />
            <label>
              {t("medications_frequency")}
              <select name="frequency" value={form.frequency} onChange={change}>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{t(`medications_frequency_${f}`)}</option>)}
              </select>
            </label>
          </div>
          {form.frequency === "weekly" && (
            <div className={styles.weekdays} role="group" aria-label={t("medications_weekdays")}>
              {WEEKDAYS.map((d) => (
                <button
                  type="button" key={d}
                  className={form.weekdays.includes(d) ? styles.dayOn : styles.day}
                  aria-pressed={form.weekdays.includes(d)}
                  onClick={() => toggleWeekday(d)}
                >
                  {t(`weekday_short_${d}`)}
                </button>
              ))}
            </div>
          )}
          {form.frequency === "daily_count" ? (
            <label className={styles.inline}>
              {t("medications_doses_per_day")}
              <input name="dosesPerDay" type="number" min="1" max="24" value={form.dosesPerDay} onChange={change} />
            </label>
          ) : form.frequency !== "as_needed" ? (
            <input name="times" value={form.times} onChange={change} placeholder={t("medications_times")} />
          ) : null}
          <input name="instructions" value={form.instructions} onChange={change} placeholder={t("medications_instructions")} maxLength={500} />
        </>
      )}
      <div className={styles.row}>
        <label>{t("medications_start")}<input name="startDate" type="date" value={form.startDate} onChange={change} required /></label>
        <label>{t("medications_end")}<input name="endDate" type="date" value={form.endDate} onChange={change} /></label>
      </div>
      <div className={styles.actions}>
        <button type="submit" disabled={saving}>{saving ? t("saving") : t("medications_update")}</button>
        <button type="button" className={styles.ghost} onClick={onCancel}>{t("cancel")}</button>
      </div>
    </form>
  );
};

const Medications = () => {
  const { t } = useTranslation();
  const targetUserId = useDriveStore((state) => state.current_drive_user_id);
  const beneficiaries = useAccountStore((state) => state.beneficiary_users);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);
  const isOwnRecord = useMemo(() => {
    const me = beneficiaries?.find?.((user) => user.is_current_user);
    return !me || !targetUserId || String(me.id) === String(targetUserId);
  }, [beneficiaries, targetUserId]);

  useEffect(() => {
    const controller = new AbortController();
    api.listMedications({ target_user_id: targetUserId }, controller.signal)
      .then((result) => setItems(result?.items || []))
      .catch(() => {
        if (!controller.signal.aborted) message.error(t("medications_load_failed"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [t, targetUserId, reloads]);

  const reload = () => setReloads((n) => n + 1);

  const transition = async (item, action) => {
    try {
      await api[action](item.plan_id);
      if (editing === item.plan_id) setEditing(null);
      reload();
    } catch {
      message.error(t("medications_action_failed"));
    }
  };

  if (loading) return <div className={styles.center}><Spin /></div>;
  if (!items.length) {
    return (
      <div className={styles.empty}>
        <p>{t("medications_empty")}</p>
        <p className={styles.emptyHint}>{t("medications_empty_hint")}</p>
        {isOwnRecord && <Link to="/data?tab=records" className={styles.emptyLink}>{t("medications_empty_link")}</Link>}
      </div>
    );
  }
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <article className={styles.card} key={item.plan_id}>
          {editing === item.plan_id ? (
            <EditForm item={item} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
          ) : (
            <>
              <div className={styles.cardMain}>
                <h3>
                  {item.name}{item.strength ? ` · ${item.strength}` : ""}
                  {item.confirmed === false && <span className={styles.tag}>{t("medications_from_journal")}</span>}
                </h3>
                <p>{scheduleSummary(item, t)}</p>
                {scheduleWords(item) ? <p className={styles.words}>“{scheduleWords(item)}”</p> : null}
                <small>{item.start_date}{item.end_date ? ` → ${item.end_date}` : ""}</small>
                {historyOf === item.plan_id && <History planId={item.plan_id} />}
              </div>
              <div className={styles.cardActions}>
                <span className={styles[item.effective_status] || ""}>
                  {t(`medications_status_${item.effective_status}`, item.effective_status)}
                </span>
                <button type="button" className={styles.ghost} onClick={() => setHistoryOf(historyOf === item.plan_id ? null : item.plan_id)}>
                  {t("medications_history")}
                </button>
                {isOwnRecord && item.status === "active" && (
                  <button type="button" onClick={() => transition(item, "stopMedication")}>{t("medications_stop")}</button>
                )}
                {isOwnRecord && item.status === "stopped" && (
                  <button type="button" onClick={() => transition(item, "resumeMedication")}>{t("medications_resume")}</button>
                )}
                {isOwnRecord && <button type="button" className={styles.ghost} onClick={() => setEditing(item.plan_id)}>{t("edit")}</button>}
                {isOwnRecord && (
                  <Popconfirm title={t("medications_delete_confirm")} onConfirm={() => transition(item, "deleteMedication")}>
                    <button type="button" className={styles.danger}>{t("delete")}</button>
                  </Popconfirm>
                )}
              </div>
            </>
          )}
        </article>
      ))}
    </div>
  );
};

export default Medications;
