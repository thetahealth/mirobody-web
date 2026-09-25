import { useMemo, useState } from "react";
import { Popover } from "antd";
import { CheckOutlined, DownOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useDriveStore } from "../../store/Drive";
import { useAccountStore } from "../../store/account";
import styles from "./index.module.scss";

const isSyntheticEmail = (email) => /^member_[0-9a-f]+@/i.test(email || "");

const initialOf = (user) =>
  (user.name || user.nickname || user.email || "").trim().charAt(0).toUpperCase() ||
  "?";

/**
 * Whose records this page is showing, and the switch for changing it.
 *
 * It became a switcher when the care circle moved out of the sidebar and onto
 * its own page: the roster was the only way to change person, so the page that
 * displays one person's data now carries the control. Same row anatomy as the
 * chat composer's 帮他问 picker and the care-circle cards — one roster, one
 * way of reading it.
 */
const DriveHeader = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current_drive_user_id = useDriveStore(
    (state) => state.current_drive_user_id,
  );
  const setCurrentDriveUserId = useDriveStore(
    (state) => state.setCurrentDriveUserId,
  );
  const beneficiary_users = useAccountStore((state) => state.beneficiary_users);
  const current_drive_user = useMemo(
    () => beneficiary_users.find((user) => user.id === current_drive_user_id),
    [beneficiary_users, current_drive_user_id],
  );

  if (!current_drive_user) return null;

  const pick = (user) => {
    setOpen(false);
    if (user.id !== current_drive_user_id) setCurrentDriveUserId(user.id);
  };

  const content = (
    <div className={styles.panel} role="listbox">
      {beneficiary_users.map((user) => {
        const isActive = user.id === current_drive_user_id;
        const email = isSyntheticEmail(user.email) ? "" : user.email;
        const details = [
          email,
          user.age ? `${t("age")} ${user.age}` : "",
          user.blood_type ? `${t("blood_type")} ${user.blood_type}` : "",
        ].filter(Boolean);

        return (
          <button
            type="button"
            key={user.id}
            role="option"
            aria-selected={isActive}
            className={`${styles.option} ${isActive ? styles.option_active : ""}`}
            onClick={() => pick(user)}
          >
            <span className={styles.option_avatar}>{initialOf(user)}</span>
            <span className={styles.option_body}>
              <span className={styles.option_name_row}>
                <span className={styles.option_name}>
                  {user.name || user.nickname || ""}
                </span>
                {user.is_current_user && (
                  <span className={styles.option_badge}>{t("me")}</span>
                )}
              </span>
              {details.length > 0 && (
                <span className={styles.option_detail}>
                  {details.join(" · ")}
                </span>
              )}
            </span>
            {isActive && <CheckOutlined className={styles.option_check} />}
          </button>
        );
      })}
    </div>
  );

  const name =
    current_drive_user.nickname || current_drive_user.name || "";

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      open={open}
      onOpenChange={setOpen}
      classNames={{ root: styles.overlay }}
      destroyOnHidden
    >
      <button
        type="button"
        id="drive_header"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.trigger_name}>{name}</span>
        <DownOutlined className={styles.trigger_caret} />
      </button>
    </Popover>
  );
};

export default DriveHeader;
