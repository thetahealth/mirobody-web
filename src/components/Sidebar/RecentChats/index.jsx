import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../../store/Chart";
import { useUiStore } from "../../../store/ui";
import HistoryList from "./HistoryList";
import styles from "./index.module.scss";

/**
 * Conversation history, in the sidebar of the page it belongs to — the same
 * slot the care circle takes on /data. It used to be a rail that collapsed to a
 * single glyph, so the default state of the chat page showed no history at all.
 */
function RecentChats() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startNewChat = useChatStore((state) => state.startNewChat);

  const handleNewChat = () => {
    startNewChat();
    navigate("/ask");
    useUiStore.getState().setSidebarDrawerOpen(false);
  };

  return (
    <div className={styles.recent}>
      <div className={styles.header}>
        <span className={styles.label}>{t("chat_history")}</span>
        <button
          type="button"
          className={styles.icon_btn}
          aria-label={t("new_conversation")}
          title={t("new_conversation")}
          onClick={handleNewChat}
        >
          <PlusOutlined />
        </button>
      </div>
      <HistoryList />
    </div>
  );
}

export default RecentChats;
