import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import api from "../../api";
import {
  APPENDABLE_MESSAGE_TYPES,
  CHART_MESSAGE_TYPE,
  CHAT_HISTORY_SWITCH,
  MESSAGE_ROLE,
  isValidChartMessageType,
} from "../../enum/chat";
import { useAccountStore } from "../account";
import { useChatStore } from ".";
import { useChartDataStore } from "./data";
import { getFileType } from "../../utils/file";
import { foldSiblingSummaries, decodeGroupKey } from "../../utils/compareSession";
import consola from "consola";

/**
 * Merge consecutive messages with the same type
 * Only merges blocks that are in APPENDABLE_MESSAGE_TYPES (text, reasoning)
 * Other types like tool_call and tool_result remain separate
 * @param {Array} messages - Array of message objects
 * @returns {Array} - Merged messages array
 */
export const mergeConsecutiveSameTypeMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }

  // Helper: Check if two messages can be merged
  const canMerge = (prev, curr) =>
    prev &&
    prev.type === curr.type &&
    APPENDABLE_MESSAGE_TYPES.includes(curr.type);

  // Helper: join two blocks on the field their type carries text in — each
  // block names its own payload the way LangChain names it, so there is no
  // single `content` to concatenate any more.
  const mergeMessages = (prev, curr) => {
    const field = prev.type === CHART_MESSAGE_TYPE.TEXT ? "text" : "reasoning";
    return { ...prev, [field]: (prev[field] ?? "") + (curr[field] ?? "") };
  };

  const { result, pending } = messages.reduce(
    (acc, message) => {
      const msg = { ...message };

      // If can merge with pending message, merge them
      if (canMerge(acc.pending, msg)) {
        return {
          ...acc,
          pending: mergeMessages(acc.pending, msg),
        };
      }

      // Otherwise, flush pending to result and set new pending
      return {
        result: acc.pending ? [...acc.result, acc.pending] : acc.result,
        pending: msg,
      };
    },
    { result: [], pending: null },
  );

  // Don't forget to add the last pending message
  return pending ? [...result, pending] : result;
};

export const useChatHistoryStore = create(
  immer((set, get) => ({
    // Internal state: AbortControllers for history requests
    _historyController: null,
    _historyByPersonController: null,

    history_mode: CHAT_HISTORY_SWITCH.CONVERSATION,
    setHistoryMode: async (history_mode) => {
      const { fetchHistoryByConversationList, fetchHistoryByPersonList } =
        get();
      try {
        if (history_mode === get().history_mode) {
          return;
        }
        set({ history_mode });
        if (history_mode === CHAT_HISTORY_SWITCH.CONVERSATION) {
          await fetchHistoryByConversationList();
        } else {
          await fetchHistoryByPersonList();
        }
      } catch (error) {
        consola.error("ERROR: setHistoryMode", error);
      }
    },
    conversation_list: [],
    // Raw rows (one per backend session). Display list folds sibling compare
    // panes into one item; this keeps the per-session ids for sibling lookup
    // (switchSession / delete).
    conversation_list_raw: [],
    // An empty list and a failed fetch used to render identically — a blank
    // panel with nothing to explain it and no way to retry. These three say
    // which it is; `history_loaded` stays false until the first attempt
    // settles, so the first paint shows a skeleton rather than "no history".
    history_loading: false,
    history_loaded: false,
    history_error: false,
    /**
     * fetch history by conversation list
     * @returns {void}
     */
    fetchHistoryByConversationList: async () => {
      const { _historyController } = get();

      try {
        set({ history_loading: true, history_error: false });
        // Cancel previous request if exists
        if (_historyController) {
          _historyController.abort();
        }

        // Create new AbortController
        const newController = new AbortController();
        set({ _historyController: newController });
        const signal = newController.signal;

        const { summaries } = await api.chatHistory({ signal });

        const { current_session_id } = useChatStore.getState();
        const { chartData } = useChartDataStore.getState();

        set((state) => {
          // Protect sessions that should not be removed:
          // 1. Current active session
          // 2. Sessions that are streaming
          const protectedSessionIds = new Set();

          // Protect current session
          if (current_session_id) {
            protectedSessionIds.add(current_session_id);
          }

          // Protect streaming sessions
          Object.keys(chartData).forEach((sessionId) => {
            if (chartData[sessionId]?.is_streaming) {
              protectedSessionIds.add(sessionId);
            }
          });

          // Keep local protected rows not yet in server response. Operate on
          // the RAW list (source of truth): protected ids are session/group
          // keys; raw holds per-session ids plus optimistic entries.
          const serverSessionIds = new Set(summaries.map((s) => s.session_id));
          const localProtectedSessions = state.conversation_list_raw.filter(
            (item) =>
              protectedSessionIds.has(item.session_id) &&
              !serverSessionIds.has(item.session_id),
          );

          // Raw rows (one per session, plus optimistic) for sibling lookup.
          state.conversation_list_raw = [...localProtectedSessions, ...summaries];
          // Display: collapse sibling compare panes into one item per group.
          state.conversation_list = foldSiblingSummaries(
            state.conversation_list_raw,
          );
          // Clear controller after successful completion
          state._historyController = null;
          state.history_loading = false;
          state.history_loaded = true;
          state.history_error = false;
        });

        // Sync summary to chartData (outside history store's set callback).
        // chartData is keyed by the conversation key (group key for compare),
        // while summaries carry per-session ids, so map pane ids to their group.
        const summaryUpdates = summaries
          .filter((item) => item.summary)
          .map((item) => ({
            key: decodeGroupKey(item.session_id),
            summary: item.summary,
          }))
          .filter((item) => chartData[item.key]);
        if (summaryUpdates.length > 0) {
          useChartDataStore.setState((dataState) => {
            summaryUpdates.forEach((item) => {
              if (dataState.chartData[item.key]) {
                dataState.chartData[item.key].summary = item.summary;
              }
            });
          });
        }
      } catch (error) {
        if (error.name === "AbortError" || error.name === "CanceledError") {
          // A superseded request is not a failure — leave the flags to the
          // request that replaced it.
          return;
        }
        consola.error("ERROR: fetchHistoryByConversationList", error);
        set({
          _historyController: null,
          history_loading: false,
          history_loaded: true,
          history_error: true,
        });
      }
    },
    person_list: [],
    /**
     * fetch history by person list
     * @returns {void}
     */
    fetchHistoryByPersonList: async () => {
      const { _historyByPersonController } = get();

      try {
        // Cancel previous request if exists
        if (_historyByPersonController) {
          _historyByPersonController.abort();
        }

        // Create new AbortController
        const newController = new AbortController();
        set({ _historyByPersonController: newController });
        const signal = newController.signal;

        const { user_id, user_name } = useAccountStore.getState();
        const res = await api.historyByPerson({ user_id, user_name, signal });

        set((state) => {
          const { current_session_id } = useChatStore.getState();
          const { chartData } = useChartDataStore.getState();

          // Protect sessions that should not be removed
          const protectedSessionIds = new Set();

          // Protect current session
          if (current_session_id) {
            protectedSessionIds.add(current_session_id);
          }

          // Protect streaming sessions
          Object.keys(chartData).forEach((sessionId) => {
            if (chartData[sessionId]?.is_streaming) {
              protectedSessionIds.add(sessionId);
            }
          });

          // Merge person_list: for each person, merge their sessions.
          // sessions_raw = per-session source of truth; sessions = folded view.
          state.person_list = res.map((serverPerson) => {
            const localPerson = state.person_list.find(
              (p) => p.person_name === serverPerson.person_name,
            );

            const serverSessions = serverPerson.sessions || [];
            const localRaw = localPerson?.sessions_raw || [];

            // Keep local protected sessions that are not in server response
            const serverSessionIds = new Set(
              serverSessions.map((s) => s.session_id),
            );
            const localProtectedSessions = localRaw.filter(
              (session) =>
                protectedSessionIds.has(session.session_id) &&
                !serverSessionIds.has(session.session_id),
            );

            const mergedRaw = [...localProtectedSessions, ...serverSessions];
            return {
              ...serverPerson,
              sessions: foldSiblingSummaries(mergedRaw),
              sessions_raw: mergedRaw,
            };
          });
          // Clear controller after successful completion
          state._historyByPersonController = null;
        });
      } catch (error) {
        if (error.name === "AbortError" || error.name === "CanceledError") {
          return;
        }
        consola.error("ERROR: fetchHistoryByPersonList", error);
        set({ _historyByPersonController: null });
      }
    },
    /**
     * fetch history by session id
     * @param {string} session_id
     * @returns {Array} history
     */
    fetchChatHistoryBySessionId: async (session_id) => {
      const { setLoadingChartSession } = useChatStore.getState();
      setLoadingChartSession(true);
      try {
        const { history } = await api.chatHistoryBySessionId({
          session_id,
        });
        // transform history list
        // merge the messages that share a questionId
        const historyList = [];
        history.forEach((item) => {
          if (item.role === MESSAGE_ROLE.USER) {
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
                    `[History] Ignoring unknown user message type: "${item.messageType}"`,
                    {
                      type: item.messageType,
                      content: item.content,
                    },
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

          // create new item object to avoid mutating original
          // Filter out unsupported message types from backend
          const filteredContentDict = (item.content_dict || []).filter(
            (msg) => {
              if (!isValidChartMessageType(msg.type)) {
                consola.warn(
                  `[History] Ignoring unknown message type: "${msg.type}"`,
                  {
                    type: msg.type,
                    content: msg.content,
                  },
                );
                return false;
              }
              return true;
            },
          );
          // Mark messages as historical data
          const historicalMessages = mergeConsecutiveSameTypeMessages(
            filteredContentDict,
          ).map((msg) => ({
            ...msg,
            isHistorical: true,
          }));

          const processedItem = {
            ...item,
            status: "end",
            messages: historicalMessages,
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
      } catch (error) {
        consola.error("ERROR: fetchChatHistoryBySessionId", error);
        throw error;
      } finally {
        setLoadingChartSession(false);
      }
    },

    /* refresh history */
    refreshHistory: () => {
      const { fetchHistoryByConversationList, fetchHistoryByPersonList } =
        get();
      fetchHistoryByConversationList();
      fetchHistoryByPersonList();
    },

    /* add new session to lists immediately (for optimistic UI).
       session_id may be a single-model uuid or a compare group key; either way
       it goes into the RAW list and the display list is re-folded from raw so
       compare panes returned later collapse onto this same entry. */
    addNewSessionToLists: (session_id, query_user_id, person_name) => {
      set((state) => {
        // Add to conversation list (raw source of truth + folded display)
        state.conversation_list_raw.unshift({
          session_id,
          summary: "",
          query_user_id,
        });
        state.conversation_list = foldSiblingSummaries(
          state.conversation_list_raw,
        );

        // Add to person list
        const person = state.person_list.find(
          (p) => p.person_name === person_name,
        );
        if (person) {
          if (!person.sessions_raw) {
            person.sessions_raw = [];
          }
          person.sessions_raw.unshift({
            session_id,
            summary: "",
            query_user_id,
          });
          person.sessions = foldSiblingSummaries(person.sessions_raw);
        }
      });
    },
  })),
);
