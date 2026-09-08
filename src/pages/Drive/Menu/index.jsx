import { useEffect, useState } from "react";
import DriveMenuGroupSVG from "../../../assets/drive_menu_group.svg?react";
import MenuComponent from "../../../components/Menu";
import ChatNewBlueSVG from "../../../assets/chat-new-blue.svg?react";
import { useAccountStore } from "../../../store/account";
import { useTranslation } from "react-i18next";
import { useDriveStore } from "../../../store/Drive";
import { useUiStore } from "../../../store/ui";
import useIsMobile from "../../../hooks/useIsMobile";
import Modal from "../../../components/Modal";
import MemberForm from "../../Chat/MemberForm";
import api from "../../../api";
import { message } from "antd";
import consola from "consola";

const Menu = () => {
  const isMobile = useIsMobile();
  const beneficiary_users = useAccountStore((state) => state.beneficiary_users);
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const setCurrentDriveUserId = useDriveStore(
    (state) => state.setCurrentDriveUserId,
  );
  const menu_expanded = useDriveStore((state) => state.menu_expanded);
  const setMenuExpanded = useDriveStore((state) => state.setMenuExpanded);
  const fetchBeneficiaryUsers = useAccountStore(
    (state) => state.fetchBeneficiaryUsers,
  );
  const { t } = useTranslation();
  const [showAddMember, setShowAddMember] = useState(false);

  // Inside the mobile drawer there's no collapsed rail — always show members.
  const expanded = isMobile || menu_expanded;

  const onClickDriveMenuGroup = () => {
    setMenuExpanded();
    if (!menu_expanded) {
      fetchBeneficiaryUsers();
    }
  };

  const onClickMemberItem = (userId) => {
    setCurrentDriveUserId(userId);
    useUiStore.getState().setSidebarDrawerOpen(false);
  };

  // Remove a member I manage (revoke the relationship I own).
  const onRemoveMember = (e, user) => {
    e.stopPropagation();
    Modal.confirm({
      title: t("remove_member_confirm_title"),
      content: t("remove_member_confirm_content"),
      okText: t("yes"),
      cancelText: t("cancel"),
      onOk: async () => {
        try {
          await api.removeSharedByMe({
            share_id: user.share_id,
            query_user_id: user.id,
          });
          message.success(t("remove_member_success"));
          // If we removed the user currently being viewed, fall back to "me".
          if (current_drive_user_id === user.id) {
            const me = beneficiary_users.find((u) => u.is_current_user);
            if (me) setCurrentDriveUserId(me.id);
          }
          fetchBeneficiaryUsers();
        } catch (err) {
          consola.error("ERROR: removeMember", err);
          message.error(t("remove_member_failed"));
        }
      },
    });
  };

  useEffect(() => {
    fetchBeneficiaryUsers().then((data) => {
      if (!data) return;
      const current_user = data.find((user) => user.is_current_user);
      if (current_user) {
        setCurrentDriveUserId(current_user.id);
      }
    });
  }, [fetchBeneficiaryUsers, setCurrentDriveUserId]);

  return (
    <MenuComponent minWidth={88} maxWidth={300} isExpanded={menu_expanded}>
      {/* Collapse toggle is desktop-only; the drawer is already the open panel.
          Same row anatomy as "add member" below (24px margin + 8px padding) so
          the two icons align — and a label, matching the chat sidebar. */}
      {!isMobile && (
        <button
          type="button"
          className="flex items-center mx-[24px] px-[8px] py-[8px] rounded-[8px] bg-transparent border-0 cursor-pointer hover:bg-[var(--color-border)] text-left"
          onClick={onClickDriveMenuGroup}
          aria-label={t("care_circle_management")}
        >
          {/* shrink-0: same as the chat rail — the collapsed row is narrower
              than the 40px glyph and would squeeze it otherwise. */}
          <DriveMenuGroupSVG className="shrink-0" />
          {expanded && (
            <div className="whitespace-nowrap overflow-hidden text-ellipsis flex-1 ml-[4px] font-[500] text-[var(--color-text-primary)]">
              {t("care_circle_management")}
            </div>
          )}
        </button>
      )}
      {/* Visible on the collapsed rail too (icon only), same as the chat
          sidebar's new-conversation — the action shouldn't vanish with the
          panel. */}
      {!isMobile || expanded ? (
        <button
          type="button"
          className="flex items-center mx-[24px] mt-[20px] px-[8px] py-[8px] rounded-[8px] bg-transparent border-0 cursor-pointer hover:bg-[var(--color-border)] text-left"
          onClick={() => setShowAddMember(true)}
          aria-label={t("add_member")}
        >
          <ChatNewBlueSVG className="shrink-0" />
          {expanded && (
            <div className="whitespace-nowrap overflow-hidden text-ellipsis flex-1 ml-[4px] text-[var(--color-accent)] font-[500]">
              {t("add_member")}
            </div>
          )}
        </button>
      ) : null}
      {expanded && (
        <div className="flex flex-col gap-[var(--space-1)] border-t border-[var(--color-border)] py-[var(--space-3)] px-[var(--space-3)] mt-[var(--space-4)] w-full md:w-[300px] md:min-w-[300px] overflow-y-auto">
          {beneficiary_users.map((user) => {
            const isActive = user.id === current_drive_user_id;
            // Managed members get a synthetic address
            // (member_<uuid>@virtual…) that is an internal key, not something
            // the user can write to. Printing it filled the card with a string
            // nobody can use and pushed the real detail out of view.
            const email =
              user.email && !/^member_[0-9a-f]+@/i.test(user.email)
                ? user.email
                : "";
            const details = [
              email,
              user.age ? `${t("age")} ${user.age}` : "",
              user.blood_type ? `${t("blood_type")} ${user.blood_type}` : "",
            ].filter(Boolean);

            return (
              <div
                key={user.id}
                onClick={() => onClickMemberItem(user.id)}
                className={`group flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-3)] rounded-[var(--radius-md)] cursor-pointer overflow-hidden transition-colors ${
                  isActive
                    ? "bg-[var(--color-bg-elevated,#fff)]"
                    : "hover:bg-[var(--color-bg-elevated,#fff)]/60"
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-[var(--space-2)] min-w-0">
                    <span className="text-[15px] font-[500] text-[var(--color-text-primary)] truncate">
                      {user.name || user.nickname || ""}
                    </span>
                    {/* Only when it says something the name doesn't. */}
                    {user.is_current_user && (
                      <span className="shrink-0 px-[var(--space-2)] py-[1px] text-[11px] rounded-[var(--radius-sm,6px)] text-[var(--color-accent)] bg-[var(--color-accent)]/12">
                        {t("me")}
                      </span>
                    )}
                  </div>
                  {details.length > 0 && (
                    <div className="text-[13px] text-[var(--color-text-secondary)] truncate">
                      {details.join(" · ")}
                    </div>
                  )}
                </div>
                {user.is_managed && (
                  <button
                    type="button"
                    aria-label="remove member"
                    onClick={(e) => onRemoveMember(e, user)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-[18px] leading-none px-[var(--space-2)] bg-transparent border-none cursor-pointer shrink-0 transition-opacity"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)}>
        <MemberForm onClose={() => setShowAddMember(false)} />
      </Modal>
    </MenuComponent>
  );
};

export default Menu;
