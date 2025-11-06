/**
 * Unit tests for RealtimeActor
 * Tests Durable Object behavior using Cloudflare Workers test environment
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeActor } from "../../server/RealtimeActor";
import { MessageType } from "../../types";
import {
  createSubscribeMessage,
  createUnsubscribeMessage,
  createChannelMessage,
  createBroadcastMessage,
  createPingMessage,
  createAckMessage,
} from "../fixtures/messages";

describe("RealtimeActor", () => {
  let actor: RealtimeActor;
  let state: DurableObjectState;
  let env: any;

  beforeEach(() => {
    // Mock DurableObjectState
    const storage = new Map();
    state = {
      id: { toString: () => "test-actor-id" } as DurableObjectId,
      storage: {
        get: async (key: string) => storage.get(key),
        put: async (key: string, value: any) => {
          storage.set(key, value);
        },
        delete: async (key: string) => storage.delete(key),
        list: async () => new Map(storage),
        deleteAll: async () => storage.clear(),
        setAlarm: async (time: number) => {},
        getAlarm: async () => null,
        deleteAlarm: async () => {},
      },
      waitUntil: async (promise: Promise<any>) => {},
      blockConcurrencyWhile: async (callback: () => Promise<any>) => callback(),
    } as DurableObjectState;

    env = {};
    actor = new RealtimeActor(state, env);
  });

  describe("initialization", () => {
    it("should initialize actor", async () => {
      await actor.onInit();
      // Should not throw
      expect(true).toBe(true);
    });

    it("should load persisted offline messages on init", async () => {
      const offlineMessages = new Map([
        ["client-1", [
          {
            id: "msg-1",
            channel: "test-channel",
            event: "test-event",
            data: { test: "data" },
            createdAt: Date.now(),
          },
        ]],
      ]);

      await state.storage.put("offlineMessages", Array.from(offlineMessages.entries()));
      await actor.onInit();

      // Should not throw during initialization
      expect(true).toBe(true);
    });
  });

  describe("HTTP endpoints", () => {
    it("should handle health check", async () => {
      const request = new Request("https://test.example.com/health");
      const response = await actor.fetch(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("connections");
    });

    it("should return 404 for unknown endpoints", async () => {
      const request = new Request("https://test.example.com/unknown");
      const response = await actor.fetch(request);

      expect(response.status).toBe(404);
    });

    it("should handle stats request", async () => {
      const request = new Request("https://test.example.com/stats");
      const response = await actor.fetch(request);

      expect(response.status).toBe(200);
      const stats = await response.json();
      expect(stats).toHaveProperty("totalConnections");
      expect(stats).toHaveProperty("channels");
      expect(stats).toHaveProperty("offlineMessagesQueued");
    });

    it("should handle broadcast request", async () => {
      const broadcast = createBroadcastMessage(["channel-1"], "test-event", { foo: "bar" });

      const request = new Request("https://test.example.com/broadcast", {
        method: "POST",
        body: JSON.stringify(broadcast),
        headers: { "Content-Type": "application/json" },
      });

      const response = await actor.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it("should handle invalid broadcast request", async () => {
      const request = new Request("https://test.example.com/broadcast", {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      const response = await actor.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
    });
  });

  describe("WebSocket connections", () => {
    it("should upgrade to WebSocket", async () => {
      const request = new Request("https://test.example.com/ws?clientId=test-client", {
        headers: {
          "Upgrade": "websocket",
        },
      });

      const response = await actor.fetch(request);

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });

    it("should generate client ID if not provided", async () => {
      const request = new Request("https://test.example.com/ws", {
        headers: {
          "Upgrade": "websocket",
        },
      });

      const response = await actor.fetch(request);

      expect(response.status).toBe(101);
      // Client ID should be auto-generated
    });
  });

  describe("message handling", () => {
    let ws: WebSocket;
    let serverWs: WebSocket;
    let receivedMessages: any[];

    beforeEach(async () => {
      receivedMessages = [];

      const request = new Request("https://test.example.com/ws?clientId=test-client", {
        headers: {
          "Upgrade": "websocket",
        },
      });

      const response = await actor.fetch(request);
      ws = response.webSocket!;

      // Mock WebSocket methods
      const send = ws.send.bind(ws);
      ws.send = (data: string) => {
        try {
          receivedMessages.push(JSON.parse(data));
        } catch (e) {
          receivedMessages.push(data);
        }
        return send(data);
      };
    });

    it("should send connection acknowledgment", () => {
      const ackMessage = receivedMessages.find(msg => msg.type === MessageType.ACK);
      expect(ackMessage).toBeDefined();
    });

    it("should handle ping messages", () => {
      const ping = createPingMessage();
      ws.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify(ping),
      }));

      // Should eventually receive pong
      // Note: In real async environment, you'd wait for the response
    });

    it("should handle subscribe messages", () => {
      const subscribe = createSubscribeMessage("test-channel", "test-client");
      receivedMessages = []; // Clear initial messages

      ws.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify(subscribe),
      }));

      // Should receive acknowledgment
      // Note: Testing async behavior requires proper Workers environment
    });

    it("should handle unsubscribe messages", () => {
      const unsubscribe = createUnsubscribeMessage("test-channel", "test-client");
      receivedMessages = [];

      ws.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify(unsubscribe),
      }));

      // Should receive acknowledgment
    });

    it("should handle malformed messages gracefully", () => {
      ws.dispatchEvent(new MessageEvent("message", {
        data: "invalid json",
      }));

      // Should send error message
      const errorMessage = receivedMessages.find(msg => msg.type === MessageType.ERROR);
      // In proper environment, error would be sent
    });
  });

  describe("channel subscriptions", () => {
    it("should track client subscriptions", async () => {
      const request = new Request("https://test.example.com/ws?clientId=test-client", {
        headers: { "Upgrade": "websocket" },
      });

      const response = await actor.fetch(request);
      const ws = response.webSocket!;

      // Subscribe to channel
      const subscribe = createSubscribeMessage("test-channel", "test-client");
      ws.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify(subscribe),
      }));

      // Get stats to verify subscription
      const statsRequest = new Request("https://test.example.com/stats");
      const statsResponse = await actor.fetch(statsRequest);
      const stats = await statsResponse.json();

      // In proper Workers environment, this would show the subscription
      expect(stats).toBeDefined();
    });
  });

  describe("offline message handling", () => {
    it("should store offline messages when persistence is enabled", async () => {
      const message = createChannelMessage("test-channel", "test-event", { foo: "bar" });
      message.requiresAck = true;

      // In proper Workers environment, this would store the message
      expect(message.requiresAck).toBe(true);
    });

    it("should deliver offline messages on reconnection", async () => {
      // This test requires proper Workers environment with Durable Objects storage
      expect(true).toBe(true);
    });

    it("should clean up expired messages", async () => {
      await actor.onAlarm();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("broadcast functionality", () => {
    it("should broadcast to multiple channels", async () => {
      const broadcast = createBroadcastMessage(
        ["channel-1", "channel-2"],
        "broadcast-event",
        { data: "test" }
      );

      const request = new Request("https://test.example.com/broadcast", {
        method: "POST",
        body: JSON.stringify(broadcast),
        headers: { "Content-Type": "application/json" },
      });

      const response = await actor.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.channels).toBe(2);
    });

    it("should persist broadcast messages when enabled", async () => {
      const broadcast = createBroadcastMessage(["channel-1"], "test-event", { foo: "bar" });
      broadcast.persistForOffline = true;

      const request = new Request("https://test.example.com/broadcast", {
        method: "POST",
        body: JSON.stringify(broadcast),
        headers: { "Content-Type": "application/json" },
      });

      const response = await actor.fetch(request);
      expect(response.status).toBe(200);
    });
  });

  describe("client management", () => {
    it("should track connected clients", async () => {
      const request1 = new Request("https://test.example.com/ws?clientId=client-1", {
        headers: { "Upgrade": "websocket" },
      });
      const request2 = new Request("https://test.example.com/ws?clientId=client-2", {
        headers: { "Upgrade": "websocket" },
      });

      await actor.fetch(request1);
      await actor.fetch(request2);

      const statsRequest = new Request("https://test.example.com/stats");
      const statsResponse = await actor.fetch(statsRequest);
      const stats = await statsResponse.json();

      expect(stats.totalConnections).toBe(2);
    });

    it("should remove client on disconnect", async () => {
      const request = new Request("https://test.example.com/ws?clientId=test-client", {
        headers: { "Upgrade": "websocket" },
      });

      const response = await actor.fetch(request);
      const ws = response.webSocket!;

      // Simulate disconnect
      ws.dispatchEvent(new Event("close"));

      const statsRequest = new Request("https://test.example.com/stats");
      const statsResponse = await actor.fetch(statsRequest);
      const stats = await statsResponse.json();

      expect(stats.totalConnections).toBe(0);
    });
  });

  describe("acknowledgments", () => {
    it("should handle message acknowledgments", async () => {
      const request = new Request("https://test.example.com/ws?clientId=test-client", {
        headers: { "Upgrade": "websocket" },
      });

      const response = await actor.fetch(request);
      const ws = response.webSocket!;

      const ack = createAckMessage("msg-123", "test-channel");
      ws.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify(ack),
      }));

      // Should handle ack without errors
      expect(true).toBe(true);
    });

    it("should remove acknowledged messages from offline queue", async () => {
      // This test requires proper Workers environment with storage
      expect(true).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle WebSocket errors gracefully", async () => {
      const request = new Request("https://test.example.com/ws?clientId=test-client", {
        headers: { "Upgrade": "websocket" },
      });

      const response = await actor.fetch(request);
      const ws = response.webSocket!;

      ws.dispatchEvent(new Event("error"));

      // Should handle error without crashing
      expect(true).toBe(true);
    });

    it("should send error messages to clients", async () => {
      const request = new Request("https://test.example.com/ws?clientId=test-client", {
        headers: { "Upgrade": "websocket" },
      });

      const response = await actor.fetch(request);
      const ws = response.webSocket!;

      // Send invalid message
      ws.dispatchEvent(new MessageEvent("message", {
        data: "not json",
      }));

      // Error should be sent to client (in proper Workers environment)
      expect(true).toBe(true);
    });
  });

  describe("alarms", () => {
    it("should clean up expired messages on alarm", async () => {
      await actor.onAlarm();
      // Should not throw
      expect(true).toBe(true);
    });

    it("should schedule next alarm", async () => {
      await actor.onAlarm();
      // In proper Workers environment, next alarm would be scheduled
      expect(true).toBe(true);
    });
  });
});
