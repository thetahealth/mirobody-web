/**
 * The upload used to send while its socket was still CONNECTING and lose the
 * message. These pin the three ways an open attempt can end, and that a
 * socket already open is used as it is.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { openSocket, withTimeout } from "./openSocket.js";

class FakeSocket {
  constructor(readyState = 0) {
    this.readyState = readyState;
    this.listeners = { open: new Set(), close: new Set() };
    this.closed = false;
  }
  addEventListener(type, fn) {
    this.listeners[type].add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type].delete(fn);
  }
  emit(type, event) {
    [...this.listeners[type]].forEach((fn) => fn(event));
  }
  close() {
    this.closed = true;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("openSocket", () => {
  it("resolves at once for a socket that is already open", async () => {
    const socket = new FakeSocket(1);
    await expect(openSocket(socket, 1000)).resolves.toBe(socket);
  });

  it("waits for open instead of resolving while CONNECTING", async () => {
    const socket = new FakeSocket(0);
    let settled = false;
    const opened = openSocket(socket, 1000).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    socket.readyState = 1;
    socket.emit("open");
    await opened;
    expect(settled).toBe(true);
    expect(socket.listeners.open.size).toBe(0);
  });

  it("rejects when the socket closes before it opens", async () => {
    const socket = new FakeSocket(0);
    const opened = openSocket(socket, 1000);
    socket.emit("close", { code: 1006 });
    await expect(opened).rejects.toThrow("code 1006");
    expect(socket.listeners.close.size).toBe(0);
  });

  it("gives up and closes the socket after the timeout", async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket(0);
    const opened = openSocket(socket, 500);
    vi.advanceTimersByTime(500);
    await expect(opened).rejects.toThrow("within 500 ms");
    expect(socket.closed).toBe(true);
  });
});

describe("withTimeout", () => {
  it("passes a value through", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it("rejects after the timeout and lets the caller release its waiter", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const pending = withTimeout(new Promise(() => {}), 300, onTimeout);
    vi.advanceTimersByTime(300);
    await expect(pending).rejects.toThrow("300 ms");
    expect(onTimeout).toHaveBeenCalledOnce();
  });
});
