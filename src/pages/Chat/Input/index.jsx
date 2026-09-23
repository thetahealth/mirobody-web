import styles from "./index.module.scss";
import { useChatStore } from "../../../store/Chart/index";

import { Input } from "antd";
import FileList from "./FileList";
import { useState, useRef } from "react";
import SendButton from "./SendButton";
import { useTranslation } from "react-i18next";
import { openSelectFileDialog, handleOnDropFiles } from "../../../utils/file";
import { Tooltip } from "antd";
import { PaperClipOutlined } from "@ant-design/icons";
import { useChartInputStore } from "../../../store/Chart/input";
import { useChartDataStore } from "../../../store/Chart/data";
import consola from "consola";
const { TextArea } = Input;

// `variant="welcome"` is the centred composer on the empty chat page: same
// control, narrower column, no bottom margin (the stack owns its spacing).
function ChatInput({ variant }) {
  const { t } = useTranslation();

  /* new */
  const [isDragging, setIsDragging] = useState(false);
  const isComposingRef = useRef(false);
  const setQuestion = useChartInputStore((state) => state.setQuestion);
  const question = useChartInputStore((state) => state.question);
  const startUploadFilesToServer = useChartInputStore(
    (state) => state.startUploadFilesToServer,
  );
  const startMultipleChatSSE = useChatStore(
    (state) => state.startMultipleChatSSE,
  );
  const stopStreamingBySessionId = useChatStore(
    (state) => state.stopStreamingBySessionId,
  );
  const current_session_id = useChatStore((state) => state.current_session_id);
  const chartData = useChartDataStore((state) => state.chartData);

  // Check if current session is streaming
  const is_streaming = current_session_id
    ? chartData[current_session_id]?.is_streaming || false
    : false;

  /* input value change */
  const onTextareaChange = (e) => {
    setQuestion(e.target.value);
  };

  /* send user question message */
  const onSendClick = async () => {
    // Prevent sending if already streaming
    if (is_streaming) {
      consola.warn("WARN: Cannot send message while streaming");
      return;
    }
    startMultipleChatSSE();
  };
  /* stop streaming */
  const onStopClick = () => {
    if (current_session_id) {
      stopStreamingBySessionId(current_session_id);
    }
  };
  /* handle IME composition start */
  const onCompositionStart = () => {
    isComposingRef.current = true;
  };
  /* handle IME composition end */
  const onCompositionEnd = () => {
    isComposingRef.current = false;
  };
  /* handle press enter key */
  const onPressEnter = (e) => {
    // if user is composing (using IME like Chinese input), ignore the Enter key
    if (isComposingRef.current) {
      return;
    }
    // Shift+Enter: new line
    if (e.key === "Enter" && e.shiftKey) {
      return;
    }
    // Enter: send message
    if (e.key === "Enter") {
      e.preventDefault();
      // Prevent sending if already streaming
      if (is_streaming) {
        return;
      }
      onSendClick();
    }
  };
  /* upload button click */
  const onClickUploadBtn = async () => {
    try {
      const files = await openSelectFileDialog();
      startUploadFilesToServer(files);
    } catch (error) {
      consola.error("ERROR: onClickUploadBtn", error);
    }
  };
  const onDragEnter = (e) => {
    e.preventDefault();
    if (isDragging) return;
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    if (!isDragging) return;

    // Only set dragging to false if leaving the main container
    // Check if the related target is outside the drag container
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };
  const onDrop = (e) => {
    setIsDragging(false);
    const files = handleOnDropFiles(e);
    startUploadFilesToServer(files);
  };

  return (
    <div
      id="chat-input-wrapper"
      className={`${styles.input_wrapper} ${
        variant === "welcome" ? styles.welcome : ""
      }`}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {isDragging ? (
        <div
          className={styles.dragging_container}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className={styles.dragging_title}>
            {t("drag_and_drop_files_here")}
          </div>
          <div className={styles.dragging_des}>
            {t(
              "you_can_drag_and_drop_your_files_here_to_upload_or_use_the_upload_button_below",
            )}
          </div>
        </div>
      ) : (
        <div className={styles.input_container}>
          <FileList />
          <TextArea
            dir="auto"
            className={styles.input}
            placeholder={t("ask_anything_about_ur_health_data")}
            value={question}
            onChange={onTextareaChange}
            name="chat-input"
            autoSize={{ minRows: 1, maxRows: 8 }}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onPressEnter={onPressEnter}
          />
          <div className={styles.btns}>
            <Tooltip placement="topRight" title={t("upload_tip")}>
              {/* A real button: attaching a file was a bare SVG with an
                  onClick, so it was not in the accessibility tree and Tab
                  could not reach it. A paperclip rather than the plus it was:
                  a plus is "add something" and leaned on the tooltip to say
                  what. This is now the page's only way to attach a file. */}
              <button
                type="button"
                className={styles.upload_wrapper}
                aria-label={t("upload_files")}
                onClick={onClickUploadBtn}
              >
                <PaperClipOutlined className={styles.upload_icon} aria-hidden="true" />
              </button>
            </Tooltip>
            <div className={styles.right}>
              <SendButton onClick={onSendClick} onStopClick={onStopClick} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatInput;
