import styles from "./index.module.scss";
import ContentRender from "../Render";
import RenderErrorBoundary from "../Render/ErrorBoundary";
import CopySVG from "../../../../assets/chat-copy.svg?react";
import AssistantCard from "./AssistantCard";
import { CHART_MESSAGE_TYPE } from "../../../../enum/chat";
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

  const onCopyClick = (messages) => {
    // copy all messages content to clipboard
    const content = messages
      .filter((msg) => msg.type === CHART_MESSAGE_TYPE.TEXT)
      .map((msg) => msg.text)
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(content);
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
    const usage = messages.find(
      (msg) => msg.type === CHART_MESSAGE_TYPE.USAGE,
    );
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
              <CopySVG
                className="cursor-pointer"
                onClick={() => onCopyClick(messages)}
              />
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
