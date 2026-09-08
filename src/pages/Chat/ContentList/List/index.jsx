import styles from "./index.module.scss";
import UserDialog from "../../Dialog/User/index";
import AssistantDialog from "../../Dialog/Assistant/index";
import { useChartDataStore } from "../../../../store/Chart/data";
import { useChatStore } from "../../../../store/Chart";

// Empty array constant to avoid re-creating on each render
const EMPTY_CONVERSATIONS = [];

function List({ containerHeight }) {
  const current_session_id = useChatStore((state) => state.current_session_id);
  const conversations = useChartDataStore((state) => {
    if (!current_session_id) return EMPTY_CONVERSATIONS;
    const data = state.chartData[current_session_id];
    return data?.conversations || EMPTY_CONVERSATIONS;
  });
  const isShowFullpage = useChatStore((state) => state.is_show_fullpage);
  const fullpageDatasource = useChatStore((state) => state.fullpage_datasource);
  const switchIsShowFullpage = useChatStore(
    (state) => state.switchIsShowFullpage,
  );
  const setFullpageDatasource = useChatStore(
    (state) => state.setFullpageDatasource,
  );

  if (!current_session_id) {
    return null;
  }

  const handleToggleFullpage = (datasource) => {
    if (datasource) {
      setFullpageDatasource(datasource);
    } else {
      setFullpageDatasource(null);
    }
    switchIsShowFullpage();
  };

  return (
    <>
      {conversations.map((conversation, index) => {
        const isLast = index === conversations.length - 1;

        return (
          <div
            key={conversation.id}
            className={styles.conversation_container}
            style={{
              minHeight:
                isLast && containerHeight > 0 ? `${containerHeight}px` : "auto",
            }}
          >
            {conversation.question_list &&
              conversation.question_list.length > 0 && (
                <UserDialog datasource={conversation.question_list} />
              )}

            {conversation.assistant_list &&
              conversation.assistant_list.length > 0 && (
                <AssistantDialog
                  datasource={conversation.assistant_list}
                  isShowFullpage={isShowFullpage}
                  fullpageDatasource={fullpageDatasource}
                  onToggleFullpage={handleToggleFullpage}
                />
              )}
          </div>
        );
      })}
    </>
  );
}

export default List;
