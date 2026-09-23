import styles from "./index.module.scss";
import ChatHeader from "./ChatHeader";
import Input from "./Input";
import { useCallback, useEffect } from "react";
import FileViewer from "./FileViewer";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import AssistantCard from "./Dialog/Assistant/AssistantCard";
import { useChatStore } from "../../store/Chart/index";
import { useAccountStore } from "../../store/account";
import { useChatHistoryStore } from "../../store/Chart/history";
import { useChatPreviewStore } from "../../store/Chart/preview";
import { useModelStore } from "../../store/model";
import { Outlet, useMatch, useNavigate } from "react-router";

function Chat() {
  const navigate = useNavigate();
  // The welcome state is the index route (/ask with no session). Matching the
  // route rather than reading the store keeps this in step with whichever of
  // EmptyContent / ContentList the Outlet is actually rendering.
  const isWelcome = Boolean(useMatch({ path: "/ask", end: true }));
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
      <MobileTopBar />
      <div className={styles.chat}>
        <Sidebar />
        <div className={styles.content_wrapper}>
          <div
            className={`${styles.normal_content} ${
              isShowFullpage ? styles.hidden : ""
            }`}
            key="normal_content"
          >
            <ChatHeader />
            {/* Empty page: the greeting and the composer, centred together,
                with the composer handed to EmptyContent through the outlet
                context. Once there is a conversation the transcript takes the
                space and the composer returns to the floor. */}
            {isWelcome ? (
              <Outlet context={{ composer: <Input variant="welcome" /> }} />
            ) : (
              <>
                <Outlet />
                <Input />
              </>
            )}
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
