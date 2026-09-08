import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  APPENDABLE_MESSAGE_TYPES,
  CHART_MESSAGE_TYPE,
  MESSAGE_ROLE,
} from "../../enum/chat";
import { v4 as uuidv4 } from "uuid";
import { useChatStore } from ".";
import { useChatHistoryStore } from "./history";
import { useModelStore } from "../model";
import { useAccountStore } from "../account";
import {
  encodePaneSessionId,
  isCompareGroupKey,
  decodeGroupKey,
  paneIndexOf,
  zipPaneHistories,
  COMPARE_PREFIX,
} from "../../utils/compareSession";
import consola from "consola";

/**
 * Append ONE streaming frame to an assistant's messages, merging consecutive
 * appendable types (reply/thinking) into the trailing message. Shared by the
 * per-frame action and the coalesced batch action so their semantics can't
 * drift apart.
 * @param {object} assistantItem - immer draft of the assistant entry
 * @param {{type:string, content:any, tool_id?:string}} frame
 */
const appendFrameToAssistant = (
  assistantItem,
  { type, content, tool_id, status, error_kind, truncated, finish_reason },
) => {
  const lastMessage = assistantItem.messages[assistantItem.messages.length - 1];
  if (
    lastMessage &&
    lastMessage.type === type &&
    APPENDABLE_MESSAGE_TYPES.includes(type)
  ) {
    // If the last message has the same type and is appendable, append content
    lastMessage.content += content;
  } else {
    // Otherwise, create a new message
    const newMessage = {
      type,
      content,
      id: uuidv4(),
    };
    // Add tool_id if it exists (for queryTitle and queryDetail)
    if (tool_id) {
      newMessage.tool_id = tool_id;
    }
    // Kept only when present. `queryDetail` gets `status` off the tool's
    // envelope — the machine-readable half, so the status line does not have
    // to recover "the tool refused" from a rendered table — and `end` gets
    // `finish_reason`. Both are additive: a frame without them looks exactly
    // as it did before.
    if (status) {
      newMessage.status = status;
    }
    if (error_kind) {
      newMessage.error_kind = error_kind;
    }
    if (truncated) {
      newMessage.truncated = true;
    }
    if (finish_reason) {
      newMessage.finish_reason = finish_reason;
    }
    assistantItem.messages.push(newMessage);
  }
};

/**
 * chartData
 * chartData: {
 *  [session_id]: {
 *    "session_id": "da63e194-8cea-4581-998a-6f3b404d8ad5",
 *    "summary": "", // conversation summary
 *    "query_user_id": "", // whose records this asks about ("ask on their behalf")
 *    "is_streaming": false, // a response is currently streaming
 *    // past conversations, as the history list shows them
 *    "history": [],
 *    // the live conversation — each entry holds one question/answer group
 *    conversations: [
 *      {
 *        id: "conversation_id",
 *        question_list: [
 *          {
 *            role: "user",
 *            type: CHART_MESSAGE_TYPE.USER_FILE_LIST,
 *            id: "uuid",
 *            content: [file_list],
 *          },
 *          {
 *            role: "user",
 *            type: CHART_MESSAGE_TYPE.USER_QUESTION,
 *            id: "uuid",
 *            question_id: "question_id",
 *            content: "question text",
 *          }
 *        ],
 *        assistant_list: [
 *          {
 *            role: "assistant",
 *            id: "uuid",
 *            provider: "provider_id",
 *            query_user_id: "",
 *            question_id: "",
 *            messages: [
 *              {
 *                type: CHART_MESSAGE_TYPE.REPLY,
 *                content: "",
 *                id: "",
 *              },
 *              {
 *                type: CHART_MESSAGE_TYPE.THINKING,
 *                content: "",
 *                id: "",
 *              },
 *              {
 *                type: CHART_MESSAGE_TYPE.QUERY_TITLE,
 *                content: "",
 *                id: "",
 *              },
 *              {
 *                type: CHART_MESSAGE_TYPE.QUERY_DETAIL,
 *                content: "",
 *                id: "",
 *              },
 *            ],
 *          },
 *        ]
 *      },
 *    ],
 *  }
 * }
 *
 */

export const useChartDataStore = create(
  immer((set, get) => ({
    chartData: {},
    /* set history by session_id */
    setHistoryBySessionId: (session_id, history) => {
      set((state) => {
        if (state.chartData[session_id]) {
          state.chartData[session_id].history = history;
        }
      });
    },
    /* set is_streaming by session_id */
    setIsStreamingBySessionId: (session_id, is_streaming) => {
      set((state) => {
        if (state.chartData[session_id]) {
          state.chartData[session_id].is_streaming = is_streaming;
        }
      });
    },
    /*  */
    /* add user question by session_id */
    addUserQuestionBySessionId: (session_id, question, file_list) => {
      const question_id = uuidv4();

      set((state) => {
        if (!state.chartData[session_id]) {
          state.chartData[session_id] = {
            session_id,
            conversations: [],
            history: [],
            is_streaming: false,
          };
        }
        const currentChartData = state.chartData[session_id];
        if (!currentChartData.conversations) {
          currentChartData.conversations = [];
        }

        const conversation_id = uuidv4();
        const question_list = [];

        // add file list
        if (file_list && file_list.length > 0) {
          question_list.push({
            role: MESSAGE_ROLE.USER,
            type: CHART_MESSAGE_TYPE.USER_FILE_LIST,
            id: uuidv4(),
            content: file_list,
          });
        }

        // add user question
        if (question && question.trim() !== "") {
          question_list.push({
            role: MESSAGE_ROLE.USER,
            type: CHART_MESSAGE_TYPE.USER_QUESTION,
            id: uuidv4(),
            question_id: question_id,
            content: question,
          });
        }

        // create new conversation
        currentChartData.conversations.push({
          id: conversation_id,
          question_list: question_list,
          assistant_list: [],
        });
      });

      return question_id;
    },
    /* add assistant response by session_id */
    addAssistantResponseBySessionId: (session_id, question_id) => {
      const { vs_list } = useModelStore.getState();
      const { current_query_user_id } = useAccountStore.getState();

      // Generate a conversation_id for backward compatibility with SSE
      const conversation_id = uuidv4();

      set((state) => {
        if (!state.chartData[session_id]) {
          state.chartData[session_id] = {
            conversations: [],
            is_streaming: false,
          };
        }
        const currentChartData = state.chartData[session_id];
        if (!currentChartData.conversations) {
          currentChartData.conversations = [];
        }

        // get last conversation
        const conversations = currentChartData.conversations;
        const lastConversation = conversations[conversations.length - 1];

        if (lastConversation) {
          // initialize assistant_list for the last conversation
          lastConversation.assistant_list = vs_list.map((_item, _index) => ({
            role: MESSAGE_ROLE.ASSISTANT,
            id: uuidv4(),
            provider: _item.provider,
            query_user_id: current_query_user_id,
            question_id: question_id,
            status: "streaming",
            messages: [],
            // Backend session_id for this pane. Compare: cmp_<group>_<idx>.
            // Single-model: the chartData key is already the backend uuid.
            session_id: isCompareGroupKey(session_id)
              ? encodePaneSessionId(session_id.slice(COMPARE_PREFIX.length), _index)
              : session_id,
          }));
        }

        currentChartData.is_streaming = false;
      });

      return conversation_id;
    },
    /* apply a BATCH of coalesced streaming frames in ONE store update.
     * Every SSE frame used to be its own setState; each update re-rendered the
     * whole conversation tree, so a long answer cost O(n²) render work. The
     * SSE layer buffers ~60ms of frames and flushes them here together. */
    applyStreamingFrames: (session_id, provider, frames) => {
      if (!frames || frames.length === 0) return;
      set((state) => {
        const currentChartData = state.chartData[session_id];
        if (!currentChartData) return;

        const conversations = currentChartData.conversations;
        if (!conversations || conversations.length === 0) return;

        const lastConversation = conversations[conversations.length - 1];
        if (!lastConversation) return;

        // `provider` is the pane key. It used to be (provider, agent),
        // because two agents could serve the same provider; there is one
        // agent since Mirobody 1.4.0, and `/api/models` returns bare provider
        // names, so the second half of the key had nothing left to select.
        const assistantItem = lastConversation.assistant_list?.find(
          (item) => item.provider === provider,
        );
        if (!assistantItem) return;

        for (const frame of frames) {
          appendFrameToAssistant(assistantItem, frame);
        }
      });
    },
    /* update streaming message by session_id and provider */
    updateStreamingMessageByProvider: (
      session_id,
      assistant_id,
      provider,
      type,
      content,
      tool_id,
    ) => {
      set((state) => {
        const currentChartData = state.chartData[session_id];
        if (!currentChartData) return;

        // get last conversation
        const conversations = currentChartData.conversations;
        if (!conversations || conversations.length === 0) return;

        const lastConversation = conversations[conversations.length - 1];
        if (!lastConversation) return;

        // find assistant by provider
        const assistantItem = lastConversation.assistant_list?.find(
          (item) => item.provider === provider,
        );
        if (!assistantItem) return;

        // Handle all message types in unified messages array
        appendFrameToAssistant(assistantItem, { type, content, tool_id });
      });
    },
    /* switch session */
    switchSession: async ({ session_id, summary, query_user_id }) => {
      const { setCurrentSessionId } = useChatStore.getState();
      const { fetchChatHistoryBySessionId } = useChatHistoryStore.getState();
      const { setCurrentQueryUserByUserId } = useAccountStore.getState();
      const { chartData } = get();
      try {
        if (!session_id) {
          throw new Error("session_id is required");
        }
        let currentChartData = chartData[session_id];
        if (!currentChartData) {
          currentChartData = {
            session_id,
            summary: summary || "",
            query_user_id: query_user_id || null,
            conversations: [],
            history: [],
            is_streaming: false,
          };

          if (isCompareGroupKey(session_id)) {
            // Group key: find sibling pane sessions from the raw conversation
            // list, fetch each, and zip into one multi-column history.
            const { conversation_list_raw = [] } =
              useChatHistoryStore.getState();
            const paneIds = conversation_list_raw
              .map((c) => c.session_id)
              .filter(
                (id) => decodeGroupKey(id) === session_id && id !== session_id,
              );
            const paneHistories = await Promise.all(
              paneIds.map(async (paneId) => ({
                paneIndex: paneIndexOf(paneId),
                history: await fetchChatHistoryBySessionId(paneId),
              })),
            );
            currentChartData.history = zipPaneHistories(paneHistories);
          } else {
            currentChartData.history =
              await fetchChatHistoryBySessionId(session_id);
          }
        }
        setCurrentSessionId(session_id);
        if (query_user_id) {
          setCurrentQueryUserByUserId(query_user_id);
        }

        set((state) => ({
          chartData: {
            ...state.chartData,
            [session_id]: currentChartData,
          },
        }));
      } catch (error) {
        consola.error("ERROR: switchSession", error);
      }
    },
  })),
);
