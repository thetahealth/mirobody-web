import { useAnswerCopy } from "./useAnswerCopy";
import styles from "./index.module.scss";
import ContentRender from "../Render";
import RenderErrorBoundary from "../Render/ErrorBoundary";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import AssistantCard from "./AssistantCard";
import { CHART_MESSAGE_TYPE } from "../../../../enum/chat";
import { markActiveGroup, transformMessagesToThinkingGroup } from "../../../../utils";
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

  const { copy, copied, copyFailed, canCopy } = useAnswerCopy(datasource[0]?.messages);

  if (isSingle) {
    const messages = datasource[0]?.messages || [];
    const status = datasource[0]?.status;
    const usage = messages.find((msg) => msg.type === CHART_MESSAGE_TYPE.USAGE);
    const groupedMessages = markActiveGroup(transformMessagesToThinkingGroup(messages), status !== "end");

    return (
      <div className={styles.single_wrapper}>
        <StatusHeader datasource={messages} status={status} completionReason={datasource[0]?.completion_reason} />
        <div className={styles.single_content}>
          <div className="bg-[#fff] rounded-[16px_16px_16px_2px] text-[18px] font-[400] flex flex-col gap-[12px]">
            {groupedMessages.map((message) => (
              <RenderErrorBoundary key={message.id}>
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
                onClick={copy}
                disabled={!canCopy}
              >
                {copied ? (
                  <IconCheck className={styles.copied_icon} size={15} stroke={2} />
                ) : (
                  <IconCopy size={15} stroke={1.8} aria-hidden="true" />
                )}
              </button>
              {copyFailed ? <span role="status" className={styles.copy_error}>{t("copy_answer_failed")}</span> : null}
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
