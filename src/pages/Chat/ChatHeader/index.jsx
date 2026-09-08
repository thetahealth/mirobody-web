import styles from "./index.module.scss";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import ModelDropdown from "../ModelDropdown";
import { useChatStore } from "../../../store/Chart/index";
import { useChartDataStore } from "../../../store/Chart/data";
import QueryFor from "../QueryFor";
import useIsMobile from "../../../hooks/useIsMobile";
import { useUiStore } from "../../../store/ui";
import ChatHistorySVG from "../../../assets/chat-history.svg?react";
import ChatNewBlueSVG from "../../../assets/chat-new-blue.svg?react";

function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const setSidebarDrawerOpen = useUiStore((s) => s.setSidebarDrawerOpen);
  const startNewChat = useChatStore((state) => state.startNewChat);
  const loading_chart_session = useChatStore(
    (state) => state.loading_chart_session,
  );
  const current_session_id = useChatStore((state) => state.current_session_id);
  const current_session_summary = useChartDataStore((state) => {
    if (!current_session_id) return "";
    return state.chartData[current_session_id]?.summary || "";
  });

  const handleNewChat = () => {
    startNewChat();
    navigate("/ask");
    setSidebarDrawerOpen(false);
  };

  // Mobile: two rows of like-with-like.
  //   row 1: actions — history (left) + new-conversation (right)
  //   row 2: selectors — model + "query for"
  if (isMobile) {
    return (
      <div className={styles.header}>
        <div className={styles.m_row1}>
          <button
            type="button"
            className={styles.action_btn}
            onClick={() => setSidebarDrawerOpen(true)}
          >
            <ChatHistorySVG />
            <span>{t("chat_history")}</span>
          </button>
          <button
            type="button"
            className={`${styles.action_btn} ${styles.new_btn}`}
            onClick={handleNewChat}
          >
            <ChatNewBlueSVG />
            <span>{t("new_conversation")}</span>
          </button>
        </div>
        <div className={styles.m_row2}>
          <ModelDropdown />
          <QueryFor />
        </div>
        {loading_chart_session && <div className={styles.loading}></div>}
      </div>
    );
  }

  return (
    <div className={styles.header}>
      {/* `.inner` is the whole point of this wrapper: the header used to be a
          full-bleed space-between, so "query for" sat against the window edge
          while the messages below it lived in the centred --layout-max column.
          On a wide screen that reads as a title marooned on the left and a
          control marooned on the right with a hand-span of nothing between
          them. Sharing the column puts both at the same edges as the content
          they describe. */}
      <div className={styles.inner}>
        <div className={styles.left}>
          <div className={styles.title_col}>
            <div className={styles.title}>
              {current_session_summary || t("new_conversation")}
            </div>
            <ModelDropdown />
          </div>
        </div>
        <div className={styles.right}>
          <QueryFor />
        </div>
      </div>
      {loading_chart_session && <div className={styles.loading}></div>}
    </div>
  );
}

export default Header;
