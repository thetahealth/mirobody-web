import { create } from "zustand";
import api from "../../api";
import { useAccountStore } from "../account";
import { CHART_MESSAGE_TYPE, isValidChartMessageType } from "../../enum/chat";
import { SSE_ERROR_TYPE } from "../../enum/error";
import { v4 as uuidv4 } from "uuid";
import i18n from "i18next";
import { useModelStore } from "../model";
import { useChartInputStore } from "./input";
import { useChartDataStore } from "./data";
import { createFrameCoalescer } from "./frameCoalescer";
import { useChatHistoryStore } from "./history";
import { canSend } from "../../utils";
import {
  encodeGroupKey,
  encodePaneSessionId,
  isCompareGroupKey,
  COMPARE_PREFIX,
} from "../../utils/compareSession";
import consola from "consola";

// ============================================================================
// Helper Functions for startMultipleChatSSE
// ============================================================================

/**
 * Validate if chat can be sent
 * @returns {{ valid: boolean, question: string, fileList: Array, vsList: Array, promptName: string|null }}
 */
const validateAndGetChatInput = () => {
  const { vs_list } = useModelStore.getState();
  const { question, file_list } = useChartInputStore.getState();

  // No prompt override: the system prompt ships with the agent. (Base ignored
  // this field entirely, and on Deep a user prompt REPLACED the built-in health
  // prompt — see the note in ModelDropdown.)
  const promptName = null;

  if (!canSend(question, file_list, vs_list)) {
    return { valid: false };
  }

  return {
    valid: true,
    question: question || "",
    fileList: file_list,
    vsList: vs_list,
    promptName,
  };
};

/**
 * Check if current session is streaming
 * @param {string|null} sessionId
 * @returns {boolean}
 */
const isSessionStreaming = (sessionId) => {
  if (!sessionId) return false;
  const { chartData } = useChartDataStore.getState();
  return chartData[sessionId]?.is_streaming || false;
};

/**
 * Add user question and create assistant placeholder
 * @param {string} sessionId
 * @param {string} question
 * @param {Array} fileList
 * @returns {{ questionId: string, assistantId: string }}
 */
const prepareConversation = (sessionId, question, fileList) => {
  const { addUserQuestionBySessionId, addAssistantResponseBySessionId } =
    useChartDataStore.getState();

  const questionId = uuidv4();
  addUserQuestionBySessionId(sessionId, question, fileList);
  const assistantId = addAssistantResponseBySessionId(sessionId, questionId);

  return { questionId, assistantId };
};

/**
 * Start SSE connections for all models
 * @param {Object} params
 * @returns {Promise<Array>}
 */
const startSSEConnections = async ({
  vsList,
  sessionId,
  assistantId,
  question,
  fileList,
  queryUserId,
  questionId,
  isNewSession,
  promptName,
  controllers,
  fetchStartChatSSE,
}) => {
  const groupUuid = isCompareGroupKey(sessionId)
    ? sessionId.slice(COMPARE_PREFIX.length)
    : null;
  return Promise.allSettled(
    vsList.map((item, index) => {
      const controller = new AbortController();
      controllers.push(controller);
      // Compare: each pane has its own backend session_id + shared group_id.
      // Single-model: sessionId is the backend uuid; no group_id.
      // session_id stays the chartData/store key (group key in compare);
      // backend_session_id is the per-pane id actually sent to the backend.
      const paneSessionId = groupUuid
        ? encodePaneSessionId(groupUuid, index)
        : sessionId;
      return fetchStartChatSSE({
        provider: item.provider,
        question,
        session_id: sessionId,
        backend_session_id: paneSessionId,
        assistant_id: assistantId,
        file_list: fileList,
        current_query_user_id: queryUserId,
        questionId,
        controller,
        is_new_session: isNewSession,
        prompt_name: promptName,
      });
    }),
  );
};

/**
 * Cleanup SSE session after completion or error
 * @param {string} sessionId
 * @param {Map} sseControllers
 * @param {Function} setIsStreaming
 * @param {Function} updateStore
 */
const cleanupSSESession = (
  sessionId,
  sseControllers,
  setIsStreaming,
  updateStore,
) => {
  setIsStreaming(sessionId, false);
  sseControllers.delete(sessionId);
  updateStore({ _sseControllers: new Map(sseControllers) });
};

// ============================================================================
// Store Definition
// ============================================================================

export const useChatStore = create((set, get) => ({
  // Internal state: Track which new sessions have already refreshed history
  _refreshedSessionIds: new Set(),

  /* current session */
  current_session_id: null,
  /**
   * set current session id
   * @param {string} current_session_id
   * @returns {void}
   */
  setCurrentSessionId: (current_session_id) => {
    set({ current_session_id });
  },
  /**
   * fetch new chat session
   * @returns {string} session_id
   */
  fetchNewChatSession: async () => {
    try {
      const { current_query_user_id } = useAccountStore.getState();
      if (!current_query_user_id) {
        throw new Error("current_query_user_id is required");
      }
      const { session_id } = await api.newChatSession({
        query_user_id: current_query_user_id,
      });
      // const session_id = uuidv4();
      set({ current_session_id: session_id });
      return session_id;
    } catch (error) {
      set({ current_session_id: null });
      consola.error("ERROR: fetchNewChatSession", error);
      throw error;
    }
  },

  /* start a new chat */
  startNewChat: () => {
    const { current_session_id } = get();
    if (current_session_id === null) return;
    set({ current_session_id: null });
    const { setCurrentQueryUserByUserId, user_id } = useAccountStore.getState();
    setCurrentQueryUserByUserId(user_id);
  },
  /* full page mode */
  is_show_fullpage: false,
  switchIsShowFullpage: () => {
    set({ is_show_fullpage: !get().is_show_fullpage });
  },
  fullpage_datasource: null,
  setFullpageDatasource: (fullpage_datasource) => {
    set({ fullpage_datasource });
  },

  // Internal state: SSE AbortControllers map (session_id -> controllers array)
  _sseControllers: new Map(),

  /* set is_streaming by session_id */
  setIsStreamingBySessionId: (session_id, is_streaming) => {
    const { setIsStreamingBySessionId } = useChartDataStore.getState();
    setIsStreamingBySessionId(session_id, is_streaming);
  },

  /* stop streaming by session_id */
  stopStreamingBySessionId: (session_id) => {
    const { _sseControllers, setIsStreamingBySessionId } = get();
    const controllers = _sseControllers.get(session_id);

    if (controllers && controllers.length > 0) {
      controllers.forEach((controller) => {
        if (controller && !controller.signal.aborted) {
          controller.abort();
        }
      });
      _sseControllers.delete(session_id);
      set({ _sseControllers: new Map(_sseControllers) });
    }

    setIsStreamingBySessionId(session_id, false);
  },

  /* start multiple chat SSE */
  startMultipleChatSSE: async () => {
    const { current_query_user_id, user_name } = useAccountStore.getState();
    const { clearQuestion, clearFileList } = useChartInputStore.getState();
    const {
      current_session_id,
      fetchStartChatSSE,
      setIsStreamingBySessionId,
    } = get();

    // Step 1: Validate input
    const input = validateAndGetChatInput();
    if (!input.valid) {
      consola.error(
        "ERROR: startMultipleChatSSE - question, file_list, or vs_list is required",
      );
      return;
    }

    // Step 2: Check if already streaming
    if (isSessionStreaming(current_session_id)) {
      consola.warn(
        "WARN: Cannot start new chat while current session is streaming",
      );
      return;
    }

    // Step 3: Clear input immediately for better UX
    clearQuestion();
    clearFileList();

    // Step 4: Determine session (existing or new)
    let sessionId = current_session_id;
    let isNewSession = false;
    let questionId, assistantId;

    if (!sessionId && input.vsList.length > 1) {
      // ---- Compare mode: frontend-generated group, one session per pane ----
      isNewSession = true;
      const groupUuid = uuidv4();
      const groupKey = encodeGroupKey(groupUuid);
      sessionId = groupKey;

      // Optimistic UI: group key is known immediately, no temp→real swap.
      ({ questionId, assistantId } = prepareConversation(
        groupKey,
        input.question,
        input.fileList,
      ));
      setIsStreamingBySessionId(groupKey, true);
      set({ current_session_id: groupKey });

      // Create one th_sessions row per pane (needed for the history join).
      try {
        await Promise.all(
          input.vsList.map((_item, index) =>
            api.newChatSession({
              query_user_id: current_query_user_id,
              session_id: encodePaneSessionId(groupUuid, index),
            }),
          ),
        );
      } catch (error) {
        set({ current_session_id: null });
        useChartDataStore.setState((state) => {
          delete state.chartData[groupKey];
        });
        consola.error(
          "ERROR: startMultipleChatSSE - newChatSession(compare)",
          error,
        );
        return;
      }

      const { addNewSessionToLists } = useChatHistoryStore.getState();
      addNewSessionToLists(groupKey, current_query_user_id, user_name);
    } else if (!sessionId) {
      isNewSession = true;
      const pendingKey = `temp_${uuidv4()}`;

      // Prepare conversation immediately → ContentList shows Analyzing
      ({ questionId, assistantId } = prepareConversation(
        pendingKey,
        input.question,
        input.fileList,
      ));
      setIsStreamingBySessionId(pendingKey, true);
      set({ current_session_id: pendingKey });

      // Get real session ID from backend (UI already transitioned)
      try {
        const { session_id } = await api.newChatSession({
          query_user_id: current_query_user_id,
        });
        sessionId = session_id;
      } catch (error) {
        set({ current_session_id: null });
        useChartDataStore.setState((state) => {
          delete state.chartData[pendingKey];
        });
        consola.error("ERROR: startMultipleChatSSE - newChatSession", error);
        return;
      }

      // Move data from pending to real session key
      useChartDataStore.setState((state) => {
        const data = state.chartData[pendingKey];
        if (data) {
          data.session_id = sessionId;
          state.chartData[sessionId] = data;
          delete state.chartData[pendingKey];
        }
      });

      // Add to history lists with real ID
      const { addNewSessionToLists } = useChatHistoryStore.getState();
      addNewSessionToLists(sessionId, current_query_user_id, user_name);

      // Navigate to real URL
      set({ current_session_id: sessionId });
    }

    try {
      // Step 5: Prepare conversation for existing sessions
      if (!isNewSession) {
        ({ questionId, assistantId } = prepareConversation(
          sessionId,
          input.question,
          input.fileList,
        ));
        setIsStreamingBySessionId(sessionId, true);
      }

      // Step 8: Setup SSE controllers
      const { _sseControllers } = get();
      const controllers = [];
      _sseControllers.set(sessionId, controllers);
      set({ _sseControllers: new Map(_sseControllers) });

      // Step 9: Start SSE connections
      await startSSEConnections({
        vsList: input.vsList,
        sessionId,
        assistantId,
        question: input.question,
        fileList: input.fileList,
        queryUserId: current_query_user_id,
        questionId,
        isNewSession,
        promptName: input.promptName,
        controllers,
        fetchStartChatSSE,
      });

      // Step 10: Cleanup on success
      cleanupSSESession(
        sessionId,
        get()._sseControllers,
        setIsStreamingBySessionId,
        set,
      );
    } catch (error) {
      consola.error("ERROR: startMultipleChatSSE", error);
      // Cleanup on error
      if (sessionId) {
        cleanupSSESession(
          sessionId,
          get()._sseControllers,
          setIsStreamingBySessionId,
          set,
        );
      }
    }
  },
  /* sse for single */
  fetchStartChatSSE: ({
    provider,
    question = "",
    session_id,
    backend_session_id,
    assistant_id,
    file_list = [],
    current_query_user_id,
    questionId,
    controller,
    is_new_session,
    prompt_name,
  }) => {
    // session_id is the chartData/store key (group key in compare mode).
    // backend_session_id is the id sent to the backend (the per-pane id in
    // compare mode); defaults to session_id for single-model.
    const backendSessionId = backend_session_id || session_id;
    return new Promise((resolve, reject) => {
      try {
        if (!session_id) {
          throw new Error("session_id is required");
        }
        if (!current_query_user_id) {
          throw new Error("current_query_user_id is required");
        }
        if (!assistant_id) {
          throw new Error("assistant_id is required");
        }

        const { pushBlockByProvider } = useChartDataStore.getState();
        const { refreshHistory } = useChatHistoryStore.getState();

        // No `agent`, no `group_id`: Mirobody 1.4.0 accepts and ignores both
        // (and `enable_mcp` / `reference_task_id`, which this client never
        // sent), and will drop them from `ChatStreamRequest` once no client
        // sends them. `group_id` was only ever echoed back.
        const payload = {
          question,
          session_id: backendSessionId,
          provider,
          query_user_id: current_query_user_id,
          file_list:
            file_list?.map((f) => ({
              file_key: f.file_key,
              file_type: f.original_file_type,
              file_name: f.file_name,
              file_url: f.file_url,
              file_size: f.file_size,
            })) || [],
          question_id: questionId,
          prompt_name: prompt_name || null,
        };

        // Coalesce content frames into one store update per ~60ms. One
        // setState per SSE frame re-renders the whole conversation tree per
        // token — O(n²) over a long answer. Frames that change CONTROL flow
        // (error / close) must NOT overtake buffered content, so those paths
        // flush first.
        const { push: queueFrame, flush: flushFrames } = createFrameCoalescer(
          (frames) => {
            // Drop the buffered tail once the user has stopped this stream:
            // a timer armed just before the abort would otherwise land the
            // dead stream's tail in the session's LAST conversation — which
            // may already be a NEW question by the time it fires.
            if (controller?.signal.aborted) return;
            useChartDataStore
              .getState()
              .applyStreamingFrames(session_id, provider, frames);
          },
        );

        // start chat sse
        api.startChatSSE({
          payload,
          signal: controller ? controller.signal : undefined,
          onmessage: async (message) => {
            try {
              // Check if request has been aborted, if so don't update UI
              if (controller && controller.signal.aborted) {
                return;
              }
              const { type } = message;

              // Blocks about the stream rather than the answer: `start` opens
              // it with the id the answer is saved under, `heartbeat` keeps an
              // idle connection open. Consume them quietly.
              if (type === "start" || type === "heartbeat") {
                return;
              }

              // Validate block type - ignore unknown types from backend
              if (!isValidChartMessageType(type)) {
                consola.warn(`[SSE] Ignoring unknown block type: "${type}"`, message);
                return;
              }

              // The block rides through as the backend sent it, so every field
              // it carries reaches the renderer: `tool_result.status` off the
              // tool's envelope (`ok` / `partial` / `error`, plus `error_kind`
              // and `truncated`), `end.finish_reason` (`stop` / `error` /
              // `unavailable` / `empty`). The status line reads them to say
              // WHICH of those happened instead of "Answer Completed" for all.
              //
              // Frame coalescing: ordinary blocks reach the store at most once
              // every 60ms.
              queueFrame(message);
            } catch (error) {
              consola.error("ERROR: fetchStartChatSSE onmessage", error);
            }
          },
          onerror: (error) => {
            consola.error("ERROR: fetchStartChatSSE", error);
            flushFrames(); // error card must land AFTER the buffered content

            // Display localized error message in UI
            // For backend errors, use original message; otherwise use i18n key
            const errorMessage =
              error?.type === SSE_ERROR_TYPE.BACKEND_ERROR && error?.message
                ? error.message
                : i18n.t(error?.type || "sse_error_unknown");

            pushBlockByProvider(session_id, provider, {
              type: CHART_MESSAGE_TYPE.ERROR,
              message: errorMessage,
            });
            reject(error);
          },
          onclose: () => {
            flushFrames(); // apply the buffered tail before marking "end"
            // Update assistant status to "end" when SSE closes
            useChartDataStore.setState((state) => {
              const sessionData = state.chartData[session_id];
              if (sessionData?.conversations) {
                const conversation =
                  sessionData.conversations[
                    sessionData.conversations.length - 1
                  ];
                if (conversation?.assistant_list) {
                  // `provider` alone identifies a pane: compare mode compares
                  // providers, and the (provider, agent) composite key existed
                  // only because two agents could serve the same provider.
                  const assistant = conversation.assistant_list.find(
                    (item) => item.provider === provider,
                  );
                  if (assistant) {
                    assistant.status = "end";
                  }
                }
              }
            });

            resolve({ provider });

            // Only refresh history for new session's first completed SSE
            const { _refreshedSessionIds } = get();
            if (is_new_session && !_refreshedSessionIds.has(session_id)) {
              _refreshedSessionIds.add(session_id);
              refreshHistory();
            }
          },
        });
      } catch (error) {
        consola.error("ERROR: fetchStartChatSSE", error);
        reject(error);
      }
    });
  },
  /* loading */
  loading_chart_session: false,
  setLoadingChartSession: (loading_chart_session = false) => {
    set({ loading_chart_session });
  },
}));
