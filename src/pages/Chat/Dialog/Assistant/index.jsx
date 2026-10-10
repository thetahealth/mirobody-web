import { useEffect, useRef, useState } from "react";
import styles from "./index.module.scss";
import ContentRender from "../Render";
import RenderErrorBoundary from "../Render/ErrorBoundary";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import AssistantCard from "./AssistantCard";
import { CHART_MESSAGE_TYPE } from "../../../../enum/chat";
import { stripCitations } from "../Render/Citations/markup";
import Analyzing from "./Analyzing";
import { transformMessagesToThinkingGroup } from "../../../../utils";
import CostIcon from "./CostIcon";
import { useTranslation } from "react-i18next";
import { useModelStore } from "../../../../store/model";
import StatusHeader from "./StatusHeader";

function AssistantDialog({
  datasource,
  isShowFullpage,
  fullpageDatasource,
  onToggleFullpage,
}) {
  const isSingle = datasource.length === 1;
  const { t } = useTranslation();
  const getModelShowName = useModelStore((state) => state.getModelShowName);

  // Copying an answer was a silent no-op visually, so people clicked it twice
  // and still did not know. ShareModal already had this exact acknowledgement
  // (a "copied" flag on a timer) and the `copied` string is already translated.
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const onCopyClick = (messages) => {
    // copy all messages content to clipboard
    const content = messages
      .filter((msg) => msg.type === CHART_MESSAGE_TYPE.TEXT)
      .map((msg) => stripCitations(msg.text))
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(content);
    setCopied(true);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1400);
  };

  if (isSingle) {
    const messages = datasource[0]?.messages || [];
    const status = datasource[0]?.status;
    // if (messages.length === 0 && status !== "end") {
    //   return <Analyzing />;
    // }
    // no response
    if (messages.length === 0 && status === "end") {
      return (
        <div className={styles.single_wrapper}>
          <div className={styles.single_content}>
            <div className="bg-[#fff] rounded-[16px_16px_16px_2px] text-[18px] font-[400] flex flex-col gap-[12px]">
              <div className={styles.empty_state}>{t("no_response")}</div>
            </div>
          </div>
        </div>
      );
    }
    const usage = messages.find((msg) => msg.type === CHART_MESSAGE_TYPE.USAGE);
    const groupedMessages = transformMessagesToThinkingGroup(messages);

    return (
      <div className={styles.single_wrapper}>
        <StatusHeader datasource={messages} />
        <div className={styles.single_content}>
          <div className="bg-[#fff] rounded-[16px_16px_16px_2px] text-[18px] font-[400] flex flex-col gap-[12px]">
            {groupedMessages.map((message, index) => (
              <RenderErrorBoundary key={index}>
                <ContentRender datasource={message} />
              </RenderErrorBoundary>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 flex items-center text-[14px] font-[400] text-[var(--color-text-secondary)]">
              {getModelShowName(datasource[0]?.provider)}
            </div>
            <div className="flex-1 flex items-center justify-end">
              {usage && <CostIcon datasource={usage} />}
              <button
                type="button"
                className={styles.copy_btn}
                aria-label={copied ? t("copied") : t("copy")}
                onClick={() => onCopyClick(messages)}
              >
                {copied ? (
                  <IconCheck className={styles.copied_icon} size={15} stroke={2} />
                ) : (
                  <IconCopy size={15} stroke={1.8} aria-hidden="true" />
                )}
              </button>
              {/* <ThumbsUpSVG className={styles.btn} /> */}
              {/* <ThumbsDownSVG className={styles.btn} /> */}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.wrapper}>
      {datasource.map((item) => (
        <AssistantCard
          datasource={item}
          key={item.provider}
          isShowFullpage={isShowFullpage}
          fullpageDatasource={fullpageDatasource}
          onToggleFullpage={onToggleFullpage}
        />
      ))}
    </div>
  );
}

export default AssistantDialog;
