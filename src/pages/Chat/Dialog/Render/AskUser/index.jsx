// AskUser — the agent asked a question and the run is paused on it (an
// `interrupt` block, LangGraph's shape: the pending call under its own name
// and arguments). Options render as one-tap buttons; a tap sends the option
// text as an ordinary message, which resumes the paused turn on the backend
// (the checkpointer knows the thread is waiting). Free text typed in the
// composer works the same way, so this is a shortcut, not a gate.
import { Button } from "antd";
import { useChartInputStore } from "../../../../../store/Chart/input";
import { useChatStore } from "../../../../../store/Chart";
import { useChartDataStore } from "../../../../../store/Chart/data";
import styles from "./index.module.scss";

const AskUser = ({ datasource }) => {
  const args = datasource?.args || {};
  const question = args.question || "";
  const options = args.options || [];
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
