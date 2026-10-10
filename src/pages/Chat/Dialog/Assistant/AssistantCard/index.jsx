import styles from "./index.module.scss";
import Card from "../Card";
import ContentRender from "../../Render";
import RenderErrorBoundary from "../../Render/ErrorBoundary";
import StatusHeader from "../StatusHeader";
import { markActiveGroup, transformMessagesToThinkingGroup } from "../../../../../utils";
import { useModelStore } from "../../../../../store/model";
import { useTranslation } from "react-i18next";

function AssistantCard({
  datasource,
  isShowFullpage,
  fullpageDatasource,
  onToggleFullpage,
}) {
  const messages = datasource?.messages || [];
  const getModelShowName = useModelStore((state) => state.getModelShowName);

  // Display name from the provider. Messages from /api/history still carry an
  // `agent` field (`th_messages.agent` holds "Mirobody" now) and it must not be
  // branched on.
  const modelShowName = getModelShowName(datasource?.provider);

  const status = datasource?.status;
  const { t } = useTranslation();

  // if (messages.length === 0 && status !== "end") {
  //   return (
  //     <div className="flex-1">
  //       <StatusHeader datasource={messages} />
  //     </div>
  //   );
  // }

  if (messages.length === 0 && status === "end") {
    return (
      <Card
        datasource={datasource}
        isShowFullpage={isShowFullpage}
        fullpageDatasource={fullpageDatasource}
        onToggleFullpage={onToggleFullpage}
        modelShowName={modelShowName}
      >
        <div className={styles.content_wrapper}>
          <div className={styles.empty_state}>{t("no_response")}</div>
        </div>
      </Card>
    );
  }

  const groupedMessages = markActiveGroup(transformMessagesToThinkingGroup(messages), status !== "end");

  return (
    <Card
      datasource={datasource}
      isShowFullpage={isShowFullpage}
      fullpageDatasource={fullpageDatasource}
      onToggleFullpage={onToggleFullpage}
      modelShowName={modelShowName}
    >
      <div className={styles.content_wrapper}>
        <StatusHeader datasource={messages} />
        {groupedMessages.map((message, index) => (
          <RenderErrorBoundary key={index}>
            <ContentRender datasource={message} />
          </RenderErrorBoundary>
        ))}
      </div>
    </Card>
  );
}

export default AssistantCard;
