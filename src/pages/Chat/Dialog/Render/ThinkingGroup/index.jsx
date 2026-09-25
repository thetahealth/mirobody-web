import { useState, useEffect, useRef } from "react";
import styles from "./index.module.scss";
import { IconChevronDown } from "@tabler/icons-react";
import Markdown from "../Markdown";
import ContentRender from "../index";
import RenderErrorBoundary from "../ErrorBoundary";
import { CHART_MESSAGE_TYPE } from "../../../../../enum/chat";
import { useTranslation } from "react-i18next";

// Pair each tool_call with its tool_result into one collapsible QUERY_GROUP.
// The two blocks are joined on the call id, which `tool_call` carries as `id`
// and `tool_result` as `tool_call_id` — LangChain's names for the same thing.
const preprocessThinkingData = (datasource) => {
  if (!datasource || datasource.length === 0) return datasource;

  const isHistoricalData = datasource.some((item) => item.isHistorical);

  const resultByCallId = new Map();
  datasource.forEach((item) => {
    if (item.type === CHART_MESSAGE_TYPE.TOOL_RESULT && item.tool_call_id) {
      resultByCallId.set(item.tool_call_id, item.content);
    }
  });

  const result = [];
  datasource.forEach((item, index) => {
    if (item.type === CHART_MESSAGE_TYPE.TOOL_CALL) {
      const detail = item.id ? resultByCallId.get(item.id) || "" : "";
      // Spin while the call is the last thing that happened and has no result
      // yet: that is a tool still running. Anything arriving after it stops the
      // spinner, so a turn that dies mid-tool cannot leave one turning forever.
      // The condition this replaces read `item.status === "streaming"`, a field
      // no block has ever carried, so the spinner never once appeared.
      const isQueryDetailStreaming =
        !detail && !isHistoricalData && index === datasource.length - 1;

      result.push({
        type: CHART_MESSAGE_TYPE.QUERY_GROUP,
        id: item.id,
        title: item.name,
        detail: detail,
        isQueryDetailStreaming: isQueryDetailStreaming,
      });
    } else if (item.type !== CHART_MESSAGE_TYPE.TOOL_RESULT) {
      // a tool_result is folded into its call's group above
      result.push(item);
    }
  });

  return result;
};

const ThinkingGroup = ({ datasource }) => {
  const [isExpanded, setIsExpanded] = useState(false); // collapsed by default
  const contentEndRef = useRef(null);
  const previousContentLength = useRef(0);
  const { t } = useTranslation();

  const processedDatasource = preprocessThinkingData(datasource);

  useEffect(() => {
    if (isExpanded && processedDatasource) {
      const currentLength = processedDatasource.length;
      const hasNewContent = currentLength > previousContentLength.current;

      if (hasNewContent && contentEndRef.current) {
        contentEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }

      previousContentLength.current = currentLength;
    }
  }, [processedDatasource, isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!processedDatasource || processedDatasource.length === 0) return null;

  const queryCount = processedDatasource.filter(
    (item) =>
      item.type === CHART_MESSAGE_TYPE.QUERY_GROUP ||
      item.type === CHART_MESSAGE_TYPE.REASONING,
  ).length;

  return (
    <div
      className={
        isExpanded
          ? "flex flex-col bg-[var(--color-bg-soft)] rounded-[12px] px-[12px] py-[8px] gap-[8px]"
          : "flex flex-col bg-[var(--color-bg-soft)] w-fit rounded-[12px] px-[12px] h-[36px] items-center justify-center gap-[8px]"
      }
    >
      <div
        className="flex items-center gap-[8px] cursor-pointer select-none"
        onClick={toggleExpanded}
      >
        <div
          className={
            isExpanded
              ? "text-[14px] font-[500] text-[var(--color-text-secondary)]"
              : "text-[var(--color-text-secondary)] text-[14px] font-[600]"
          }
        >
          {isExpanded ? t("hide") : queryCount} &nbsp;
          {queryCount === 1 ? t("step") : t("steps")}
        </div>
        <div className="w-[21px] h-[21px] flex items-center justify-center">
          <IconChevronDown
            size={13}
            stroke={2}
            className={`transition-transform duration-300 text-[var(--color-text-secondary)] ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>
      <div
        className={`${styles.thinking_content} ${
          !isExpanded ? styles.thinking_content_hidden : ""
        }`}
      >
        {processedDatasource.map((item, index) => {
          const isQueryGroup = item.type === CHART_MESSAGE_TYPE.QUERY_GROUP;

          // For QueryGroups, determine if it's the last one and pass the flag
          if (isQueryGroup) {
            const isLastQueryGroup = !processedDatasource
              .slice(index + 1)
              .some(
                (nextItem) => nextItem.type === CHART_MESSAGE_TYPE.QUERY_GROUP,
              );

            return (
              <RenderErrorBoundary key={index}>
                <ContentRender
                  datasource={{ ...item, isLast: isLastQueryGroup }}
                />
              </RenderErrorBoundary>
            );
          }

          return (
            <RenderErrorBoundary key={index}>
              <ContentRender datasource={item} />
            </RenderErrorBoundary>
          );
        })}
      </div>
    </div>
  );
};

export default ThinkingGroup;
