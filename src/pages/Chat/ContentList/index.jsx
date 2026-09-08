import styles from "./index.module.scss";
import HistoryList from "./History";
import List from "./List";
import { useEffect, useRef, useState } from "react";
import { useChartDataStore } from "../../../store/Chart/data";
import { useChatStore } from "../../../store/Chart";
import { useParams } from "react-router";

function ContentList() {
  const { sessionId } = useParams();
  const contentListRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const current_session_id = useChatStore((state) => state.current_session_id);

  // Sync URL → store: restore session from URL on mount/refresh
  useEffect(() => {
    if (sessionId && sessionId !== useChatStore.getState().current_session_id) {
      useChartDataStore.getState().switchSession({ session_id: sessionId });
    }
  }, [sessionId]);
  const historyLength = useChartDataStore(
    (state) => state.chartData[current_session_id]?.history?.length || 0,
  );
  const conversationsLength = useChartDataStore(
    (state) => state.chartData[current_session_id]?.conversations?.length || 0,
  );

  // Calculate container height
  useEffect(() => {
    if (contentListRef.current) {
      const height = contentListRef.current.clientHeight;
      setContainerHeight(height);
    }
  }, [conversationsLength]);

  // Scroll to last user question when chat data changes
  useEffect(() => {
    const hasUserMessages = historyLength > 0 || conversationsLength > 0;

    if (contentListRef.current && hasUserMessages) {
      // Use setTimeout to ensure DOM is fully rendered after async data load
      setTimeout(() => {
        if (!contentListRef.current) return;

        const userMessages =
          contentListRef.current.querySelectorAll('[data-role="user"]');
        if (userMessages.length > 0) {
          const lastUserMessage = userMessages[userMessages.length - 1];
          lastUserMessage.scrollIntoView({
            block: "start",
            behavior: "smooth",
          });
        }
      }, 100);
    }
  }, [historyLength, conversationsLength, current_session_id]);

  return (
    <div
      id="content-list-wrapper"
      className={styles.wrapper}
      ref={contentListRef}
    >
      <div className={styles.content_list} style={{ minHeight: "100%" }}>
        <HistoryList />
        <List containerHeight={containerHeight} />
      </div>
    </div>
  );
}

export default ContentList;
