import { MESSAGE_ROLE } from "../../../../enum/chat";
import UserDialog from "../../Dialog/User";
import AssistantDialog from "../../Dialog/Assistant";
import styles from "./index.module.scss";
import ChatEndLineSVG from "../../../../assets/chat-endline.svg?react";

const RenderHistoryList = ({
  history_list = [],
  assistantDialogProps = {},
}) => {
  return (
    <>
      {history_list?.map((item) => {
        if (item.role === MESSAGE_ROLE.USER) {
          return <UserDialog datasource={item.messages} key={item.id} />;
        }
        if (item.role === MESSAGE_ROLE.ASSISTANT) {
          return (
            <AssistantDialog
              datasource={item.datasource}
              key={item.id}
              {...assistantDialogProps}
            />
          );
        }
        // For other roles, return default content
        return <div key={item.id}>--</div>;
      })}
      {history_list?.length > 0 && (
        <div className={styles.line}>
          <ChatEndLineSVG className={styles.line_svg} />
        </div>
      )}
    </>
  );
};

export default RenderHistoryList;
