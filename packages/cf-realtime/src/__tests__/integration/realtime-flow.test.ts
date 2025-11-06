/**
 * Integration tests for complete realtime pub/sub flow
 * Tests the interaction between RealtimeClient and RealtimeActor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RealtimeClient } from "../../client/RealtimeClient";
import { ConnectionState, MessageType } from "../../types";
import { createMockWebSocketConstructor, MockWebSocket } from "../mocks/websocket";
import { wait, waitFor } from "../utils/async-helpers";

// Mock global WebSocket
const MockWSConstructor = createMockWebSocketConstructor();
global.WebSocket = MockWSConstructor as any;

describe("Realtime Pub/Sub Integration", () => {
  let client1: RealtimeClient;
  let client2: RealtimeClient;
  let mockWs1: MockWebSocket;
  let mockWs2: MockWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWSConstructor.clearInstances();

    client1 = new RealtimeClient({
      url: "wss://test.example.com/ws",
      clientId: "client-1",
      autoReconnect: false,
      debug: false,
    });

    client2 = new RealtimeClient({
      url: "wss://test.example.com/ws",
      clientId: "client-2",
      autoReconnect: false,
      debug: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    client1.disconnect();
    client2.disconnect();
  });

  describe("connection lifecycle", () => {
    it("should establish connection for single client", async () => {
      const stateHandler = vi.fn();
      client1.onStateChange(stateHandler);

      client1.connect();
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();

      expect(stateHandler).toHaveBeenCalledWith(ConnectionState.CONNECTING);
      expect(stateHandler).toHaveBeenCalledWith(ConnectionState.CONNECTED);
      expect(client1.getState()).toBe(ConnectionState.CONNECTED);
    });

    it("should establish connections for multiple clients", async () => {
      client1.connect();
      mockWs1 = MockWSConstructor.getInstances()[0];

      client2.connect();
      mockWs2 = MockWSConstructor.getInstances()[1];

      mockWs1.simulateOpen();
      mockWs2.simulateOpen();
      await vi.runAllTimersAsync();

      expect(client1.getState()).toBe(ConnectionState.CONNECTED);
      expect(client2.getState()).toBe(ConnectionState.CONNECTED);
    });

    it("should handle disconnection gracefully", async () => {
      client1.connect();
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();

      client1.disconnect();

      expect(mockWs1.close).toHaveBeenCalled();
      expect(client1.getState()).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe("pub/sub workflow", () => {
    beforeEach(async () => {
      // Connect both clients
      client1.connect();
      mockWs1 = MockWSConstructor.getInstances()[0];
      mockWs1.simulateOpen();

      client2.connect();
      mockWs2 = MockWSConstructor.getInstances()[1];
      mockWs2.simulateOpen();

      await vi.runAllTimersAsync();
    });

    it("should subscribe to channel", () => {
      const handler = vi.fn();
      client1.subscribe("test-channel", handler);

      const messages = mockWs1.getSentMessages();
      const subscribeMsg = messages.find(msg => msg.type === MessageType.SUBSCRIBE);

      expect(subscribeMsg).toBeDefined();
      expect(subscribeMsg?.channel).toBe("test-channel");
      expect(subscribeMsg?.clientId).toBe("client-1");
    });

    it("should receive messages on subscribed channel", () => {
      const handler = vi.fn();
      client1.subscribe("test-channel", handler);

      // Simulate receiving a message
      const message = {
        type: MessageType.MESSAGE,
        channel: "test-channel",
        event: "test-event",
        data: { foo: "bar" },
        timestamp: Date.now(),
      };

      mockWs1.simulateMessage(JSON.stringify(message));

      expect(handler).toHaveBeenCalledWith("test-event", { foo: "bar" }, undefined);
    });

    it("should handle multiple subscribers to same channel", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client1.subscribe("shared-channel", handler1);
      client2.subscribe("shared-channel", handler2);

      // Verify both clients subscribed
      const msg1 = mockWs1.getSentMessages().find(m => m.type === MessageType.SUBSCRIBE);
      const msg2 = mockWs2.getSentMessages().find(m => m.type === MessageType.SUBSCRIBE);

      expect(msg1?.channel).toBe("shared-channel");
      expect(msg2?.channel).toBe("shared-channel");
    });

    it("should unsubscribe from channel", () => {
      const handler = vi.fn();
      const unsubscribe = client1.subscribe("test-channel", handler);

      mockWs1.clearSentMessages();
      unsubscribe();

      const messages = mockWs1.getSentMessages();
      const unsubscribeMsg = messages.find(msg => msg.type === MessageType.UNSUBSCRIBE);

      expect(unsubscribeMsg).toBeDefined();
      expect(unsubscribeMsg?.channel).toBe("test-channel");
    });
  });

  describe("message delivery", () => {
    beforeEach(async () => {
      client1.connect();
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();
    });

    it("should deliver messages with metadata", () => {
      const handler = vi.fn();
      client1.subscribe("test-channel", handler);

      const message = {
        type: MessageType.MESSAGE,
        channel: "test-channel",
        event: "test-event",
        data: { value: 123 },
        metadata: { source: "test", timestamp: Date.now() },
        timestamp: Date.now(),
      };

      mockWs1.simulateMessage(JSON.stringify(message));

      expect(handler).toHaveBeenCalledWith(
        "test-event",
        { value: 123 },
        expect.objectContaining({ source: "test" })
      );
    });

    it("should handle multiple messages in sequence", () => {
      const handler = vi.fn();
      client1.subscribe("test-channel", handler);

      for (let i = 0; i < 5; i++) {
        const message = {
          type: MessageType.MESSAGE,
          channel: "test-channel",
          event: `event-${i}`,
          data: { index: i },
          timestamp: Date.now(),
        };
        mockWs1.simulateMessage(JSON.stringify(message));
      }

      expect(handler).toHaveBeenCalledTimes(5);
    });

    it("should not deliver messages to unsubscribed channels", () => {
      const handler = vi.fn();
      client1.subscribe("channel-a", handler);

      const message = {
        type: MessageType.MESSAGE,
        channel: "channel-b",
        event: "test-event",
        data: {},
        timestamp: Date.now(),
      };

      mockWs1.simulateMessage(JSON.stringify(message));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("error scenarios", () => {
    beforeEach(async () => {
      client1.connect();
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();
    });

    it("should handle connection errors", () => {
      const errorHandler = vi.fn();
      client1.onError(errorHandler);

      mockWs1.simulateError(new Error("Connection failed"));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle malformed messages", () => {
      const errorHandler = vi.fn();
      const messageHandler = vi.fn();

      client1.onError(errorHandler);
      client1.subscribe("test-channel", messageHandler);

      mockWs1.simulateMessage("invalid json");

      expect(errorHandler).toHaveBeenCalled();
      expect(messageHandler).not.toHaveBeenCalled();
    });

    it("should handle error messages from server", () => {
      const errorHandler = vi.fn();
      client1.onError(errorHandler);

      const errorMessage = {
        type: MessageType.ERROR,
        error: "Server error",
        details: { code: 500 },
        timestamp: Date.now(),
      };

      mockWs1.simulateMessage(JSON.stringify(errorMessage));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Server error" })
      );
    });
  });

  describe("reconnection flow", () => {
    it("should maintain subscriptions after reconnection", async () => {
      const reconnectClient = new RealtimeClient({
        url: "wss://test.example.com/ws",
        clientId: "reconnect-client",
        autoReconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3,
      });

      const handler = vi.fn();

      reconnectClient.connect();
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();

      reconnectClient.subscribe("persistent-channel", handler);
      mockWs1.clearSentMessages();

      // Simulate disconnect
      mockWs1.simulateClose();
      expect(reconnectClient.getState()).toBe(ConnectionState.RECONNECTING);

      // Trigger reconnection
      vi.advanceTimersByTime(1000);
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();

      // Should resubscribe
      const messages = mockWs1.getSentMessages();
      const subscribeMsg = messages.find(msg => msg.type === MessageType.SUBSCRIBE);
      expect(subscribeMsg?.channel).toBe("persistent-channel");

      reconnectClient.disconnect();
    });
  });

  describe("acknowledgments flow", () => {
    beforeEach(async () => {
      client1.connect();
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();
      mockWs1.clearSentMessages();
    });

    it("should send ack for messages requiring acknowledgment", () => {
      const handler = vi.fn();
      client1.subscribe("test-channel", handler);

      const message = {
        type: MessageType.MESSAGE,
        channel: "test-channel",
        event: "important-event",
        data: { critical: true },
        timestamp: Date.now(),
        id: "msg-456",
        requiresAck: true,
      };

      mockWs1.simulateMessage(JSON.stringify(message));

      const sentMessages = mockWs1.getSentMessages();
      const ackMsg = sentMessages.find(msg => msg.type === MessageType.ACK);

      expect(ackMsg).toBeDefined();
      expect(ackMsg?.messageId).toBe("msg-456");
      expect(ackMsg?.channel).toBe("test-channel");
    });
  });

  describe("ping/pong flow", () => {
    beforeEach(async () => {
      client1.connect();
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();
      mockWs1.clearSentMessages();
    });

    it("should maintain connection with ping/pong", () => {
      // Advance time to trigger ping
      vi.advanceTimersByTime(30000);

      const messages = mockWs1.getSentMessages();
      const pingMsg = messages.find(msg => msg.type === MessageType.PING);

      expect(pingMsg).toBeDefined();

      // Simulate pong response
      const pongMessage = {
        type: MessageType.PONG,
        timestamp: Date.now(),
      };

      expect(() => {
        mockWs1.simulateMessage(JSON.stringify(pongMessage));
      }).not.toThrow();
    });
  });

  describe("multi-channel scenarios", () => {
    beforeEach(async () => {
      client1.connect();
      mockWs1 = MockWSConstructor.getLastInstance();
      mockWs1.simulateOpen();
      await vi.runAllTimersAsync();
    });

    it("should handle subscriptions to multiple channels", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      client1.subscribe("channel-1", handler1);
      client1.subscribe("channel-2", handler2);
      client1.subscribe("channel-3", handler3);

      const messages = mockWs1.getSentMessages();
      const subscribeMessages = messages.filter(msg => msg.type === MessageType.SUBSCRIBE);

      expect(subscribeMessages).toHaveLength(3);
      expect(subscribeMessages.map(m => m.channel)).toEqual(
        expect.arrayContaining(["channel-1", "channel-2", "channel-3"])
      );
    });

    it("should route messages to correct channel handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client1.subscribe("channel-1", handler1);
      client1.subscribe("channel-2", handler2);

      // Send message to channel-1
      mockWs1.simulateMessage(JSON.stringify({
        type: MessageType.MESSAGE,
        channel: "channel-1",
        event: "event-1",
        data: { ch: 1 },
        timestamp: Date.now(),
      }));

      // Send message to channel-2
      mockWs1.simulateMessage(JSON.stringify({
        type: MessageType.MESSAGE,
        channel: "channel-2",
        event: "event-2",
        data: { ch: 2 },
        timestamp: Date.now(),
      }));

      expect(handler1).toHaveBeenCalledWith("event-1", { ch: 1 }, undefined);
      expect(handler2).toHaveBeenCalledWith("event-2", { ch: 2 }, undefined);
    });

    it("should unsubscribe from all channels", () => {
      client1.subscribe("channel-1", vi.fn());
      client1.subscribe("channel-2", vi.fn());
      client1.subscribe("channel-3", vi.fn());

      mockWs1.clearSentMessages();
      client1.unsubscribeAll();

      const messages = mockWs1.getSentMessages();
      const unsubscribeMessages = messages.filter(msg => msg.type === MessageType.UNSUBSCRIBE);

      expect(unsubscribeMessages).toHaveLength(3);
    });
  });
});
