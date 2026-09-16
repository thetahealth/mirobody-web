import styles from "../index.module.scss";
import { useChatStore } from "../../../../store/Chart";
import { useChatHistoryStore } from "../../../../store/Chart/history";
import { useChartDataStore } from "../../../../store/Chart/data";
import { useUiStore } from "../../../../store/ui";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Dropdown, message } from "antd";
import Modal from "../../../Modal";
import { ShareAltOutlined, DeleteOutlined } from "@ant-design/icons";
import ShareModal from "../../../Modal/ShareModal";
import { deleteHistory } from "../../../../api/chat";
import {
  isCompareGroupKey,
  decodeGroupKey,
} from "../../../../utils/compareSession";
import consola from "consola";

const HistoryList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openMenuSessionId, setOpenMenuSessionId] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareSessionId, setShareSessionId] = useState(null);
  const listRef = useRef(null);
  const conversation_list = useChatHistoryStore(
    (state) => state.conversation_list,
  );
  const history_loaded = useChatHistoryStore((state) => state.history_loaded);
  const history_error = useChatHistoryStore((state) => state.history_error);
  /*  */
  const current_session_id = useChatStore((state) => state.current_session_id);
  const fetchHistoryByConversationList = useChatHistoryStore(
    (state) => state.fetchHistoryByConversationList,
  );
  const switchSession = useChartDataStore((state) => state.switchSession);
  const chartData = useChartDataStore((state) => state.chartData);
  const refreshHistory = useChatHistoryStore((state) => state.refreshHistory);
  /* click chat item */
  const onChatItemClick = (session) => {
    switchSession(session);
    useUiStore.getState().setSidebarDrawerOpen(false);
  };

  // useEffect(() => {
  //   fetchHistoryByConversationList();
  // }, []);

  useEffect(() => {
    fetchHistoryByConversationList();
  }, [fetchHistoryByConversationList]);

  /* calculate scrollbar width */
  useEffect(() => {
    const calculateScrollbarWidth = () => {
      const outer = document.createElement("div");
      outer.style.visibility = "hidden";
      outer.style.overflow = "scroll";
      outer.style.width = "100px";
      document.body.appendChild(outer);

      const inner = document.createElement("div");
      inner.style.width = "100%";
      outer.appendChild(inner);

      const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
      document.body.removeChild(outer);

      return scrollbarWidth;
    };

    const width = calculateScrollbarWidth();

    // Update CSS variable
    if (listRef.current) {
      listRef.current.style.setProperty("--scrollbar-width", `${width}px`);
    }
  }, []);

  /* control scroll when menu is open */
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const preventScroll = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    if (openMenuSessionId !== null) {
      // Disable scroll when menu is open
      listElement.addEventListener("wheel", preventScroll, { passive: false });
      listElement.addEventListener("touchmove", preventScroll, {
        passive: false,
      });
    }

    return () => {
      listElement.removeEventListener("wheel", preventScroll);
      listElement.removeEventListener("touchmove", preventScroll);
    };
  }, [openMenuSessionId]);

  const menuItems = [
    {
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ShareAltOutlined />
          {t("share")}
        </span>
      ),
      key: "share",
    },
    {
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <DeleteOutlined />
          {t("delete_history")}
        </span>
      ),
      key: "delete",
    },
  ];

  const handleDeleteHistory = async (sessionId) => {
    Modal.confirm({
      title: t("delete_history_confirm_title"),
      content: t("delete_history_confirm_content"),
      okText: t("yes"),
      danger: true,
      cancelText: t("cancel"),
      onOk: async () => {
        try {
          // A compare conversation is one group of sibling sessions: delete all
          // of them. Single-model deletes just its own session.
          let idsToDelete = [sessionId];
          if (isCompareGroupKey(sessionId)) {
            const { conversation_list_raw } = useChatHistoryStore.getState();
            const siblingIds = conversation_list_raw
              .map((c) => c.session_id)
              .filter((id) => decodeGroupKey(id) === sessionId);
            if (siblingIds.length > 0) idsToDelete = siblingIds;
          }
          await Promise.all(
            idsToDelete.map((id) => deleteHistory({ session_id: id })),
          );
          message.success(t("delete_history_success"));

          // Check if deleted session is the current active session
          if (current_session_id === sessionId) {
            const remainingSessions = conversation_list.filter(
              (item) => item.session_id !== sessionId,
            );
            if (remainingSessions.length > 0) {
              await switchSession(remainingSessions[0]);
            } else {
              useChatStore.getState().startNewChat();
              navigate("/ask");
            }
          }

          // Refresh history list
          refreshHistory();
        } catch (error) {
          consola.error("ERROR: handleDeleteHistory", error);
          message.error(t("delete_history_error"));
        }
      },
    });
  };

  const handleMenuClick = (menuInfo, sessionId) => {
    // Stop event propagation
    if (menuInfo.domEvent) {
      menuInfo.domEvent.stopPropagation();
    }

    if (menuInfo.key === "share") {
      setShareSessionId(sessionId);
      setShareModalOpen(true);
      setOpenMenuSessionId(null);
    } else if (menuInfo.key === "delete") {
      handleDeleteHistory(sessionId);
      setOpenMenuSessionId(null);
    }
  };

  // Three distinct answers to "why is this list blank": still loading, the
  // fetch failed, or there genuinely is no history yet. They used to look the
  // same — an empty panel.
  if (!history_loaded) {
    return (
      <div className={styles.list}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.list_item} aria-hidden="true">
            <div className={styles.skeleton_wrapper}>
              <div className={styles.skeleton_line} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (history_error) {
    return (
      <div className={styles.state}>
        <span>{t("history_load_failed")}</span>
        <button
          type="button"
          className={styles.retry}
          onClick={() => fetchHistoryByConversationList()}
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  if (conversation_list.length === 0) {
    return <div className={styles.state}>{t("history_empty")}</div>;
  }

  return (
    <>
      <div className={styles.list} key="expand_list_key" ref={listRef}>
        {conversation_list.map((item) => {
            const session_data = chartData[item.session_id];
            const is_streaming = session_data?.is_streaming || false;
            const show_skeleton = !item.summary && is_streaming;

            return (
              <div
                key={item.session_id}
                className={`${styles.list_item} ${
                  current_session_id === item.session_id
                    ? styles.list_item_active
                    : ""
                }`}
                onClick={() => onChatItemClick(item)}
              >
                {show_skeleton ? (
                  <div className={styles.skeleton_wrapper}>
                    <div className={styles.skeleton_line}></div>
                  </div>
                ) : (
                  <>
                    <div className={styles.list_item_title}>
                      {item.summary || t("new_conversation")}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        menu={{
                          items: menuItems,
                          onClick: (menuInfo) =>
                            handleMenuClick(menuInfo, item.session_id),
                        }}
                        trigger={["click"]}
                        onOpenChange={(open) => {
                          setOpenMenuSessionId(open ? item.session_id : null);
                        }}
                      >
                        <button
                          className={`${styles.list_item_more} ${
                            openMenuSessionId === item.session_id
                              ? styles.list_item_more_active
                              : ""
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⋮
                        </button>
                      </Dropdown>
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        sessionId={shareSessionId}
      />
    </>
  );
};

export default HistoryList;
