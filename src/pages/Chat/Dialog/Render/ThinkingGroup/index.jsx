import { useState, useEffect, useRef } from "react";
import styles from "./index.module.scss";
import ArrowDownSVG from "../../../../../assets/menu-arrow-down.svg?react";
import Markdown from "../Markdown";
import ContentRender from "../index";
import RenderErrorBoundary from "../ErrorBoundary";
import ChatThinkStepSVG from "../../../../../assets/chat_think_step.svg?react";
import { CHART_MESSAGE_TYPE } from "../../../../../enum/chat";
import { useTranslation } from "react-i18next";

// Preprocess thinking data to merge QUERY_TITLE and QUERY_DETAIL into QUERY_GROUP
const preprocessThinkingData = (datasource) => {
  if (!datasource || datasource.length === 0) return datasource;

  const isHistoricalData = datasource.some((item) => item.isHistorical);

  const detailMap = new Map();
  datasource.forEach((item) => {
    if (item.type === CHART_MESSAGE_TYPE.QUERY_DETAIL && item.tool_id) {
      detailMap.set(item.tool_id, item.content);
    }
  });

  const result = [];
  datasource.forEach((item) => {
    if (item.type === CHART_MESSAGE_TYPE.QUERY_TITLE) {
      const detail = item.tool_id ? detailMap.get(item.tool_id) || "" : "";

      const isQueryDetailStreaming =
        !detail && !isHistoricalData && item.status === "streaming";

      result.push({
        type: CHART_MESSAGE_TYPE.QUERY_GROUP,
        id: item.id,
        title: item.content,
        detail: detail,
        isQueryDetailStreaming: isQueryDetailStreaming,
      });
    } else if (item.type === CHART_MESSAGE_TYPE.QUERY_DETAIL) {
      // Skip QUERY_DETAIL items as they are merged into QUERY_GROUP
      // Do nothing
    } else {
      // Keep other items as is
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
      item.type === CHART_MESSAGE_TYPE.THINKING,
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
          <ArrowDownSVG
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
