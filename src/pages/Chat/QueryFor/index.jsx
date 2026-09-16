import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";
import QueryForDropdownSVG from "../../../assets/query-down.svg?react";
import ChatNewBlueSVG from "../../../assets/chat-new-blue.svg?react";
import { useState } from "react";
import Modal from "../../../components/Modal/index.jsx";
import MemberForm from "../MemberForm";
import { useAccountStore } from "../../../store/account";
import { useChatStore } from "../../../store/Chart";
import useClickOutside from "../../../hooks/useClickOutside.js";

function QueryFor() {
  const { t } = useTranslation();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const dropdownRef = useClickOutside(() => {
    setDropdownVisible(false);
  }, dropdownVisible);

  const fetchBeneficiaryUsers = useAccountStore(
    (state) => state.fetchBeneficiaryUsers,
  );
  const beneficiary_users = useAccountStore((state) => state.beneficiary_users);
  const user_id = useAccountStore((state) => state.user_id);
  const current_query_user_id = useAccountStore(
    (state) => state.current_query_user_id,
  );
  const current_query_user_name = useAccountStore(
    (state) => state.current_query_user_name,
  );
  const setCurrentQueryUser = useAccountStore(
    (state) => state.setCurrentQueryUser,
  );
  const setCurrentSessionId = useChatStore(
    (state) => state.setCurrentSessionId,
  );

  const onClickQueryFor = () => {
    if (!dropdownVisible) {
      fetchBeneficiaryUsers();
    }
    setDropdownVisible(!dropdownVisible);
  };

  const onClickDropdownItem = (user) => {
    setDropdownVisible(false);
    if (user.id === current_query_user_id) {
      return;
    }
    setCurrentQueryUser({
      user_id: user.id || "",
      user_name: user.nickname || user.name || "",
    });
    setCurrentSessionId(null);
  };

  return (
    <>
      <div className={styles.wrapper} ref={dropdownRef}>
        {/* A real button with listbox semantics, matching ModelDropdown: this
            picks whose records the next question is answered from, and it was
            a bare <div onClick> that Tab could not reach. */}
        <button
          type="button"
          className={styles.query_for}
          aria-haspopup="listbox"
          aria-expanded={dropdownVisible}
          aria-label={t("query_for")}
          onClick={onClickQueryFor}
        >
          <span className={styles.query_title}>{t("query_for")}</span>
          <span className={styles.query_dropdown}>
            <span className={styles.query_for_cur}>
              {user_id === current_query_user_id || !current_query_user_id
                ? t("me")
                : current_query_user_name}
            </span>
            <QueryForDropdownSVG aria-hidden="true" />
          </span>
        </button>
        <div
          className={styles.dropdown}
          role="listbox"
          style={{ display: dropdownVisible ? "flex" : "none" }}
        >
          {beneficiary_users.map((user) => {
            const name = user.nickname || user.name || "";
            // Same synthetic address the sidebar hides: an internal key, not
            // something anyone can write to.
            const email = /^member_[0-9a-f]+@/i.test(user.email || "")
              ? ""
              : user.email;
            const details = [
              email,
              user.gender,
              user.age ? `${t("age")} ${user.age}` : "",
              user.blood_type,
            ].filter(Boolean);
            const isActive = user.id === current_query_user_id;

            return (
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                className={`${styles.dropdown_item} ${
                  isActive ? styles.dropdown_item_active : ""
                }`}
                key={user.id}
                onClick={() => onClickDropdownItem(user)}
              >
                <span className={styles.item_avatar}>
                  {(name || email || "").trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className={styles.item_body}>
                  <div className={styles.item_name_row}>
                    <span className={styles.item_name}>{name}</span>
                    {user.is_current_user && (
                      <span className={styles.item_tag}>{t("me")}</span>
                    )}
                  </div>
                  {details.length > 0 && (
                    <div className={styles.item_detail}>
                      {details.join(" · ")}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* <div className={styles.btn} onClick={onClickAddMember}>
            <ChatNewBlueSVG />
            <div className={styles.btn_text}>{t("new_member")}</div>
          </div> */}
        </div>
      </div>
      {/* <Modal isOpen={showMemberForm} onClose={closeMemberForm}>
        <MemberForm onClose={closeMemberForm} />
      </Modal> */}
    </>
  );
}

export default QueryFor;
