import { expect, it, vi } from "vitest";
vi.mock("../service/request", () => ({ mcpRequestInstance: { post: vi.fn() } }));
vi.mock("../service/sse", () => ({ sseRequestInstance: vi.fn() }));
import { resolveCitations, startChatSSE } from "./chat";
import { mcpRequestInstance } from "../service/request";
import { sseRequestInstance } from "../service/sse";

it("passes cancellation through to the HTTP stream", () => {
  const controller = new AbortController();
  startChatSSE({ payload: { question: "synthetic" }, signal: controller.signal });
  expect(sseRequestInstance.mock.calls[0][1].signal).toBe(controller.signal);
});

it("sends cite ids as a list, so an id with a comma stays one id", () => {
  const rids = ["r1", "ref:doi:10.0000/synthetic,1"];
  resolveCitations({ session_id: "s1", rids });
  expect(mcpRequestInstance.post).toHaveBeenCalledWith("/api/citations", { session_id: "s1", rids });
});
