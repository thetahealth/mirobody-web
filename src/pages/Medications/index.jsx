import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { message, Popconfirm, Spin } from "antd";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import DriveHeader from "../../components/DriveHeader";
import api from "../../api";
import { useDriveStore } from "../../store/Drive";
import { useAccountStore } from "../../store/account";
import {
  FREQUENCIES, WEEKDAYS, createPayload, emptyForm, formFromPlan, localToday,
  patchPayload, scheduleEditable, scheduleSummary,
} from "./form";
import styles from "./index.module.scss";

/**
 * 用药: the structured plans behind `/api/v1/medications`.
 *
 * A family member with a read grant sees the list and each plan's history;
 * only the record's owner gets the form and the buttons (the backend refuses
 * the writes anyway). "Due" and "missed" are not shown: they are computed from
 * the clock on read, and this page is about the plans themselves.
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
      {courses.map((c) => (
        <li key={`${c.start_date}:${c.end_date || ""}`}>
          {c.start_date} → {c.end_date || t("medications_course_open")}
          {c.closed_by ? ` · ${t(`medications_course_${c.closed_by}`, c.closed_by)}` : ""}
        </li>
      ))}
    </ol>
  );
};

const MedicationsPage = () => {
  const { t } = useTranslation();
  const targetUserId = useDriveStore((state) => state.current_drive_user_id);
  const beneficiaries = useAccountStore((state) => state.beneficiary_users);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(() => emptyForm());
  const [editing, setEditing] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const change = (event) => setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  const toggleWeekday = (day) => setForm((old) => ({
    ...old,
    weekdays: old.weekdays.includes(day) ? old.weekdays.filter((d) => d !== day) : [...old.weekdays, day],
  }));
  const reset = () => {
    setEditing(null);
    setForm(emptyForm(localToday()));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (form.frequency === "weekly" && !form.weekdays.length) {
      message.error(t("medications_weekdays_required"));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const changes = patchPayload(form, editing);
        if (Object.keys(changes).length) await api.updateMedication(editing.plan_id, changes);
      } else {
        await api.createMedication(createPayload(form));
      }
      reset();
      reload();
      message.success(t("medications_saved"));
    } catch {
      message.error(t("medications_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const edit = (item) => {
    setEditing(item);
    setForm(formFromPlan(item, localToday()));
  };

  const transition = async (item, action) => {
    try {
      await api[action](item.plan_id);
      if (editing?.plan_id === item.plan_id) reset();
      reload();
    } catch {
      message.error(t("medications_action_failed"));
    }
  };

  const scheduleLocked = editing && !scheduleEditable(editing);

  return (
    <div className="w-[100vw] h-dvh flex flex-col overflow-hidden">
      <MobileTopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className={styles.scroll}>
          <div className={styles.column}>
            <DriveHeader />
            <header className={styles.header}>
              <div><p className={styles.eyebrow}>{t("medications_eyebrow")}</p><h1>{t("medications_title")}</h1></div>
              <p className={styles.subtitle}>{t("medications_subtitle")}</p>
            </header>
            {isOwnRecord && (
              <form className={styles.form} onSubmit={save}>
                <input name="name" value={form.name} onChange={change} placeholder={t("medications_name")} required />
                <div className={styles.row}>
                  <input name="strength" value={form.strength} onChange={change} placeholder={t("medications_strength")} />
                  <input name="form" value={form.form} onChange={change} placeholder={t("medications_form")} />
                </div>
                {scheduleLocked ? (
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
                    {form.frequency !== "as_needed" && (
                      <input name="times" value={form.times} onChange={change} placeholder={t("medications_times")} />
                    )}
                  </>
                )}
                <div className={styles.row}>
                  <label>{t("medications_start")}<input name="startDate" type="date" value={form.startDate} onChange={change} required /></label>
                  <label>{t("medications_end")}<input name="endDate" type="date" value={form.endDate} onChange={change} /></label>
                </div>
                <div className={styles.actions}>
                  <button type="submit" disabled={saving}>
                    {saving ? t("saving") : editing ? t("medications_update") : t("medications_add")}
                  </button>
                  {editing && <button type="button" className={styles.ghost} onClick={reset}>{t("cancel")}</button>}
                </div>
              </form>
            )}
            {loading ? <div className={styles.center}><Spin /></div> : items.length === 0 ? <div className={styles.empty}>{t("medications_empty")}</div> : (
              <div className={styles.list}>
                {items.map((item) => (
                  <article className={styles.card} key={item.plan_id}>
                    <div className={styles.cardMain}>
                      <h2>{item.name}{item.strength ? ` · ${item.strength}` : ""}</h2>
                      <p>{scheduleSummary(item, t)}</p>
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
                      {isOwnRecord && <button type="button" className={styles.ghost} onClick={() => edit(item)}>{t("edit")}</button>}
                      {isOwnRecord && (
                        <Popconfirm title={t("medications_delete_confirm")} onConfirm={() => transition(item, "deleteMedication")}>
                          <button type="button" className={styles.danger}>{t("delete")}</button>
                        </Popconfirm>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationsPage;
