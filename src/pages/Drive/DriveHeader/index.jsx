import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import DriveHeaderArrowRightSVG from "../../../assets/driver_header_arrow_right.svg?react";
import { useDriveStore } from "../../../store/Drive";
import { useAccountStore } from "../../../store/account";
import { useUiStore } from "../../../store/ui";
import useIsMobile from "../../../hooks/useIsMobile";

const DriveHeader = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const menu_expanded = useDriveStore((state) => state.menu_expanded);
  const beneficiary_users = useAccountStore((state) => state.beneficiary_users);
  const current_drive_user = useMemo(() => {
    return beneficiary_users.find((user) => user.id === current_drive_user_id);
  }, [beneficiary_users, current_drive_user_id]);

  if (!current_drive_user) return null;

  // Mobile: this card is the single people-switcher entry — open the drawer
  // (no separate hamburger). Desktop: a plain page title. The << arrow used
  // to toggle the rail here, but the sidebar's own icon does that now — two
  // controls for one action, one of them cryptic, so the arrow is gone.
  const onToggle = () => {
    if (isMobile) useUiStore.getState().setSidebarDrawerOpen(true);
  };

  return (
    // Whose data you are looking at — a page title, not a floating card. The
    // 24px drop shadow it used to carry made a small chip the heaviest object
    // on the screen; the token set is a flat, border-first system.
    <div
      className={`group flex items-center w-fit gap-[var(--space-2)] -ml-[var(--space-2)] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-md)] select-none ${
        isMobile
          ? "cursor-pointer hover:bg-[var(--color-bg-soft)] transition-colors"
          : ""
      }`}
      id="drive_header"
      onClick={onToggle}
    >
      {isMobile && (
        <div className="flex items-center justify-center w-[24px] h-[24px]">
          <DriveHeaderArrowRightSVG
            className={`transition-transform duration-300 ${
              menu_expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      )}
      <div className="text-[var(--color-text-primary)] text-[22px] font-[600]">
        <Trans
          t={t}
          i18nKey="health_drive_for"
          values={{
            name: current_drive_user.nickname || current_drive_user.name || "",
          }}
          components={{
            1: <span />,
          }}
        />
      </div>
    </div>
  );
};

export default DriveHeader;
