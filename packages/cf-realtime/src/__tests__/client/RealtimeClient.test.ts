/**
 * Unit tests for RealtimeClient
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RealtimeClient } from "../../client/RealtimeClient";
import { ConnectionState, MessageType } from "../../types";
import { createMockWebSocketConstructor, MockWebSocket } from "../mocks/websocket";
import {
  createChannelMessage,
  createAckMessage,
  createErrorMessage,
} from "../fixtures/messages";
import { wait } from "../utils/async-helpers";

// Mock global WebSocket
const MockWSConstructor = createMockWebSocketConstructor();
global.WebSocket = MockWSConstructor as any;

describe("RealtimeClient", () => {
  let client: RealtimeClient;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWSConstructor.clearInstances();

    client = new RealtimeClient({
      url: "wss://test.example.com/ws",
      clientId: "test-client-123",
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
      pingInterval: 5000,
      debug: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    client.disconnect();
  });

  describe("initialization", () => {
    it("should initialize with provided config", () => {
      expect(client.getClientId()).toBe("test-client-123");
      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it("should generate client ID if not provided", () => {
      const clientWithoutId = new RealtimeClient({
        url: "wss://test.example.com/ws",
      });

      const clientId = clientWithoutId.getClientId();
      expect(clientId).toMatch(/^client-/);
    });

    it("should use default config values", () => {
      const defaultClient = new RealtimeClient({
        url: "wss://test.example.com/ws",
      });

      expect(defaultClient.getState()).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe("connection", () => {
    it("should connect to WebSocket server", async () => {
      const connectPromise = client.connect();

      mockWs = MockWSConstructor.getLastInstance();
      expect(mockWs).toBeDefined();
      expect(mockWs.url).toContain("wss://test.example.com/ws");
      expect(mockWs.url).toContain("clientId=test-client-123");
      expect(client.getState()).toBe(ConnectionState.CONNECTING);

      // Simulate connection opening
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      expect(client.getState()).toBe(ConnectionState.CONNECTED);
    });

    it("should not reconnect if already connected", async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      const initialWs = mockWs;
      await client.connect();

      // Should still be the same WebSocket instance
      expect(MockWSConstructor.getLastInstance()).toBe(initialWs);
    });

    it("should handle connection errors", async () => {
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateError(new Error("Connection failed"));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should start ping after connection", async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      // Advance time to trigger ping
      vi.advanceTimersByTime(5000);

      const sentMessages = mockWs.getSentMessages();
      const pingMessage = sentMessages.find(msg => msg.type === MessageType.PING);
      expect(pingMessage).toBeDefined();
    });
  });

  describe("disconnection", () => {
    beforeEach(async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();
    });

    it("should disconnect from server", () => {
      client.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it("should stop ping on disconnect", () => {
      client.disconnect();
      mockWs.clearSentMessages();

      // Advance time - no more pings should be sent
      vi.advanceTimersByTime(10000);

      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(0);
    });

    it("should clear reconnect timer on disconnect", () => {
      // Simulate disconnect that would trigger reconnect
      mockWs.simulateClose();

      // Disconnect before reconnect happens
      client.disconnect();

      // Advance past reconnect interval
      vi.advanceTimersByTime(10000);

      // Should not have created new WebSocket
      expect(MockWSConstructor.mock.calls.length).toBe(1);
    });
  });

  describe("subscriptions", () => {
    beforeEach(async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();
      mockWs.clearSentMessages();
    });

    it("should subscribe to a channel", () => {
      const handler = vi.fn();
      const unsubscribe = client.subscribe("test-channel", handler);

      expect(typeof unsubscribe).toBe("function");

      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: MessageType.SUBSCRIBE,
        channel: "test-channel",
        clientId: "test-client-123",
      });
    });

    it("should handle multiple subscriptions to same channel", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.subscribe("test-channel", handler1);
      mockWs.clearSentMessages();

      client.subscribe("test-channel", handler2);

      // Should not send another subscribe message
      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(0);
    });

    it("should receive messages for subscribed channel", () => {
      const handler = vi.fn();
      client.subscribe("test-channel", handler);

      const message = createChannelMessage("test-channel", "test-event", { foo: "bar" });
      mockWs.simulateMessage(JSON.stringify(message));

      expect(handler).toHaveBeenCalledWith("test-event", { foo: "bar" }, undefined);
    });

    it("should call all handlers for a channel", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.subscribe("test-channel", handler1);
      client.subscribe("test-channel", handler2);

      const message = createChannelMessage("test-channel", "test-event", { foo: "bar" });
      mockWs.simulateMessage(JSON.stringify(message));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should not receive messages for unsubscribed channels", () => {
      const handler = vi.fn();
      client.subscribe("channel-1", handler);

      const message = createChannelMessage("channel-2", "test-event", { foo: "bar" });
      mockWs.simulateMessage(JSON.stringify(message));

      expect(handler).not.toHaveBeenCalled();
    });

    it("should unsubscribe from a channel", () => {
      const handler = vi.fn();
      const unsubscribe = client.subscribe("test-channel", handler);

      mockWs.clearSentMessages();
      unsubscribe();

      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: MessageType.UNSUBSCRIBE,
        channel: "test-channel",
        clientId: "test-client-123",
      });

      // Should not receive messages after unsubscribing
      const message = createChannelMessage("test-channel", "test-event", { foo: "bar" });
      mockWs.simulateMessage(JSON.stringify(message));
      expect(handler).not.toHaveBeenCalled();
    });

    it("should only unsubscribe when all handlers are removed", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.subscribe("test-channel", handler1);
      client.subscribe("test-channel", handler2);

      mockWs.clearSentMessages();
      client.unsubscribe("test-channel", handler1);

      // Should not send unsubscribe yet
      expect(mockWs.getSentMessages()).toHaveLength(0);

      client.unsubscribe("test-channel", handler2);

      // Now should send unsubscribe
      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].type).toBe(MessageType.UNSUBSCRIBE);
    });

    it("should unsubscribe from all channels", () => {
      client.subscribe("channel-1", vi.fn());
      client.subscribe("channel-2", vi.fn());
      client.subscribe("channel-3", vi.fn());

      mockWs.clearSentMessages();
      client.unsubscribeAll();

      const sentMessages = mockWs.getSentMessages();
      expect(sentMessages).toHaveLength(3);
      expect(sentMessages.every(msg => msg.type === MessageType.UNSUBSCRIBE)).toBe(true);
    });

    it("should resubscribe to channels on reconnect", async () => {
      const handler = vi.fn();
      client.subscribe("test-channel", handler);

      // Simulate disconnect
      mockWs.simulateClose();
      await vi.runAllTimersAsync();

      // Simulate reconnect
      vi.advanceTimersByTime(1000);
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      // Should have sent subscribe again
      const sentMessages = mockWs.getSentMessages();
      const subscribeMessages = sentMessages.filter(msg => msg.type === MessageType.SUBSCRIBE);
      expect(subscribeMessages.length).toBeGreaterThan(0);
      expect(subscribeMessages[0].channel).toBe("test-channel");
    });
  });

  describe("state management", () => {
    it("should notify state change handlers", async () => {
      const stateHandler = vi.fn();
      client.onStateChange(stateHandler);

      client.connect();
      expect(stateHandler).toHaveBeenCalledWith(ConnectionState.CONNECTING);

      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      expect(stateHandler).toHaveBeenCalledWith(ConnectionState.CONNECTED);
    });

    it("should allow removing state change handlers", async () => {
      const stateHandler = vi.fn();
      const removeHandler = client.onStateChange(stateHandler);

      removeHandler();

      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      expect(stateHandler).not.toHaveBeenCalled();
    });

    it("should handle errors in state handlers gracefully", async () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const normalHandler = vi.fn();

      client.onStateChange(errorHandler);
      client.onStateChange(normalHandler);

      client.connect();

      // Both handlers should be called despite error
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    beforeEach(async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();
    });

    it("should notify error handlers", () => {
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      mockWs.simulateError(new Error("Test error"));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should allow removing error handlers", () => {
      const errorHandler = vi.fn();
      const removeHandler = client.onError(errorHandler);

      removeHandler();
      mockWs.simulateError(new Error("Test error"));

      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("should handle malformed messages", () => {
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      mockWs.simulateMessage("invalid json");

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle errors in message handlers", () => {
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      const faultyHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      client.subscribe("test-channel", faultyHandler);

      const message = createChannelMessage("test-channel", "test-event", {});
      mockWs.simulateMessage(JSON.stringify(message));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle error messages from server", () => {
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      const errorMessage = createErrorMessage("Server error", { code: 500 });
      mockWs.simulateMessage(JSON.stringify(errorMessage));

      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        message: "Server error",
      }));
    });
  });

  describe("reconnection", () => {
    it("should automatically reconnect after disconnect", async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      // Simulate disconnect
      mockWs.simulateClose();
      expect(client.getState()).toBe(ConnectionState.RECONNECTING);

      // Advance time to trigger reconnect
      vi.advanceTimersByTime(1000);

      // Should have created new WebSocket
      expect(MockWSConstructor.mock.calls.length).toBe(2);
    });

    it("should use exponential backoff for reconnection", async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      const initialCalls = MockWSConstructor.mock.calls.length;

      // First disconnect and reconnect
      mockWs.simulateClose();
      vi.advanceTimersByTime(1000); // Initial interval

      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateClose();

      // Second reconnect should wait longer (2x)
      vi.advanceTimersByTime(1000);
      expect(MockWSConstructor.mock.calls.length).toBe(initialCalls + 1); // Shouldn't reconnect yet

      vi.advanceTimersByTime(1000); // Complete the 2s wait
      expect(MockWSConstructor.mock.calls.length).toBe(initialCalls + 2);
    });

    it("should stop reconnecting after max attempts", async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      // Simulate multiple failed connections
      for (let i = 0; i < 3; i++) {
        mockWs.simulateClose();
        vi.advanceTimersByTime(10000); // Advance past any backoff
        mockWs = MockWSConstructor.getLastInstance();
      }

      mockWs.simulateClose();
      vi.advanceTimersByTime(100000);

      expect(client.getState()).toBe(ConnectionState.FAILED);
    });

    it("should reset reconnect attempts on successful connection", async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      // Disconnect and reconnect successfully
      mockWs.simulateClose();
      vi.advanceTimersByTime(1000);
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      // Disconnect again - should start from attempt 1
      const callsBefore = MockWSConstructor.mock.calls.length;
      mockWs.simulateClose();
      vi.advanceTimersByTime(1000); // First attempt delay

      expect(MockWSConstructor.mock.calls.length).toBe(callsBefore + 1);
    });

    it("should not reconnect if autoReconnect is false", async () => {
      const noReconnectClient = new RealtimeClient({
        url: "wss://test.example.com/ws",
        autoReconnect: false,
      });

      noReconnectClient.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();

      const callsBefore = MockWSConstructor.mock.calls.length;
      mockWs.simulateClose();
      vi.advanceTimersByTime(10000);

      // Should not create new WebSocket
      expect(MockWSConstructor.mock.calls.length).toBe(callsBefore);
    });
  });

  describe("acknowledgments", () => {
    beforeEach(async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();
      mockWs.clearSentMessages();
    });

    it("should send ack for messages that require it", () => {
      const handler = vi.fn();
      client.subscribe("test-channel", handler);

      const message = createChannelMessage("test-channel", "test-event", {});
      message.requiresAck = true;
      message.id = "msg-123";

      mockWs.simulateMessage(JSON.stringify(message));

      const sentMessages = mockWs.getSentMessages();
      const ackMessage = sentMessages.find(msg => msg.type === MessageType.ACK);

      expect(ackMessage).toBeDefined();
      expect(ackMessage?.messageId).toBe("msg-123");
      expect(ackMessage?.channel).toBe("test-channel");
    });

    it("should not send ack for messages that don't require it", () => {
      const handler = vi.fn();
      client.subscribe("test-channel", handler);

      const message = createChannelMessage("test-channel", "test-event", {});
      message.requiresAck = false;

      mockWs.simulateMessage(JSON.stringify(message));

      const sentMessages = mockWs.getSentMessages();
      const ackMessage = sentMessages.find(msg => msg.type === MessageType.ACK);

      expect(ackMessage).toBeUndefined();
    });

    it("should handle received ack messages", () => {
      const ackMessage = createAckMessage("msg-123", "test-channel");

      // Should not throw
      expect(() => {
        mockWs.simulateMessage(JSON.stringify(ackMessage));
      }).not.toThrow();
    });
  });

  describe("ping/pong", () => {
    beforeEach(async () => {
      client.connect();
      mockWs = MockWSConstructor.getLastInstance();
      mockWs.simulateOpen();
      await vi.runAllTimersAsync();
      mockWs.clearSentMessages();
    });

    it("should send periodic ping messages", () => {
      vi.advanceTimersByTime(5000);

      const sentMessages = mockWs.getSentMessages();
      const pingMessages = sentMessages.filter(msg => msg.type === MessageType.PING);

      expect(pingMessages).toHaveLength(1);
    });

    it("should handle pong responses", () => {
      const pongMessage = {
        type: MessageType.PONG,
        timestamp: Date.now(),
      };

      // Should not throw
      expect(() => {
        mockWs.simulateMessage(JSON.stringify(pongMessage));
      }).not.toThrow();
    });

    it("should send multiple pings over time", () => {
      vi.advanceTimersByTime(5000);
      expect(mockWs.getSentMessages().filter(m => m.type === MessageType.PING)).toHaveLength(1);

      vi.advanceTimersByTime(5000);
      expect(mockWs.getSentMessages().filter(m => m.type === MessageType.PING)).toHaveLength(2);

      vi.advanceTimersByTime(5000);
      expect(mockWs.getSentMessages().filter(m => m.type === MessageType.PING)).toHaveLength(3);
    });
  });
});
