import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { message, Popconfirm, Spin } from "antd";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import DriveHeader from "../../components/DriveHeader";
import api from "../../api";
import { useDriveStore } from "../../store/Drive";
import { useAccountStore } from "../../store/account";
import styles from "./index.module.scss";

const EMPTY_FORM = {
  name: "", form: "", strength: "", doseValue: "", doseUnit: "mg",
  times: "", startDate: new Date().toISOString().slice(0, 10), endDate: "",
};

const payload = (form) => ({
  name: form.name.trim(), form: form.form.trim(), strength: form.strength.trim(),
  schedule: [{
    dose: form.doseValue ? { value: Number(form.doseValue), unit: form.doseUnit.trim() } : null,
    times: form.times.split(",").map((x) => x.trim()).filter(Boolean),
  }],
  start_date: form.startDate,
  end_date: form.endDate || null,
});

const MedicationsPage = () => {
  const { t } = useTranslation();
  const targetUserId = useDriveStore((state) => state.current_drive_user_id);
  const beneficiaries = useAccountStore((state) => state.beneficiary_users);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isOwnRecord = useMemo(() => {
    const me = beneficiaries?.find?.((user) => user.is_current_user);
    return !me || !targetUserId || me.id === targetUserId;
  }, [beneficiaries, targetUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listMedications({ target_user_id: targetUserId });
      setItems(result?.items || []);
    } catch {
      message.error(t("medications_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [t, targetUserId]);

  useEffect(() => { load(); }, [load]);

  const change = (event) => setForm((old) => ({ ...old, [event.target.name]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.updateMedication(editing, payload(form));
      else await api.createMedication(payload(form));
      setForm(EMPTY_FORM);
      setEditing(null);
      await load();
      message.success(t("medications_saved"));
    } catch {
      message.error(t("medications_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const edit = (item) => {
    setEditing(item.plan_id);
    setForm({
      name: item.name || "", form: item.form || "", strength: item.strength || "",
      doseValue: item.schedule?.[0]?.dose?.value || "", doseUnit: item.schedule?.[0]?.dose?.unit || "mg",
      times: item.schedule?.[0]?.times?.join(", ") || "", startDate: item.start_date || EMPTY_FORM.startDate,
      endDate: item.end_date || "",
    });
  };

  const transition = async (item, action) => {
    try {
      await api[action](item.plan_id);
      await load();
    } catch {
      message.error(t("medications_action_failed"));
    }
  };

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
                <input name="strength" value={form.strength} onChange={change} placeholder={t("medications_strength")} />
                <input name="form" value={form.form} onChange={change} placeholder={t("medications_form")} />
                <div className={styles.row}>
                  <input name="doseValue" type="number" min="0" step="any" value={form.doseValue} onChange={change} placeholder={t("medications_dose")} />
                  <input name="doseUnit" value={form.doseUnit} onChange={change} aria-label={t("medications_unit")} />
                  <input name="times" value={form.times} onChange={change} placeholder={t("medications_times")} />
                </div>
                <div className={styles.row}>
                  <label>{t("medications_start")}<input name="startDate" type="date" value={form.startDate} onChange={change} /></label>
                  <label>{t("medications_end")}<input name="endDate" type="date" value={form.endDate} onChange={change} /></label>
                </div>
                <div className={styles.actions}><button type="submit" disabled={saving}>{saving ? t("saving") : editing ? t("medications_update") : t("medications_add")}</button>{editing && <button type="button" className={styles.ghost} onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>{t("cancel")}</button>}</div>
              </form>
            )}
            {loading ? <div className={styles.center}><Spin /></div> : items.length === 0 ? <div className={styles.empty}>{t("medications_empty")}</div> : (
              <div className={styles.list}>
                {items.map((item) => <article className={styles.card} key={item.plan_id}>
                  <div><h2>{item.name}{item.strength ? ` · ${item.strength}` : ""}</h2><p>{item.schedule?.[0]?.dose ? `${item.schedule[0].dose.value} ${item.schedule[0].dose.unit}` : ""} {item.schedule?.[0]?.times?.join(" / ")}</p><small>{item.start_date}{item.end_date ? ` → ${item.end_date}` : ""}</small></div>
                  <div className={styles.cardActions}><span className={styles[item.effective_status] || ""}>{t(`medications_status_${item.effective_status}`, item.effective_status)}</span>{isOwnRecord && item.status === "active" && <button onClick={() => transition(item, "stopMedication")}>{t("medications_stop")}</button>}{isOwnRecord && item.status === "stopped" && <button onClick={() => transition(item, "resumeMedication")}>{t("medications_resume")}</button>}{isOwnRecord && <button className={styles.ghost} onClick={() => { setEditing(item.plan_id); edit(item); }}>{t("edit")}</button>} {isOwnRecord && <Popconfirm title={t("medications_delete_confirm")} onConfirm={() => transition(item, "deleteMedication")}><button className={styles.danger}>{t("delete")}</button></Popconfirm>}</div>
                </article>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationsPage;
