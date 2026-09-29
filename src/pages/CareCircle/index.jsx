import { useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { IconKey, IconTrash, IconUserPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import consola from "consola";
import api from "../../api";
import Modal from "../../components/Modal";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import MemberForm from "../Chat/MemberForm";
import InviteSignIn from "./InviteSignIn";
import { useAccountStore } from "../../store/account";
import { useDriveStore } from "../../store/Drive";
import styles from "./index.module.scss";

// Managed members get a synthetic address (member_<uuid>@virtual…) that is an
// internal key, not something the user can write to.
const isSyntheticEmail = (email) => /^member_[0-9a-f]+@/i.test(email || "");

// What my record shows a circle I belong to (care_circle_members.health_access).
const ACCESS_OPTIONS = [
  { value: 2, key: "cc_access_edit" },
  { value: 1, key: "cc_access_view" },
  { value: 0, key: "cc_access_none" },
];

const initialOf = (user) =>
  (user.name || user.nickname || user.email || "").trim().charAt(0).toUpperCase() ||
  "?";

/**
 * 关爱圈 — the people whose records you can see, and the ones you manage.
 *
 * A page rather than a list nested in the sidebar: the sidebar is a map of the
 * product, and a roster of people with per-person actions is a destination on
 * that map, not one of its labels. It sits beside 档案 under 管理 for the same
 * reason — one is your own record, this is everyone else's.
 */
const CareCirclePage = () => {
  const { t } = useTranslation();
  const [showAddMember, setShowAddMember] = useState(false);
  const [inviting, setInviting] = useState(null);
  // Circles someone else owns that I am in, with what my record shows each.
  // A virtual member who took over their account lands here, in the circle
  // of the person who added them.
  const [sharing, setSharing] = useState([]);
  const beneficiary_users = useAccountStore((state) => state.beneficiary_users);
  // The roster endpoint has no email field, so the signed-in row's address
  // comes from the access token (see parseIdentityFromToken) — the same source
  // the account row and the profile page read.
  const user_email = useAccountStore((state) => state.user_email);
  const fetchBeneficiaryUsers = useAccountStore(
    (state) => state.fetchBeneficiaryUsers,
  );
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const setCurrentDriveUserId = useDriveStore(
    (state) => state.setCurrentDriveUserId,
  );

  useEffect(() => {
    fetchBeneficiaryUsers();
    const controller = new AbortController();
    api
      .listSharedWithMe(controller.signal)
      .then((res) => setSharing((res?.circles || []).filter((c) => c.role !== "owner")))
      .catch((err) => {
        if (err?.name !== "CanceledError") consola.error("ERROR: listSharedWithMe", err);
      });
    return () => controller.abort();
  }, [fetchBeneficiaryUsers]);

  const onChangeAccess = async (circle, access) => {
    try {
      await api.setHealthAccess({ circle_id: circle.circle_id, access });
      setSharing((rows) =>
        rows.map((c) => (c.circle_id === circle.circle_id ? { ...c, health_access: access } : c)),
      );
      message.success(t("cc_access_saved"));
    } catch (err) {
      consola.error("ERROR: setHealthAccess", err);
      message.error(t("cc_access_failed"));
    }
  };

  const me = useMemo(
    () => beneficiary_users.find((u) => u.is_current_user),
    [beneficiary_users],
  );
  const others = useMemo(
    () => beneficiary_users.filter((u) => !u.is_current_user),
    [beneficiary_users],
  );

  // Remove a member I manage (revoke the relationship I own).
  const onRemoveMember = (user) => {
    Modal.confirm({
      title: t("remove_member_confirm_title"),
      content: t("remove_member_confirm_content"),
      okText: t("yes"),
      danger: true,
      cancelText: t("cancel"),
      onOk: async () => {
        try {
          await api.removeSharedByMe({
            share_id: user.share_id,
            query_user_id: user.id,
          });
          message.success(t("remove_member_success"));
          // If we removed the person currently being viewed, fall back to me.
          if (current_drive_user_id === user.id && me) {
            setCurrentDriveUserId(me.id);
          }
          fetchBeneficiaryUsers();
        } catch (err) {
          consola.error("ERROR: removeMember", err);
          message.error(t("remove_member_failed"));
        }
      },
    });
  };

  const renderCard = (user) => {
    const rawEmail = user.is_current_user
      ? user.email || user_email
      : user.email;
    const email = isSyntheticEmail(rawEmail) ? "" : rawEmail;
    const facts = [
      user.gender,
      user.age ? `${t("age")} ${user.age}` : "",
      user.blood_type ? `${t("blood_type")} ${user.blood_type}` : "",
    ].filter(Boolean);

    return (
      <div key={user.id} className={styles.card}>
        <div className={styles.card_head}>
          <span className={styles.avatar}>{initialOf(user)}</span>
          <div className={styles.card_id}>
            <div className={styles.name_row}>
              <span className={styles.name}>
                {user.name || user.nickname || "—"}
              </span>
              {user.is_current_user && (
                <span className={styles.badge}>{t("me")}</span>
              )}
            </div>
            {email && <div className={styles.email}>{email}</div>}
          </div>
          {user.is_managed && (
            <button
              type="button"
              className={styles.remove}
              aria-label={t("remove_member_confirm_title")}
              onClick={() => onRemoveMember(user)}
            >
              <IconTrash size={15} />
            </button>
          )}
        </div>
        {user.can_view === false ? (
          <div className={styles.facts_empty}>{t("cc_not_sharing")}</div>
        ) : facts.length > 0 ? (
          <div className={styles.facts}>
            {facts.map((f) => (
              <span key={f} className={styles.fact}>
                {f}
              </span>
            ))}
          </div>
        ) : (
          <div className={styles.facts_empty}>{t("cc_no_basics")}</div>
        )}
        {user.can_invite_to_sign_in && (
          <button
            type="button"
            className={styles.card_action}
            onClick={() => setInviting(user)}
          >
            <IconKey size={14} />
            <span>{t("invite_sign_in_action")}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-[100vw] h-dvh flex flex-col overflow-hidden">
      <MobileTopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className={styles.scroll}>
          <div className={styles.column}>
            <header className={styles.head}>
              <div>
                <h1 className={styles.title}>{t("care_circle")}</h1>
                <p className={styles.sub}>{t("cc_page_sub")}</p>
              </div>
              <button
                type="button"
                className={styles.invite_btn}
                onClick={() => setShowAddMember(true)}
              >
                <IconUserPlus size={16} stroke={2} />
                <span>{t("add_member")}</span>
              </button>
            </header>

            <section className={styles.section}>
              <div className={styles.section_head}>
                <span className={styles.section_title}>{t("cc_section_me")}</span>
              </div>
              <div className={styles.grid}>{me ? renderCard(me) : null}</div>
            </section>

            <section className={styles.section}>
              <div className={styles.section_head}>
                <span className={styles.section_title}>
                  {t("cc_section_members")}
                </span>
                <span className={styles.section_count}>{others.length}</span>
              </div>
              {others.length > 0 ? (
                <div className={styles.grid}>{others.map(renderCard)}</div>
              ) : (
                <div className={styles.empty}>
                  <div className={styles.empty_title}>{t("cc_empty_title")}</div>
                  <p className={styles.empty_sub}>{t("cc_empty_sub")}</p>
                  <button
                    type="button"
                    className={styles.invite_btn}
                    onClick={() => setShowAddMember(true)}
                  >
                    <IconUserPlus size={16} stroke={2} />
                    <span>{t("add_member")}</span>
                  </button>
                </div>
              )}
            </section>

            {sharing.length > 0 && (
              <section className={styles.section}>
                <div className={styles.section_head}>
                  <span className={styles.section_title}>{t("cc_section_sharing")}</span>
                </div>
                <p className={styles.sub}>{t("cc_sharing_sub")}</p>
                <div className={styles.share_list}>
                  {sharing.map((c) => (
                    <div key={c.circle_id} className={styles.share_row}>
                      <span className={styles.name}>
                        {c.owner_name || c.name || t("care_circle")}
                      </span>
                      <select
                        className={styles.share_select}
                        value={c.health_access}
                        aria-label={t("cc_section_sharing")}
                        onChange={(e) => onChangeAccess(c, Number(e.target.value))}
                      >
                        {ACCESS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {t(o.key)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)}>
        <MemberForm onClose={() => setShowAddMember(false)} />
      </Modal>
      <Modal isOpen={Boolean(inviting)} onClose={() => setInviting(null)}>
        {inviting && <InviteSignIn member={inviting} onClose={() => setInviting(null)} />}
      </Modal>
    </div>
  );
};

export default CareCirclePage;
