// AskUser — the agent asked a question and is waiting (`widget` chunk from
// the backend's ask_user interrupt). Options render as one-tap buttons; a tap
// sends the option text as an ordinary message, which resumes the paused
// turn on the backend (the checkpointer knows the thread is waiting). Free
// text typed in the composer works the same way, so this is a shortcut, not
// a gate.
import { Button } from "antd";
import { useChartInputStore } from "../../../../../store/Chart/input";
import { useChatStore } from "../../../../../store/Chart";
import { useChartDataStore } from "../../../../../store/Chart/data";
import styles from "./index.module.scss";

const parse = (content) => {
  if (!content) return null;
  if (typeof content === "string") {
    try {
      return JSON.parse(content);
    } catch {
      return { question: content, config: {} };
    }
  }
  return content;
};

const AskUser = ({ datasource }) => {
  const data = parse(datasource?.content) || datasource || {};
  const question = data.question || "";
  const options = data?.config?.options || [];
  const currentSessionId = useChatStore((s) => s.current_session_id);
  const isStreaming = useChartDataStore((s) =>
    currentSessionId ? s.chartData?.[currentSessionId]?.is_streaming || false : false,
  );

  const answer = (text) => {
    if (isStreaming) return;
    useChartInputStore.getState().setQuestion(text);
    useChatStore.getState().startMultipleChatSSE();
  };

  return (
    <div className={styles.wrap}>
      {question && <div className={styles.question}>{question}</div>}
      {options.length > 0 && (
        <div className={styles.options}>
          {options.map((o) => (
            <Button key={o} size="small" disabled={isStreaming} onClick={() => answer(o)}>
              {o}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AskUser;
