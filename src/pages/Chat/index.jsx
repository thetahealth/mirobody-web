import styles from "./index.module.scss";
import ChatHeader from "./ChatHeader";
import Input from "./Input";
import Menu from "./Menu";
import { useCallback, useEffect } from "react";
import FileViewer from "./FileViewer";
import Header from "../../components/Header";
import ResponsiveSidebar from "../../components/ResponsiveSidebar";
import AssistantCard from "./Dialog/Assistant/AssistantCard";
import { useChatStore } from "../../store/Chart/index";
import { useAccountStore } from "../../store/account";
import { useChatHistoryStore } from "../../store/Chart/history";
import { useChatPreviewStore } from "../../store/Chart/preview";
import { useModelStore } from "../../store/model";
import { Outlet, useNavigate } from "react-router";

function Chat() {
  const navigate = useNavigate();
  const isShowPreview = useChatPreviewStore((s) => s.is_show_preview);

  const currentSessionId = useChatStore((s) => s.current_session_id);
  const isShowFullpage = useChatStore((s) => s.is_show_fullpage);
  const fullpageDatasource = useChatStore((s) => s.fullpage_datasource);
  const switchIsShowFullpage = useChatStore((s) => s.switchIsShowFullpage);
  const setFullpageDatasource = useChatStore((s) => s.setFullpageDatasource);

  const getModelShowName = useModelStore((s) => s.getModelShowName);

  const handleToggleFullpage = useCallback(
    (datasource) => {
      setFullpageDatasource(datasource || null);
      switchIsShowFullpage();
    },
    [setFullpageDatasource, switchIsShowFullpage],
  );

  // Sync store → URL: navigate when session ID changes
  // null case is handled by Menu (startNewChat + navigate("/chat"))
  // temp_ prefix is filtered out to avoid leaking pending keys into URL
  useEffect(() => {
    if (currentSessionId && !currentSessionId.startsWith("temp_")) {
      navigate(`/ask/${currentSessionId}`, { replace: true });
    }
  }, [currentSessionId, navigate]);

  useEffect(() => {
    const initializeChatPage = async () => {
      await useAccountStore.getState().fetchBeneficiaryUsers();

      const { current_query_user_id, user_id, user_name } =
        useAccountStore.getState();
      if (!current_query_user_id && user_id) {
        useAccountStore.getState().setCurrentQueryUser({ user_id, user_name });
      }

      useChatHistoryStore.getState().fetchHistoryByConversationList();
      useModelStore.getState().init();
    };

    initializeChatPage();
  }, []);

  return (
    <div className={styles.wrapper}>
      <Header />
      <div className={styles.chat}>
        <ResponsiveSidebar drawerWidth={300}>
          <Menu />
        </ResponsiveSidebar>
        <div className={styles.content_wrapper}>
          <div
            className={`${styles.normal_content} ${
              isShowFullpage ? styles.hidden : ""
            }`}
            key="normal_content"
          >
            <ChatHeader />
            <Outlet />
            <Input />
          </div>
          <div
            className={`${styles.fullpage_content} ${
              !isShowFullpage ? styles.hidden : ""
            }`}
            key="fullpage_content"
          >
            {isShowFullpage &&
              currentSessionId !== null &&
              fullpageDatasource && (
                <AssistantCard
                  datasource={fullpageDatasource}
                  isShowFullpage={isShowFullpage}
                  fullpageDatasource={fullpageDatasource}
                  onToggleFullpage={handleToggleFullpage}
                  modelShowName={getModelShowName(fullpageDatasource?.provider)}
                />
              )}
          </div>
        </div>
        {isShowPreview && <FileViewer />}
      </div>
    </div>
  );
}

export default Chat;
