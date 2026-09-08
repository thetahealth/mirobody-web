/**
 * frameCoalescer — batch streaming SSE frames into one store update per window.
 *
 * WEB_LESSONS_FROM_MINIPROGRAM_2026-08-06 B1: one setState per SSE frame
 * re-renders the whole conversation tree per token — O(n²) over a long answer
 * (the miniprogram measured 862 setData / ~12MB for a 597-char reply before
 * its 60ms throttle). This is the web-side equivalent of its `pushTurn`.
 *
 * Pure module (no store imports) so the batching contract stays unit-testable:
 * - push() buffers a frame and arms ONE timer per window;
 * - flush() applies everything buffered, in arrival order, synchronously —
 *   callers MUST flush before writing anything that must not overtake content
 *   (widget cards, end reconciliation, error rows, close status).
 */
export function createFrameCoalescer(apply, flushMs = 60) {
  let pending = [];
  let timer = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.length === 0) return;
    const frames = pending;
    pending = [];
    apply(frames);
  };

  const push = (frame) => {
    pending.push(frame);
    if (!timer) {
      timer = setTimeout(flush, flushMs);
    }
  };

  return { push, flush };
}
