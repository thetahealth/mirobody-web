import { CHART_MESSAGE_TYPE } from "../../../../../enum/chat";
import { stripCitations } from "../../Render/Citations/markup";
import styles from "./index.module.scss";
import { useEffect, useRef, useState } from "react";
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import CostIcon from "../CostIcon";

function AssistantCard({
  datasource,
  children,
  isShowFullpage,
  fullpageDatasource,
  onToggleFullpage,
  modelShowName = "",
}) {
  const contentRef = useRef(null);
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // click copy to clipboard
  const onClickCopy = (datasource) => {
    const content = datasource?.messages
      .filter((msg) => msg.type === CHART_MESSAGE_TYPE.TEXT)
      .map((msg) => stripCitations(msg.text))
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(content);
    setCopied(true);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1400);
  };

  // Auto-scroll to bottom when content changes
  // useEffect(() => {
  //   if (contentRef.current) {
  //     contentRef.current.scrollTop = contentRef.current.scrollHeight;
  //   }
  // }, [children, datasource?.content]);

  // The turn's token usage — one block, at the end of the run.
  const usage = datasource?.messages?.find(
    (msg) => msg.type === CHART_MESSAGE_TYPE.USAGE,
  );

  // Check if this specific card is in fullpage mode
  const isThisCardFullpage =
    isShowFullpage && fullpageDatasource?.id === datasource?.id;

  // click fullpage - handle toggle logic internally
  const onClickFullpage = () => {
    if (onToggleFullpage) {
      if (isThisCardFullpage) {
        // If currently fullpage, close it
        onToggleFullpage(null);
      } else {
        // If not fullpage, open it
        onToggleFullpage(datasource);
      }
    }
  };
  return (
    <div
      className={`${styles.card} ${isThisCardFullpage ? styles.fullpage : ""}`}
    >
      <div className={styles.header}>
        {/* title: the full name is still reachable on hover once the header
            ellipsises it. */}
        <div className={styles.header_left} title={modelShowName || undefined}>
          {modelShowName ? `${modelShowName}` : ""}
        </div>
        <div className={styles.btns}>
          {usage && <CostIcon datasource={usage} />}
          <button
            type="button"
            className={styles.copy_btn}
            aria-label={copied ? t("copied") : t("copy")}
            onClick={() => onClickCopy(datasource)}
          >
            {copied ? (
              <IconCheck className={styles.copied_icon} size={16} stroke={2} />
            ) : (
              <IconCopy size={16} stroke={1.8} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className={styles.copy_btn}
            aria-label={isThisCardFullpage ? t("collapse") : t("expand")}
            onClick={onClickFullpage}
          >
            {isThisCardFullpage ? (
              <IconArrowsMinimize size={16} stroke={1.8} aria-hidden="true" />
            ) : (
              <IconArrowsMaximize size={16} stroke={1.8} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <div className={styles.content} ref={contentRef}>
        {children}
      </div>
    </div>
  );
}

export default AssistantCard;
