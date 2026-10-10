import styles from "./index.module.scss";
import HistoryList from "./History";
import List from "./List";
import { useEffect, useRef, useState } from "react";
import { useChartDataStore } from "../../../store/Chart/data";
import { useChatStore } from "../../../store/Chart";
import { useParams } from "react-router";
import CiteRegistryProvider from "../Dialog/Render/Citation/CiteRegistryProvider";

// How close to the bottom still counts as "following the live reply".
const NEAR_BOTTOM_PX = 120;

function ContentList() {
  const { sessionId } = useParams();
  const contentListRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const current_session_id = useChatStore((state) => state.current_session_id);
  // Session-wide on purpose: the backend mints one RidTable per record, so a
  // later turn may cite a row an earlier turn surfaced. The registry is
  // indexed in the store at write time (data.js), so this selector's value
  // only changes when a tool_result lands — not per streamed token.
  const citeRegistry = useChartDataStore(
    (state) => state.chartData[current_session_id]?.cite_registry,
  );

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

  // Has the reader deliberately moved away from the live end of the transcript?
  // Tracked from `wheel` / `touchmove` rather than `scroll` on purpose: the
  // programmatic scrollIntoView below fires `scroll` too, so a scroll listener
  // cannot tell the reader's intent from our own.
  const readerHeldPositionRef = useRef(false);
  const lastSessionRef = useRef(null);

  useEffect(() => {
    const el = contentListRef.current;
    if (!el) return;
    const onReaderScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      readerHeldPositionRef.current = distanceFromBottom > NEAR_BOTTOM_PX;
    };
    el.addEventListener("wheel", onReaderScroll, { passive: true });
    el.addEventListener("touchmove", onReaderScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onReaderScroll);
      el.removeEventListener("touchmove", onReaderScroll);
    };
  }, []);

  // Scroll to last user question when chat data changes
  useEffect(() => {
    const hasUserMessages = historyLength > 0 || conversationsLength > 0;
    if (!contentListRef.current || !hasUserMessages) return;

    // Opening or switching a conversation always lands on the newest turn,
    // whatever the reader was doing in the one before it.
    const isSessionChange = lastSessionRef.current !== current_session_id;
    if (isSessionChange) {
      lastSessionRef.current = current_session_id;
      readerHeldPositionRef.current = false;
    } else if (readerHeldPositionRef.current) {
      // Scrolling back to read an earlier turn is deliberate. A reply
      // streaming in used to yank the view off it several times a second.
      return;
    }

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
  }, [historyLength, conversationsLength, current_session_id]);

  return (
    <div
      id="content-list-wrapper"
      className={styles.wrapper}
      ref={contentListRef}
    >
      <div className={styles.content_list} style={{ minHeight: "100%" }}>
        <CiteRegistryProvider registry={citeRegistry}>
          <HistoryList />
          <List containerHeight={containerHeight} />
        </CiteRegistryProvider>
      </div>
    </div>
  );
}

export default ContentList;
