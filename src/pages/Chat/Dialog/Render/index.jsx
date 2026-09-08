import { CHART_MESSAGE_TYPE } from "../../../../enum/chat";
import Markdown from "./Markdown";
import ThinkingGroup from "./ThinkingGroup";
import QueryGroup from "./QueryGroup";
import styles from "./index.module.scss";
import QueryTitleRender from "./QueryTitle";
import QueryDetailRender from "./QueryDetail";
import ThinkingRender from "./Thinking";
import UserQuestion from "./UserQuestion";
import UserFileList from "./UserFileList";
import AskUser from "./AskUser";
import "../../../../../public/github-markdown-light.css";
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
  const { content } = datasource;
  const type = datasource.type || CHART_MESSAGE_TYPE.DEFAULT;

  // sse reply markdown
  if (type === CHART_MESSAGE_TYPE.REPLY) {
    return (
      <div dir="auto" className={`${styles.markdown_wrapper} markdown-body`}>
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
    return <ThinkingGroup datasource={datasource.content} />;
  }
  // query group
  if (type === CHART_MESSAGE_TYPE.QUERY_GROUP) {
    return <QueryGroup datasource={datasource} />;
  }
  // thinking
  if (type === CHART_MESSAGE_TYPE.THINKING) {
    return <ThinkingRender content={content} />;
  }
  // query title
  if (type === CHART_MESSAGE_TYPE.QUERY_TITLE) {
    return <QueryTitleRender content={content} />;
  }
  // the agent's question to the user (ask_user) with one-tap options
  if (type === CHART_MESSAGE_TYPE.WIDGET) {
    return <AskUser datasource={datasource} />;
  }
  // query detail
  if (type === CHART_MESSAGE_TYPE.QUERY_DETAIL) {
    return <QueryDetailRender content={content} />;
  }
  // image (chart images)
  if (type === CHART_MESSAGE_TYPE.IMAGE) {
    const imageData = parseImageContent(content);
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
  // cost statistics - not rendered in message flow, shown in AssistantCard header
  if (type === CHART_MESSAGE_TYPE.COST_STATISTICS) {
    return null;
  }
  // error message - markdown on a separate line with error styling
  if (type === CHART_MESSAGE_TYPE.ERROR) {
    return (
      <div dir="auto" className={`${styles.error_wrapper} markdown-body`}>
        <Markdown content={content} />
      </div>
    );
  }
  // Fallback for unknown types - prevent rendering objects that would crash React
  if (typeof content === "object" && content !== null) {
    consola.warn(
      `[ContentRender] Encountered unknown message type with object content: "${type}"`,
      { type, content },
    );
    return null;
  }
  return <>{content}</>;
};

export default ContentRender;
