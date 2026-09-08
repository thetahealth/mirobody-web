import { useEffect, useState } from "react";
import { useParams } from "react-router";
import styles from "./index.module.scss";
import api from "../../api";
import { useTranslation } from "react-i18next";
import LogoSVG from "../../assets/logo.svg?react";
import {
  MESSAGE_ROLE,
  CHART_MESSAGE_TYPE,
  isValidChartMessageType,
} from "../../enum/chat";
import { getFileType } from "../../utils/file";
import { mergeConsecutiveSameTypeMessages } from "../../store/Chart/history";
import RenderHistoryList from "../Chat/ContentList/History/RenderHistoryList";
import AssistantCard from "../Chat/Dialog/Assistant/AssistantCard";
import { useModelStore } from "../../store/model";
import consola from "consola";

function Share() {
  const { t } = useTranslation();
  const { shareSessionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [isShowFullpage, setIsShowFullpage] = useState(false);
  const [fullpageDatasource, setFullpageDatasource] = useState(null);
  const getModelShowName = useModelStore((state) => state.getModelShowName);

  const initializeModel = useModelStore((state) => state.init);

  useEffect(() => {
    initializeModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (shareSessionId) {
      fetchShareContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareSessionId]);

  const fetchShareContent = async () => {
    setLoading(true);
    setError("");

    try {
      const { history: chatHistory } = await api.getShareContent({
        share_session_id: shareSessionId,
      });

      // Transform flat history to grouped structure
      const transformedHistory = transformHistory(chatHistory || []);
      setHistory(transformedHistory);
    } catch (err) {
      consola.error("Fetch share content error:", err);
      setError(t("share_not_found") || "Share link not found or expired");
    } finally {
      setLoading(false);
    }
  };

  const transformHistory = (rawHistory) => {
    const historyList = [];

    rawHistory.forEach((item) => {
      if (item.role === MESSAGE_ROLE.USER) {
        // User message - following Chat's logic
        const user_item = {
          role: MESSAGE_ROLE.USER,
          questionId: item.questionId || "",
          messages: [],
          id: item.id,
        };

        switch (item.messageType) {
          case CHART_MESSAGE_TYPE.FILE:
          case CHART_MESSAGE_TYPE.IMAGE:
          case CHART_MESSAGE_TYPE.PDF:
            // File upload message
            user_item.messages = [
              {
                ...item,
                type: CHART_MESSAGE_TYPE.USER_FILE_LIST,
                content:
                  item.content_dict?.files?.map((f) => {
                    return {
                      file_key: f.file_key,
                      original_file_type: f.type,
                      file_type: getFileType(f.type),
                      file_name: f.file_name,
                      file_url: f.url_full,
                      file_size: f.file_size,
                    };
                  }) || [],
              },
            ];
            break;
          case CHART_MESSAGE_TYPE.TEXT:
            // Text message
            user_item.messages = [
              {
                ...item,
                type: CHART_MESSAGE_TYPE.USER_QUESTION,
              },
            ];
            break;
          default:
            // Validate messageType - ignore unknown types from backend
            if (
              item.messageType &&
              !isValidChartMessageType(item.messageType)
            ) {
              consola.warn(
                `[Share] Ignoring unknown user message type: "${item.messageType}"`,
                { type: item.messageType, content: item.content },
              );
              return; // Skip this item entirely
            }
            user_item.messages = [
              {
                ...item,
                type: item.messageType || CHART_MESSAGE_TYPE.USER_QUESTION,
              },
            ];
            break;
        }

        historyList.push(user_item);
        return;
      }

      // Assistant message
      // Filter out unsupported message types from backend
      const filteredContentDict = (item.content_dict || []).filter((msg) => {
        if (!isValidChartMessageType(msg.type)) {
          consola.warn(
            `[Share] Ignoring unknown message type: "${msg.type}"`,
            { type: msg.type, content: msg.content },
          );
          return false;
        }
        return true;
      });
      const processedItem = {
        ...item,
        messages: mergeConsecutiveSameTypeMessages(filteredContentDict),
      };

      const currentHistoryItem = historyList.find(
        (i) =>
          i.question_id === item.questionId &&
          i.role === MESSAGE_ROLE.ASSISTANT,
      );

      if (!currentHistoryItem) {
        historyList.push({
          role: MESSAGE_ROLE.ASSISTANT,
          question_id: item.questionId,
          datasource: [processedItem],
          id: item.id,
        });
        return;
      }

      currentHistoryItem.datasource.push(processedItem);
    });

    return historyList;
  };

  return (
    <div className={styles.shareWrapper}>
      <div className={styles.header}>
        <LogoSVG className={styles.logo} />
      </div>

      <div className={styles.content}>
        <div
          className={`${styles.normalContent} ${
            isShowFullpage ? styles.hidden : ""
          }`}
        >
          {loading && (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <div className={styles.loadingText}>{t("loading")}</div>
            </div>
          )}

          {!loading && error && (
            <div className={styles.errorContainer}>
              <div className={styles.errorText}>{error}</div>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className={styles.content_list}>
              <RenderHistoryList
                history_list={history}
                assistantDialogProps={{
                  isShowFullpage,
                  fullpageDatasource,
                  onToggleFullpage: (datasource) => {
                    if (datasource) {
                      setFullpageDatasource(datasource);
                      setIsShowFullpage(true);
                    } else {
                      setFullpageDatasource(null);
                      setIsShowFullpage(false);
                    }
                  },
                }}
              />
            </div>
          )}
        </div>

        <div
          className={`${styles.fullpageContent} ${
            !isShowFullpage ? styles.hidden : ""
          }`}
        >
          {isShowFullpage && fullpageDatasource && (
            <AssistantCard
              datasource={fullpageDatasource}
              isShowFullpage={isShowFullpage}
              fullpageDatasource={fullpageDatasource}
              onToggleFullpage={(datasource) => {
                if (datasource) {
                  setFullpageDatasource(datasource);
                  setIsShowFullpage(true);
                } else {
                  setFullpageDatasource(null);
                  setIsShowFullpage(false);
                }
              }}
              modelShowName={getModelShowName(fullpageDatasource?.provider)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Share;
