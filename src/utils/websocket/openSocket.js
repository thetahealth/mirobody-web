// A socket's readyState values; the WebSocket global is absent in some test
// environments, and these numbers are fixed by the WHATWG spec.
const OPEN = 1;

/**
 * Settle once `socket` is usable: resolve on `open`, reject if it closes first
 * or `timeoutMs` passes.
 *
 * `new WebSocket()` returns while the socket is still CONNECTING, and a message
 * sent then is dropped. The first upload after a server restart went out
 * exactly then, so nothing reached the server and the file sat at "uploading".
 */
export const openSocket = (socket, timeoutMs) =>
  new Promise((resolve, reject) => {
    if (socket.readyState === OPEN) {
      resolve(socket);
      return;
    }
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
    };
    const onOpen = () => {
      cleanup();
      resolve(socket);
    };
    const onClose = (event) => {
      cleanup();
      reject(new Error(`WebSocket closed before it opened (code ${event?.code ?? "unknown"})`));
    };
    const timer = setTimeout(() => {
      cleanup();
      socket.close();
      reject(new Error(`WebSocket did not open within ${timeoutMs} ms`));
    }, timeoutMs);
    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);
  });

/**
 * `promise`, or a rejection after `timeoutMs`; `onTimeout` releases whatever
 * the caller registered while it waited.
 */
export const withTimeout = (promise, timeoutMs, onTimeout) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
