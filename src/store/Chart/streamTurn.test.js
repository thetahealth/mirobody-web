import { afterEach, expect, it, vi } from "vitest";
import { streamTurn } from "./streamTurn";

afterEach(() => vi.useRealTimers());

it("delivers thinking before a final answer while coalescing subsequent tokens", async () => {
  vi.useFakeTimers();
  const apply = vi.fn();
  const finish = vi.fn();
  await streamTurn({ apply, finish, request: async ({ onmessage }) => {
    onmessage({ type: "heartbeat" });
    expect(apply).not.toHaveBeenCalled();
    onmessage({ type: "reasoning", reasoning: "Checking" });
    expect(apply).toHaveBeenCalledTimes(1);
    onmessage({ type: "reasoning", reasoning: " the records" });
    expect(apply).toHaveBeenCalledTimes(1);
    onmessage({ type: "text", text: "Final answer" });
    expect(apply.mock.calls.at(-1)[0].map((b) => b.type)).toEqual(["reasoning", "text"]);
    onmessage({ type: "end", finish_reason: "stop" });
  } });
  expect(finish).toHaveBeenCalledWith("completed");
  expect(vi.getTimerCount()).toBe(0);
});

it("settles cancellation without onclose and rejects late frames and failures", async () => {
  const controller = new AbortController();
  let callbacks;
  const apply = vi.fn();
  const finish = vi.fn();
  const result = await streamTurn({ apply, finish, signal: controller.signal, request: async (options) => {
    callbacks = options;
    expect(options.signal).toBe(controller.signal);
    options.onmessage({ type: "reasoning", reasoning: "Working" });
    controller.abort();
  } });
  expect(result).toBe("cancelled");
  callbacks.onmessage({ type: "text", text: "late" });
  callbacks.onerror(new Error("late"));
  expect(apply).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledExactlyOnceWith("cancelled");
});

it("does not call a premature EOF a completed answer", async () => {
  const result = await streamTurn({ request: async () => {}, apply: vi.fn(), finish: vi.fn() });
  expect(result).toBe("disconnected");
});

it("reports errors once, after buffered text", async () => {
  const frames = [];
  const result = await streamTurn({ apply: (batch) => frames.push(...batch), finish: vi.fn(), errorMessage: () => "Unavailable", request: async ({ onmessage, onerror }) => {
    onmessage({ type: "reasoning", reasoning: "A" });
    onmessage({ type: "reasoning", reasoning: "B" });
    onerror(new Error("offline"));
    throw new Error("offline");
  } });
  expect(result).toBe("error");
  expect(frames.map((b) => b.type)).toEqual(["reasoning", "reasoning", "error"]);
});

it("flushes real summary activity immediately and settles an interrupt", async () => {
  const apply = vi.fn();
  const result = await streamTurn({ apply, finish: vi.fn(), request: async ({ onmessage }) => {
    onmessage({ type: "context", phase: "summarization", status: "started", id: "s1" });
    expect(apply).toHaveBeenCalledTimes(1);
    onmessage({ type: "interrupt", question: "Which date?" });
  } });
  expect(result).toBe("completed");
});
