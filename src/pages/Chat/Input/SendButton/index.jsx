import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";
import ChatSendDisSVG from "../../../../assets/chat-send-dis.svg?react";
import SendSVG from "../../../../assets/chat-send.svg?react";
import StopSVG from "../../../../assets/chat-input-stop.svg?react";
import { useChartInputStore } from "../../../../store/Chart/input";
import { useChatStore } from "../../../../store/Chart/index";
import { useChartDataStore } from "../../../../store/Chart/data";
import { canSend } from "../../../../utils";
import { useModelStore } from "../../../../store/model";

// Real <button>s, not bare SVGs with an onClick. Sending a message and stopping
// a running answer are the two most-used actions in the product, and neither
// was in the accessibility tree: Tab could not reach them and a screen reader
// announced nothing. The disabled state is the `disabled` attribute now rather
// than a second, unclickable icon — so it is also announced as disabled.
function SendButton({ onClick, onStopClick }) {
  const { t } = useTranslation();
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
    return (
      <button
        type="button"
        className={styles.btn}
        aria-label={t("chat_stop")}
        onClick={onStopClick}
      >
        <StopSVG aria-hidden="true" />
      </button>
    );
  }

  const ready = canSend(question, file_list, vs_list);

  return (
    <button
      type="button"
      className={styles.btn}
      aria-label={t("chat_send")}
      disabled={!ready}
      onClick={onClick}
    >
      {ready ? <SendSVG aria-hidden="true" /> : <ChatSendDisSVG aria-hidden="true" />}
    </button>
  );
}

export default SendButton;
