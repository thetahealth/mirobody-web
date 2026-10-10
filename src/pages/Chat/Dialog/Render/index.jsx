import { CHART_MESSAGE_TYPE, blockText } from "../../../../enum/chat";
import Markdown from "./Markdown";
import ThinkingGroup from "./ThinkingGroup";
import styles from "./index.module.scss";
import QueryTitleRender from "./QueryTitle";
import QueryDetailRender from "./QueryDetail";
import ThinkingRender from "./Thinking";
import UserQuestion from "./UserQuestion";
import UserFileList from "./UserFileList";
import AskUser from "./AskUser";
import Notice from "./Notice";
import consola from "consola";
import ProtectedImage from "../../../../components/ProtectedImage";

// Parse image-message content to an object. Returns null on malformed JSON so
// the caller can render nothing — parsing is data work, kept out of JSX so the
// render path has no try/catch (React Compiler can't optimize JSX in try/catch;
// child render errors belong to an Error Boundary, not a local catch anyway).
function parseImageContent(content) {
  try {
    return typeof content === "string" ? JSON.parse(content) : content;
  } catch (error) {
    consola.error("ERROR: Parse image content", error);
    return null;
  }
}

const ContentRender = ({ datasource }) => {
  const type = datasource.type || CHART_MESSAGE_TYPE.DEFAULT;
  // Each block type names its own payload the way LangChain names it
  // (`text.text`, `reasoning.reasoning`, `tool_call.name`, …); `blockText`
  // is that table. The client's own grouping types still use `content`.
  const content = blockText(datasource);

  // the answer, streamed as markdown
  if (type === CHART_MESSAGE_TYPE.TEXT) {
    return (
      <div dir="auto" className={styles.markdown_wrapper}>
        <Markdown content={content} />
      </div>
    );
  }
  // user question
  if (type === CHART_MESSAGE_TYPE.USER_QUESTION) {
    return <UserQuestion datasource={datasource} />;
  }
  // user file list
  if (type === CHART_MESSAGE_TYPE.USER_FILE_LIST) {
    return <UserFileList datasource={datasource} />;
  }
  // thinking group
  if (type === CHART_MESSAGE_TYPE.THINKING_GROUP) {
    return <ThinkingGroup datasource={datasource.content} active={datasource.active} />;
  }
  // the model's own reasoning
  if (type === CHART_MESSAGE_TYPE.REASONING) {
    return <ThinkingRender content={content} />;
  }
  // a tool call: its name
  if (type === CHART_MESSAGE_TYPE.TOOL_CALL) {
    return <QueryTitleRender content={content} />;
  }
  // the agent's question to the user (ask_user); the run is paused on it
  if (type === CHART_MESSAGE_TYPE.INTERRUPT) {
    return <AskUser datasource={datasource} />;
  }
  // a tool result
  if (type === CHART_MESSAGE_TYPE.TOOL_RESULT) {
    return <QueryDetailRender content={content} />;
  }
  // image (chart images)
  if (type === CHART_MESSAGE_TYPE.IMAGE) {
    const imageData = parseImageContent(datasource.content);
    if (!imageData) return null;
    return (
      <div className="flex flex-col gap-[8px] my-[12px]">
        {imageData.title && (
          <div className="text-[14px] text-[var(--color-text-secondary)] font-medium">
            {imageData.title}
          </div>
        )}
        <ProtectedImage
          src={imageData.url}
          alt={imageData.filename || "chart"}
          className="w-full max-w-[600px] rounded-[8px] border border-[var(--color-border)]"
        />
      </div>
    );
  }
  // the system talking to the user, not the model
  if (type === CHART_MESSAGE_TYPE.NOTICE) {
    return <Notice content={content} />;
  }
  // token usage — not in the message flow; the AssistantCard header shows it
  if (type === CHART_MESSAGE_TYPE.USAGE) {
    return null;
  }
  // error message - markdown on a separate line with error styling
  if (type === CHART_MESSAGE_TYPE.ERROR) {
    return (
      <div dir="auto" className={styles.error_wrapper}>
        <Markdown content={content} />
      </div>
    );
  }
  // Fallback for unknown types - prevent rendering objects that would crash React
  const fallback = content || datasource.content;
  if (typeof fallback === "object" && fallback !== null) {
    consola.warn(
      `[ContentRender] Encountered unknown block type with object content: "${type}"`,
      datasource,
    );
    return null;
  }
  return <>{fallback}</>;
};

export default ContentRender;
