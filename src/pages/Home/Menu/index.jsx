import styles from "./index.module.scss";
import LogoSVG from "../../../assets/logo.svg?react";
import { useEffect } from "react";
import { useAccountStore } from "../../../store/account";
import MenuDropdownSVG from "../../../assets/menu-down.svg?react";

function Menu() {
  const { user_name, fetchBeneficiaryUsers, beneficiary_users } =
    useAccountStore();
  useEffect(() => {
    fetchBeneficiaryUsers();
  }, [fetchBeneficiaryUsers]);

  return (
    <div className={styles.menu}>
      <div className={styles.logo}>
        <LogoSVG />
      </div>
      <div className={styles.user}>
        <div className={styles.user_avatar}>
          {user_name?.charAt(0)?.toUpperCase() || ""}
        </div>
        <div className={styles.user_name}>{user_name}</div>
        <MenuDropdownSVG className={styles.dropdown_icon} />
        <div className={styles.dropdown_content}>
          {beneficiary_users.map((user) => (
            <div className={styles.user} key={user.user_id}>
              <div className={styles.user_avatar}>
                {user.user_name?.charAt(0)?.toUpperCase() || ""}
              </div>
              <div className={styles.user_name}>{user.user_name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Menu;
