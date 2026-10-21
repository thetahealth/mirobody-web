import { expect, it, vi } from "vitest";
vi.mock("../service/request", () => ({ mcpRequestInstance: {} }));
vi.mock("../service/sse", () => ({ sseRequestInstance: vi.fn() }));
import { startChatSSE } from "./chat";
import { sseRequestInstance } from "../service/sse";

it("passes cancellation through to the HTTP stream", () => {
  const controller = new AbortController();
  startChatSSE({ payload: { question: "synthetic" }, signal: controller.signal });
  expect(sseRequestInstance.mock.calls[0][1].signal).toBe(controller.signal);
});
