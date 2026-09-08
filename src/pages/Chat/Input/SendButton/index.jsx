import styles from "./index.module.scss";
import ChatSendDisSVG from "../../../../assets/chat-send-dis.svg?react";
import SendSVG from "../../../../assets/chat-send.svg?react";
import StopSVG from "../../../../assets/chat-input-stop.svg?react";
import { useChartInputStore } from "../../../../store/Chart/input";
import { useChatStore } from "../../../../store/Chart/index";
import { useChartDataStore } from "../../../../store/Chart/data";
import { canSend } from "../../../../utils";
import { useModelStore } from "../../../../store/model";

function SendButton({ onClick, onStopClick }) {
  const question = useChartInputStore((state) => state.question);
  const file_list = useChartInputStore((state) => state.file_list);
  const current_session_id = useChatStore((state) => state.current_session_id);
  const chartData = useChartDataStore((state) => state.chartData);
  const vs_list = useModelStore((state) => state.vs_list);

  const currentSession = current_session_id
    ? chartData[current_session_id]
    : null;
  const is_streaming = currentSession?.is_streaming || false;

  if (is_streaming) {
    return <StopSVG className={styles.btn} onClick={onStopClick} />;
  }

  if (!canSend(question, file_list, vs_list)) {
    return <ChatSendDisSVG className={styles.btn_dis} />;
  }

  return <SendSVG className={styles.btn} onClick={onClick} />;
}

export default SendButton;
