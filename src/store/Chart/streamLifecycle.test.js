import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../api", () => ({ default: { startChatSSE: vi.fn() } }));
vi.mock("../account", () => ({ useAccountStore: { getState: () => ({ current_query_user_id: "synthetic", user_name: "Fixture" }) } }));
vi.mock("../model", () => ({ useModelStore: { getState: () => ({ vs_list: [{ provider: "fixture" }] }) } }));
vi.mock("./input", () => ({ useChartInputStore: { getState: () => ({ question: "Synthetic question", file_list: [], clearQuestion: vi.fn(), clearFileList: vi.fn() }) } }));
vi.mock("./history", () => ({ useChatHistoryStore: { getState: () => ({ refreshHistory: vi.fn() }) } }));
import api from "../../api";
import { useChatStore } from "./index";
import { useChartDataStore } from "./data";

beforeEach(() => {
  useChatStore.setState({ current_session_id: "s1", _sseControllers: new Map() });
  useChartDataStore.setState({ chartData: { s1: { conversations: [], is_streaming: false } } });
  vi.clearAllMocks();
});

it("stopping then immediately asking again isolates old frames and cleanup", async () => {
  const requests = [];
  api.startChatSSE.mockImplementation((options) => new Promise((resolve) => requests.push({ options, resolve })));
  const first = useChatStore.getState().startMultipleChatSSE();
  requests[0].options.onmessage({ type: "reasoning", reasoning: "First thinking" });
  useChatStore.getState().stopStreamingBySessionId("s1");
  expect(requests[0].options.signal.aborted).toBe(true);
  const second = useChatStore.getState().startMultipleChatSSE();
  requests[0].options.onmessage({ type: "text", text: "Late old answer" });
  requests[0].resolve();
  await first;
  const data = useChartDataStore.getState().chartData.s1;
  expect(data.is_streaming).toBe(true);
  expect(data.conversations[0].assistant_list[0].completion_reason).toBe("cancelled");
  expect(data.conversations[1].assistant_list[0].status).toBe("streaming");
  expect(data.conversations[1].assistant_list[0].messages).toEqual([]);
  requests[1].options.onmessage({ type: "text", text: "Second answer" });
  requests[1].options.onmessage({ type: "end", finish_reason: "stop" });
  requests[1].resolve();
  await second;
  expect(useChartDataStore.getState().chartData.s1.is_streaming).toBe(false);
});

it("question and assistant IDs agree with the request and do not follow the last turn", () => {
  const store = useChartDataStore.getState();
  const first = store.addUserQuestionBySessionId("s1", "one", []);
  store.addAssistantResponseBySessionId("s1", first);
  const second = store.addUserQuestionBySessionId("s1", "two", []);
  store.addAssistantResponseBySessionId("s1", second);
  store.applyStreamingFrames("s1", "fixture", [{ type: "reasoning", reasoning: "old turn" }], first);
  store.finishAssistantTurn("s1", "fixture", first, "cancelled");
  const turns = useChartDataStore.getState().chartData.s1.conversations;
  expect(turns[0].assistant_list[0].messages[0].reasoning).toBe("old turn");
  expect(turns[1].assistant_list[0].messages).toEqual([]);
  expect(turns[1].assistant_list[0].status).toBe("streaming");
});
