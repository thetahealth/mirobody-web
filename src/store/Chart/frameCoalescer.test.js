import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFrameCoalescer } from "./frameCoalescer";

// B1 contract (WEB_LESSONS_FROM_MINIPROGRAM_2026-08-06): many frames → one
// store update per 60ms window; explicit flush is synchronous and preserves
// arrival order, so control-flow writes (widget/end/error/close) can flush
// first and never overtake content.

describe("createFrameCoalescer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies MANY pushed frames as ONE batch when the window elapses", () => {
    const apply = vi.fn();
    const { push } = createFrameCoalescer(apply, 60);

    for (let i = 0; i < 100; i++) {
      push({ type: "reply", content: `t${i}` });
    }
    expect(apply).not.toHaveBeenCalled(); // nothing lands mid-window

    vi.advanceTimersByTime(60);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][0]).toHaveLength(100);
  });

  it("preserves arrival order inside a batch", () => {
    const apply = vi.fn();
    const { push, flush } = createFrameCoalescer(apply, 60);

    push({ type: "queryTitle", content: "grep", tool_id: "t1" });
    push({ type: "queryArguments", content: '{"que', tool_id: "t1" });
    push({ type: "queryArguments", content: 'ry":"x"}', tool_id: "t1" });
    flush();

    expect(apply.mock.calls[0][0].map((f) => f.content)).toEqual([
      "grep",
      '{"que',
      'ry":"x"}',
    ]);
  });

  it("flush() is synchronous, cancels the timer, and empties the buffer", () => {
    const apply = vi.fn();
    const { push, flush } = createFrameCoalescer(apply, 60);

    push({ type: "reply", content: "a" });
    flush();
    expect(apply).toHaveBeenCalledTimes(1); // immediate, before any timer

    vi.advanceTimersByTime(120);
    expect(apply).toHaveBeenCalledTimes(1); // timer was cancelled — no double apply
  });

  it("flush() with nothing buffered never calls apply (close after clean end)", () => {
    const apply = vi.fn();
    const { flush } = createFrameCoalescer(apply, 60);
    flush();
    expect(apply).not.toHaveBeenCalled();
  });

  it("frames pushed after a flush start a NEW window and a NEW batch", () => {
    const apply = vi.fn();
    const { push, flush } = createFrameCoalescer(apply, 60);

    push({ type: "reply", content: "a" });
    flush();
    push({ type: "reply", content: "b" });
    vi.advanceTimersByTime(60);

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1][0]).toEqual([{ type: "reply", content: "b" }]);
  });

  it("an apply guarded by an abort flag drops the tail instead of bleeding into the next turn", () => {
    // How index.js wires it: sse.js skips onclose on abort, so a timer armed
    // just before the user pressed Stop still fires. applyStreamingFrames
    // targets the session's LAST conversation — if a new question started in
    // that window, the dead stream's tail would land in the NEW answer.
    const applied = [];
    const signal = { aborted: false };
    const { push } = createFrameCoalescer((frames) => {
      if (signal.aborted) return;
      applied.push(...frames);
    }, 60);

    push({ type: "reply", content: "before stop" });
    signal.aborted = true; // user hit Stop before the window elapsed
    vi.advanceTimersByTime(60);

    expect(applied).toEqual([]);
  });

  it("a long stream lands ~duration/60ms times, not once per frame", () => {
    const apply = vi.fn();
    const { push } = createFrameCoalescer(apply, 60);

    // 600ms of streaming at one frame every 5ms = 120 frames
    for (let i = 0; i < 120; i++) {
      push({ type: "reply", content: "x" });
      vi.advanceTimersByTime(5);
    }
    vi.advanceTimersByTime(60);

    const applied = apply.mock.calls.reduce((n, c) => n + c[0].length, 0);
    expect(applied).toBe(120); // no frame lost
    expect(apply.mock.calls.length).toBeLessThanOrEqual(11); // ≤ ~600/60 + tail
  });
});
