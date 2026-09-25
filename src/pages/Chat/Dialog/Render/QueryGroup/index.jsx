import { useState } from "react";
import styles from "./index.module.scss";
import { IconChevronDown, IconTool } from "@tabler/icons-react";
import QueryDetail from "../QueryDetail";
import QueryTitle from "../QueryTitle";

const QueryGroup = ({ datasource }) => {
  const [isExpanded, setIsExpanded] = useState(false); // Default collapsed

  const { title, detail, isQueryDetailStreaming, isLast } = datasource;

  const toggleExpanded = () => {
    if (!isQueryDetailStreaming) {
      setIsExpanded(!isExpanded);
    }
  };

  if (!title) return null;

  let lineClassName = "";
  if (isLast) {
    lineClassName = isExpanded ? styles.last_expanded_with_line : "";
  } else {
    lineClassName = styles.query_with_line;
  }

  const containerClassName = `flex flex-col gap-[8px] ${lineClassName}`;

  return (
    <div className={containerClassName}>
      <div
        className="flex items-center gap-[8px] cursor-pointer select-none w-fit"
        onClick={toggleExpanded}
        style={{ cursor: isQueryDetailStreaming ? "default" : "pointer" }}
      >
        <IconTool
          size={14}
          stroke={1.8}
          className="text-[var(--color-text-secondary)]"
          aria-hidden="true"
        />
        <QueryTitle content={title} />
        <div className="w-[24px] h-[24px] flex items-center justify-center bg-transparent rounded-[8px]">
          {isQueryDetailStreaming ? (
            <div className={styles.loading_spinner}></div>
          ) : (
            <IconChevronDown
              size={13}
              stroke={2}
              className={`transition-transform duration-300 text-[var(--color-text-primary)] ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
      </div>
      {isExpanded && detail && !isQueryDetailStreaming && (
        <QueryDetail content={detail} />
      )}
    </div>
  );
};

export default QueryGroup;
