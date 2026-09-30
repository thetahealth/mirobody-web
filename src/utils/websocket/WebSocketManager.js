import { BroadcastChannel, createLeaderElection } from "broadcast-channel";
import { ACCESS_TOKEN } from "../../enum/storage.js";
import { getApiBaseUrl } from "../index.js";
import consola from "consola";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { useDriveStore } from "../../store/Drive/index.js";
import { openSocket, withTimeout } from "./openSocket.js";

// How long an upload waits for its socket before it says so. A server that is
// restarting answers within a few seconds; one that is down never does.
const CONNECT_TIMEOUT_MS = 10000;

/**
 * WebSocketConnection - Represents a single WebSocket connection for a specific user
 * Each connection is independent and manages its own state
 */
class WebSocketConnection {
  constructor(userId) {
    this.userId = userId;
    this.ws = null;
    this.url = null;
    this.connectionId = null;
    this.readyState = WebSocket.CLOSED;
    this.pingInterval = null;
    this.reconnectAttempts = 0;

    // Constants
    this.PING_INTERVAL = 30000; // 30 seconds

    // Generate connectionId for this user
    this.generateConnectionId();
  }

  /**
   * Generate unique connection ID: ${user_id}_${uuid}
   */
  generateConnectionId() {
    if (!this.userId) {
      throw new Error("WebSocketConnection::userId is required");
    }

    // Storage key for this user's connectionId
    const storageKey = `WEBSOCKET_CONNECTION_ID_${this.userId}`;
    const storedConnectionId = localStorage.getItem(storageKey);

    // If stored connectionId exists for this user, reuse it
    if (
      storedConnectionId &&
      storedConnectionId.startsWith(`${this.userId}_`)
    ) {
      this.connectionId = storedConnectionId;
    } else {
      // Generate new connectionId for this user
      this.connectionId = `${this.userId}_${uuidv4()}`;
      localStorage.setItem(storageKey, this.connectionId);
    }
  }

  /**
   * Get WebSocket URL with connectionId parameter
   */
  getSocketUrl() {
    const token = localStorage.getItem(ACCESS_TOKEN);
    const apiBaseUrl = getApiBaseUrl();

    if (!token) {
      consola.warn(
        "WebSocketConnection::No ACCESS_TOKEN, cannot generate WebSocket URL",
      );
      return null;
    }

    if (!this.connectionId) {
      this.generateConnectionId();
    }

    const wsUrl = `${apiBaseUrl.replace(
      /^http/,
      "ws",
    )}/ws/upload-health-report?token=${token}&connectionId=${
      this.connectionId
    }`;
    return wsUrl;
  }

  /**
   * Start heartbeat (ping/pong)
   */
  startHeartbeat() {
    if (this.pingInterval) {
      return;
    }
    // Send initial ping immediately
    this.sendPing();

    // Set up periodic ping
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.PING_INTERVAL);
  }

  /**
   * Send ping message
   */
  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const pingMessage = JSON.stringify({
        type: "ping",
        timestamp: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSSSS"),
      });
      try {
        this.ws.send(pingMessage);
      } catch (error) {
        consola.error(
          `WebSocketConnection::Failed to send ping for user ${this.userId}, connectionId: ${this.connectionId}:`,
          error,
        );
      }
    }
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.readyState = WebSocket.CLOSED;
  }
}

/**
 * WebSocketManager - Manages multiple WebSocket connections (one per current_drive_user_id)
 * Uses BroadcastChannel and LeaderElection for cross-tab synchronization
 * BroadcastChannel and LeaderElection are global (singleton), but WebSocket connections are per-user
 */
class WebSocketManager {
  constructor() {
    // Map of userId -> WebSocketConnection
    this.connections = new Map();

    // Global BroadcastChannel and LeaderElection (shared across all connections)
    this.messageChannel = null;
    this.leaderChannel = null;
    this.elector = null;

    // Global listeners (for all connections)
    this.listeners = new Set();

    // userId -> resolvers of a tab that is not the leader, waiting for the
    // leader to report that user's socket open (see ensureConnected).
    this.connectResolvers = new Map();

    // Initialize broadcast-channel (global, not per-connection)
    this.initBroadcastChannel();
  }

  /**
   * Initialize BroadcastChannel and LeaderElection (global, shared across all connections)
   */
  initBroadcastChannel() {
    // Create BroadcastChannel for message synchronization
    this.messageChannel = new BroadcastChannel("upload-websocket-messages");

    // Create BroadcastChannel for leader election
    this.leaderChannel = new BroadcastChannel("upload-websocket-leader");

    // Create leader elector
    this.elector = createLeaderElection(this.leaderChannel, {
      fallbackInterval: 500,
      responseTime: 500,
    });

    // Handle duplicate leader detection
    this.elector.onduplicate = () => {
      consola.warn(`WebSocketManager::Duplicate leader detected!`);
    };

    // Listen for broadcast messages
    this.messageChannel.onmessage = (msg) => {
      this.handleBroadcastMessage(msg);
    };
  }

  /**
   * Get or create WebSocketConnection for a specific user
   */
  getConnection(userId) {
    if (!userId) {
      consola.warn("WebSocketManager::No userId provided");
      return null;
    }

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new WebSocketConnection(userId));
    }

    return this.connections.get(userId);
  }

  /**
   * Get current user's WebSocketConnection (based on current_drive_user_id)
   */
  getCurrentConnection() {
    const current_drive_user_id =
      useDriveStore.getState().current_drive_user_id || "";
    return this.getConnection(current_drive_user_id);
  }

  /**
   * Connect WebSocket for current user (waits for leadership if needed) and
   * resolve once the socket is OPEN.
   */
  async tryConnect() {
    const connection = this.getCurrentConnection();
    if (!connection) {
      consola.error("WebSocketManager::tryConnect - no current_drive_user_id");
      throw new Error("ERROR:: tryConnect no connection");
    }

    // Wait for leadership if not already leader
    if (!this.elector.isLeader) {
      await this.elector.awaitLeadership();
    }

    return this.openConnection(connection);
  }

  /**
   * Open `connection`'s socket, or join the attempt already under way, and
   * resolve once it is OPEN. One attempt at a time: a second upload while the
   * first is still connecting waits on the same socket instead of opening
   * another one.
   */
  openConnection(connection) {
    if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (connection.opening) {
      return connection.opening;
    }

    // Get URL
    connection.url = connection.getSocketUrl();
    if (!connection.url) {
      consola.error("WebSocketManager::tryConnect - cannot generate URL");
      return Promise.reject(new Error("ERROR:: tryConnect no URL"));
    }

    // Create WebSocket
    try {
      const socket = new WebSocket(connection.url);
      connection.ws = socket;
      connection.readyState = WebSocket.CONNECTING;
      connection.opening = openSocket(socket, CONNECT_TIMEOUT_MS)
        .then(() => undefined)
        .finally(() => {
          connection.opening = null;
        });

      connection.ws.onopen = () => {
        connection.readyState = WebSocket.OPEN;
        connection.reconnectAttempts = 0;

        this.broadcastMessage({
          type: "connection_state",
          userId: connection.userId,
          state: "open",
          readyState: WebSocket.OPEN,
          connectionId: connection.connectionId,
        });

        this.notifyListeners("open", null, connection.userId);
        connection.startHeartbeat();
      };

      connection.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyListeners("message", data, connection.userId);
          this.broadcastMessage({
            type: "message",
            userId: connection.userId,
            payload: data,
          });
        } catch (error) {
          consola.error("WebSocketManager::Failed to parse message:", error);
        }
      };

      connection.ws.onerror = (error) => {
        // A socket already replaced by a newer one speaks for nothing.
        if (connection.ws !== socket) return;
        consola.error("WebSocketManager::WebSocket error:", error);
        connection.readyState = WebSocket.CLOSED;

        this.broadcastMessage({
          type: "connection_state",
          userId: connection.userId,
          state: "error",
          readyState: WebSocket.CLOSED,
          connectionId: connection.connectionId,
        });

        this.notifyListeners("error", error, connection.userId);
      };

      connection.ws.onclose = (event) => {
        // A late close from a replaced socket would stop the newer one's
        // heartbeat and tell the other tabs it is closed.
        if (connection.ws !== socket) return;
        connection.readyState = WebSocket.CLOSED;
        connection.stopHeartbeat();

        this.broadcastMessage({
          type: "connection_state",
          userId: connection.userId,
          state: "close",
          readyState: WebSocket.CLOSED,
          connectionId: connection.connectionId,
          code: event.code,
          reason: event.reason,
        });

        this.notifyListeners("close", event, connection.userId);
      };
    } catch (error) {
      consola.error("WebSocketManager::Failed to create WebSocket:", error);
      connection.readyState = WebSocket.CLOSED;

      this.broadcastMessage({
        type: "connection_state",
        userId: connection.userId,
        state: "error",
        readyState: WebSocket.CLOSED,
        connectionId: connection.connectionId,
      });

      this.notifyListeners("error", error, connection.userId);
      return Promise.reject(error);
    }
    return connection.opening;
  }

  /**
   * Disconnect WebSocket for current user
   */
  disconnect(targetUserId) {
    let userId = targetUserId;
    if (!userId) {
      const connection = this.getCurrentConnection();
      if (connection) {
        userId = connection.userId;
      }
    }

    const connection = this.connections.get(userId);
    if (connection) {
      connection.disconnect();

      // Broadcast connection state to other tabs
      this.broadcastMessage({
        type: "connection_state",
        userId: userId,
        state: "close",
        readyState: WebSocket.CLOSED,
        connectionId: connection.connectionId,
      });
    }
  }

  /**
   * Send message via WebSocket for current user
   * If not leader, forwards message to leader via BroadcastChannel
   * @returns {boolean} false when the message was not sent, so the caller can
   *   fail the upload instead of waiting for an answer that cannot come
   */
  sendMessage(message) {
    const connection = this.getCurrentConnection();
    if (!connection) {
      consola.error(
        "WebSocketManager:: sendMessage :: Cannot send message - no current connection",
      );
      return false;
    }

    // If not leader, forward message to leader via BroadcastChannel
    if (!this.elector.isLeader) {
      this.broadcastMessage({
        type: "send_message_request",
        userId: connection.userId,
        connectionId: connection.connectionId,
        message:
          typeof message === "string" ? message : JSON.stringify(message),
      });
      return true;
    }

    // Leader: send directly to WebSocket
    if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr =
          typeof message === "string" ? message : JSON.stringify(message);
        connection.ws.send(messageStr);
        return true;
      } catch (error) {
        consola.error(
          `WebSocketManager:: sendMessage :: Failed to send message:`,
          error,
        );
        return false;
      }
    }
    consola.error(
      `WebSocketManager:: sendMessage :: WebSocket not connected, cannot send message`,
    );
    return false;
  }

  /**
   * Handle broadcast messages from other tabs
   */
  handleBroadcastMessage(msg) {
    if (!msg || !msg.type) {
      return;
    }

    if (msg.type === "connection_state") {
      // Update connection state for the specific user
      const userId = msg.userId;
      const connection = this.connections.get(userId);
      if (connection) {
        connection.readyState = msg.readyState;
      }
      if (msg.state === "open") {
        const waiting = this.connectResolvers.get(userId);
        this.connectResolvers.delete(userId);
        waiting?.forEach((resolve) => resolve());
      }
    } else if (msg.type === "connect_request") {
      // A tab that is not the leader is about to upload for this user.
      if (this.elector.isLeader && msg.userId) {
        const connection = this.getConnection(msg.userId);
        this.openConnection(connection)
          .then(() =>
            // Also when the socket was already open, which broadcast nothing.
            this.broadcastMessage({
              type: "connection_state",
              userId: connection.userId,
              state: "open",
              readyState: WebSocket.OPEN,
              connectionId: connection.connectionId,
            }),
          )
          .catch((error) =>
            consola.error(
              "WebSocketManager::Leader could not open the socket another tab asked for:",
              error,
            ),
          );
      }
    } else if (msg.type === "message") {
      // Forward message to listeners (for the specific user)
      const userId = msg.userId;
      if (msg.payload) {
        this.notifyListeners("message", msg.payload, userId);
      }
    } else if (msg.type === "send_message_request") {
      // Non-leader tab is requesting to send a message
      // Leader should forward it to WebSocket for the specific user
      if (this.elector.isLeader && msg.message && msg.userId) {
        const connection = this.connections.get(msg.userId);
        if (!connection) {
          consola.error(
            `WebSocketManager::Leader received message request for unknown user`,
          );
          return;
        }

        // A socket the server closed (a restart) is reopened first: dropping
        // the message here lost the other tab's upload without a word.
        this.openConnection(connection)
          .then(() => connection.ws.send(msg.message))
          .catch((error) =>
            consola.error(
              `WebSocketManager::Failed to forward message to WebSocket for user ${connection.userId}:`,
              error,
            ),
          );
      }
    }
  }

  /**
   * Add listener for WebSocket events
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of an event
   */
  notifyListeners(event, data, userId) {
    this.listeners.forEach((callback) => {
      try {
        callback(event, data, userId);
      } catch (error) {
        consola.error("WebSocketManager::Listener error:", error);
      }
    });
  }

  /**
   * Safely broadcast message to other tabs (handles closed channel)
   */
  broadcastMessage(message) {
    if (this.messageChannel) {
      try {
        this.messageChannel.postMessage(message);
      } catch {
        // Channel already closed, ignore
      }
    }
  }

  /**
   * Check if WebSocket is connected for current user
   */
  isConnected() {
    const connection = this.getCurrentConnection();
    return (
      connection && connection.ws && connection.ws.readyState === WebSocket.OPEN
    );
  }

  /**
   * Check if WebSocket is connecting for current user
   */
  isConnecting() {
    const connection = this.getCurrentConnection();
    return (
      connection &&
      connection.ws &&
      connection.ws.readyState === WebSocket.CONNECTING
    );
  }

  /**
   * Ensure WebSocket is connected before sending messages; throws when it
   * cannot be within CONNECT_TIMEOUT_MS.
   * For leader: connects directly if not connected, and waits for it to open
   * For non-leader: asks the leader to open it and waits for the leader to say so
   * @returns {Promise<boolean>} - true if ready to send messages
   */
  async ensureConnected() {
    const current_drive_user_id =
      useDriveStore.getState().current_drive_user_id || "";

    if (!current_drive_user_id) {
      throw new Error("No current_drive_user_id");
    }
    const connection = this.getCurrentConnection();

    // If we are the leader
    if (this.elector?.isLeader) {
      await this.openConnection(connection);
      return true;
    }

    // Not the leader: another tab holds the socket, or this one is still
    // winning the election a moment after the page loaded, when nobody holds
    // it. Whichever comes first, the leader reporting the socket open or this
    // tab becoming the leader, the socket is open before anything is sent.
    let release;
    const leaderOpened = new Promise((resolve) => {
      const waiting = this.connectResolvers.get(connection.userId) || new Set();
      waiting.add(resolve);
      this.connectResolvers.set(connection.userId, waiting);
      release = () => waiting.delete(resolve);
      this.broadcastMessage({ type: "connect_request", userId: connection.userId });
    });
    const becameLeader = this.elector
      .awaitLeadership()
      .then(() => this.openConnection(connection));
    try {
      await withTimeout(
        Promise.race([leaderOpened, becameLeader]),
        CONNECT_TIMEOUT_MS,
      );
    } finally {
      release();
    }
    return true;
  }

  /**
   * Get readyState for current user
   */
  getReadyState() {
    const connection = this.getCurrentConnection();
    return connection ? connection.readyState : WebSocket.CLOSED;
  }

  /**
   * Get connectionId for current user
   */
  getConnectionId() {
    const connection = this.getCurrentConnection();
    return connection ? connection.connectionId : null;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Disconnect all connections
    for (const [_userId, connection] of this.connections) {
      connection.disconnect();
    }
    this.connections.clear();

    // Cleanup broadcast channels
    if (this.messageChannel) {
      this.messageChannel.close();
    }
    if (this.leaderChannel) {
      this.leaderChannel.close();
    }
    if (this.elector) {
      this.elector.die();
    }
  }
}

// Lazy singleton instance - only created when first accessed
let instance = null;

/**
 * Get or create WebSocketManager singleton instance
 * This ensures initialization only happens when actually needed
 */
export function getWebSocketManager() {
  if (!instance) {
    instance = new WebSocketManager();

    // Setup cleanup on page unload to release leadership quickly
    if (typeof window !== "undefined") {
      const handleBeforeUnload = () => {
        if (instance && instance.elector?.isLeader) {
          instance.cleanup();
        }
      };

      // Use pagehide for better mobile support
      window.addEventListener("pagehide", handleBeforeUnload);
      // Also use beforeunload as fallback
      window.addEventListener("beforeunload", handleBeforeUnload);
    }
  }
  return instance;
}

// Export default as getter function for backward compatibility
export default getWebSocketManager;
