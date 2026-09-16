import { useCallback, useEffect, useMemo, useState } from "react";
import { DatePicker, Select, message } from "antd";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import consola from "consola";
import api from "../../api";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import { useAccountStore } from "../../store/account";
import { BLOOD_TYPE_OPTIONS, GENDER_OPTIONS } from "../../enum/form";
import styles from "./index.module.scss";

// The server stores a birth date and derives age from it, so this asks for the
// date. Bounded to 1900 → today: every realistic birth year is reachable and a
// future date is not.
const BIRTH_MIN = dayjs("1900-01-01");

/**
 * 档案 — the signed-in person's own record.
 *
 * It exists because the sidebar's 管理 group listed only the care circle, so
 * the one person always in the product had nowhere to see or edit themselves.
 *
 * Basics only. Settings are reached from the account row at the foot of the
 * sidebar, where the rest of the account actions live — they were briefly
 * duplicated here, which gave the same modal two front doors.
 */
const ProfilePage = () => {
  const { t } = useTranslation();

  const user_name = useAccountStore((s) => s.user_name);
  const user_email = useAccountStore((s) => s.user_email);
  const beneficiary_users = useAccountStore((s) => s.beneficiary_users);
  const fetchBeneficiaryUsers = useAccountStore((s) => s.fetchBeneficiaryUsers);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // The form's own copy. `null` until the server answers, so the fields are not
  // briefly empty-and-editable before the real values land.
  const [form, setForm] = useState(null);

  const me = useMemo(
    () => beneficiary_users.find((u) => u.is_current_user) || {},
    [beneficiary_users],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getUserSettings();
      const profile = res?.profile || {};
      setForm({
        gender: profile.gender || undefined,
        birth: profile.birth ? dayjs(profile.birth) : null,
        blood: profile.blood || undefined,
      });
    } catch (error) {
      consola.error("ERROR: Get profile", error);
      setForm({ gender: undefined, birth: null, blood: undefined });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchBeneficiaryUsers();
  }, [load, fetchBeneficiaryUsers]);

  const save = async (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    setSaving(true);
    try {
      await api.updateUserProfile({
        gender: next.gender ?? "",
        // The server wants a plain date; dayjs objects are the picker's currency.
        birth: next.birth ? next.birth.format("YYYY-MM-DD") : "",
        blood: next.blood ?? "",
      });
      // Refresh the roster: it is what the chat answers from, and the server
      // recomputes `age` from the birth date we just sent.
      await fetchBeneficiaryUsers();
      message.success(t("profile_saved"));
    } catch (error) {
      consola.error("ERROR: Update profile", error);
      message.error(t("profile_save_failed"));
      load(); // put the server's truth back on screen
    } finally {
      setSaving(false);
    }
  };

  const displayName = me.name || me.nickname || user_name || "—";
  const initial = (displayName || "?").trim().charAt(0).toUpperCase();

  const genderOptions = GENDER_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.label),
  }));
  const bloodOptions = BLOOD_TYPE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  return (
    <div className="w-[100vw] h-dvh flex flex-col overflow-hidden">
      <MobileTopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className={styles.scroll}>
          <div className={styles.column}>
            <header className={styles.head}>
              <div>
                <h1 className={styles.title}>{t("profile")}</h1>
                <p className={styles.sub}>{t("profile_page_sub")}</p>
              </div>
            </header>

            <section className={styles.section}>
              <div className={styles.identity}>
                <span className={styles.avatar}>{initial}</span>
                <div className={styles.identity_text}>
                  <div className={styles.identity_name}>{displayName}</div>
                  {user_email && (
                    <div className={styles.identity_email}>{user_email}</div>
                  )}
                </div>
              </div>

              <div className={styles.section_head}>
                <span className={styles.section_title}>
                  {t("profile_section_basics")}
                </span>
                {saving && (
                  <span className={styles.saving}>{t("profile_saving")}</span>
                )}
              </div>

              <div className={styles.rows}>
                <div className={styles.row}>
                  <label className={styles.row_label} htmlFor="profile-gender">
                    {t("gender")}
                  </label>
                  <Select
                    id="profile-gender"
                    className={styles.control}
                    options={genderOptions}
                    value={form?.gender}
                    loading={loading}
                    disabled={loading}
                    placeholder={t("profile_not_set")}
                    onChange={(v) => save({ gender: v })}
                  />
                </div>

                <div className={styles.row}>
                  <label className={styles.row_label} htmlFor="profile-birth">
                    {t("birth_date")}
                  </label>
                  <DatePicker
                    id="profile-birth"
                    className={styles.control}
                    value={form?.birth || null}
                    disabled={loading}
                    placeholder={t("profile_not_set")}
                    minDate={BIRTH_MIN}
                    maxDate={dayjs()}
                    onChange={(d) => save({ birth: d })}
                  />
                </div>

                {/* Age is the server's, computed from the birth date above —
                    shown so the consequence of that field is visible, not
                    offered as something to type. */}
                <div className={styles.row}>
                  <span className={styles.row_label}>{t("age")}</span>
                  <span
                    className={`${styles.derived} ${
                      me.age ? "" : styles.derived_empty
                    }`}
                  >
                    {me.age || t("profile_from_birth")}
                  </span>
                </div>

                <div className={styles.row}>
                  <label className={styles.row_label} htmlFor="profile-blood">
                    {t("blood_type")}
                  </label>
                  <Select
                    id="profile-blood"
                    className={styles.control}
                    options={bloodOptions}
                    value={form?.blood}
                    loading={loading}
                    disabled={loading}
                    placeholder={t("profile_not_set")}
                    onChange={(v) => save({ blood: v })}
                  />
                </div>
              </div>
              <p className={styles.note}>{t("profile_basics_note")}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
