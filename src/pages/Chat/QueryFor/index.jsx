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
        <div className={styles.query_for} onClick={onClickQueryFor}>
          <div className={styles.query_title}>{t("query_for")}</div>
          <div className={styles.query_dropdown}>
            <div className={styles.query_for_cur}>
              {user_id === current_query_user_id || !current_query_user_id
                ? t("me")
                : current_query_user_name}
            </div>
            <QueryForDropdownSVG />
          </div>
        </div>
        <div
          className={styles.dropdown}
          style={{ display: dropdownVisible ? "flex" : "none" }}
        >
          {beneficiary_users.map((user) => (
            <div
              className={styles.dropdown_item}
              key={user.id}
              onClick={() => onClickDropdownItem(user)}
            >
              <div className={styles.item_tag}>
                {user.is_current_user
                  ? t("me")
                  : user.nickname || user.name || ""}
              </div>
              <div className={styles.item_name}>{user.email || ""}</div>
              <div className={styles.item_detail}>
                <div>{user.gender || ""}</div>
                {user.gender && <div>•</div>}
                <div>{user.age ? `${t("age")} ${user.age}` : ""}</div>
                {user.age && <div>•</div>}
                <div>{user.blood_type || ""}</div>
              </div>
            </div>
          ))}

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
