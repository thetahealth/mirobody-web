import { BroadcastChannel, createLeaderElection } from "broadcast-channel";
import { ACCESS_TOKEN } from "../../enum/storage.js";
import { getApiBaseUrl } from "../index.js";
import consola from "consola";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { useDriveStore } from "../../store/Drive/index.js";

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

    // Map of userId -> connection state (for non-leader tabs to track leader's connection state)
    // This allows non-leader tabs to know if the leader has an active connection
    this.leaderConnectionStates = new Map();

    // Pending connect request resolvers (for ensureConnected)
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
   * Connect WebSocket for current user (waits for leadership if needed)
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

    // Already connected
    if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
      return;
    }

    // Get URL
    connection.url = connection.getSocketUrl();
    if (!connection.url) {
      consola.error("WebSocketManager::tryConnect - cannot generate URL");
      throw new Error("ERROR:: tryConnect no URL");
    }

    // Create WebSocket
    try {
      connection.ws = new WebSocket(connection.url);
      connection.readyState = WebSocket.CONNECTING;

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
    }
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
   */
  sendMessage(message) {
    const connection = this.getCurrentConnection();
    if (!connection) {
      consola.error(
        "WebSocketManager:: sendMessage :: Cannot send message - no current connection",
      );
      return;
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
      return;
    }

    // Leader: send directly to WebSocket
    if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr =
          typeof message === "string" ? message : JSON.stringify(message);
        connection.ws.send(messageStr);
      } catch (error) {
        consola.error(
          `WebSocketManager:: sendMessage :: Failed to send message:`,
          error,
        );
      }
    } else {
      consola.error(
        `WebSocketManager:: sendMessage :: WebSocket not connected, cannot send message`,
      );
    }
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

        // If WebSocket is open, send immediately
        if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
          try {
            connection.ws.send(msg.message);
          } catch (error) {
            consola.error(
              `WebSocketManager::Failed to forward message to WebSocket for user ${connection.userId}:`,
              error,
            );
          }
        } else {
          // WebSocket not connected - log error
          consola.error(
            `WebSocketManager::WebSocket not connected for user ${connection.userId}, cannot forward message`,
          );
        }
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
   * Ensure WebSocket is connected before sending messages
   * For leader: connects directly if not connected
   * For non-leader: trusts the message forwarding mechanism (sendMessage handles this)
   * @returns {Promise<boolean>} - true if ready to send messages
   */
  async ensureConnected() {
    const current_drive_user_id =
      useDriveStore.getState().current_drive_user_id || "";

    if (!current_drive_user_id) {
      throw new Error("No current_drive_user_id");
    }

    // If we are the leader
    if (this.elector?.isLeader) {
      // Already connected
      if (this.isConnected()) {
        return true;
      }

      // Try to connect
      await this.tryConnect();
      return true;
    }

    // For non-leader tabs, we rely on the BroadcastChannel message forwarding
    // The sendMessage method will forward messages to the leader
    // We trust that the leader has or will establish the connection
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
