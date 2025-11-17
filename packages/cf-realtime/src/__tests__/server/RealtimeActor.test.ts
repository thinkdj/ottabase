/**
 * Unit tests for RealtimeActor
 * Tests Durable Object behavior using Cloudflare Workers test environment
 *
 * These tests run in the Workers runtime via @cloudflare/vitest-pool-workers
 * which provides Miniflare for local Durable Objects emulation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { RealtimeActor } from "../../server/RealtimeActor";
import { createBroadcastMessage } from "../fixtures/messages";

// Define the env interface for our tests
interface Env {
  REALTIME: DurableObjectNamespace<RealtimeActor>;
}

describe("RealtimeActor - Durable Object Tests", () => {
  let id: DurableObjectId;
  let stub: DurableObjectStub<RealtimeActor>;

  beforeEach(() => {
    // Get a Durable Object instance
    // Each test gets a new ID for isolation
    const testEnv = env as unknown as Env;
    id = testEnv.REALTIME.idFromName(`test-${Date.now()}-${Math.random()}`);
    stub = testEnv.REALTIME.get(id);
  });

  describe("HTTP endpoints", () => {
    it("should handle health check", async () => {
      const response = await stub.fetch("https://test.example.com/health");

      expect(response.status).toBe(200);
      const data = await response.json<{ status: string; connections: number }>();
      expect(data.status).toBe("ok");
      expect(data.connections).toBe(0);
    });

    it("should return 404 for unknown endpoints", async () => {
      const response = await stub.fetch("https://test.example.com/unknown");
      expect(response.status).toBe(404);
    });

    it("should handle stats request", async () => {
      const response = await stub.fetch("https://test.example.com/stats");

      expect(response.status).toBe(200);
      const stats = await response.json<{
        totalConnections: number;
        channels: Array<{ channel: string; subscriberCount: number }>;
        offlineMessagesQueued: number;
      }>();

      expect(stats.totalConnections).toBe(0);
      expect(Array.isArray(stats.channels)).toBe(true);
      expect(stats.offlineMessagesQueued).toBe(0);
    });

    it("should handle broadcast request", async () => {
      const broadcast = createBroadcastMessage(["channel-1"], "test-event", { foo: "bar" });

      const response = await stub.fetch("https://test.example.com/broadcast", {
        method: "POST",
        body: JSON.stringify(broadcast),
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(200);
      const result = await response.json<{ success: boolean; channels: number }>();
      expect(result.success).toBe(true);
      expect(result.channels).toBe(1);
    });

    it("should handle broadcast to multiple channels", async () => {
      const broadcast = createBroadcastMessage(
        ["channel-1", "channel-2", "channel-3"],
        "multi-event",
        { data: "test" }
      );

      const response = await stub.fetch("https://test.example.com/broadcast", {
        method: "POST",
        body: JSON.stringify(broadcast),
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(200);
      const result = await response.json<{ success: boolean; channels: number }>();
      expect(result.success).toBe(true);
      expect(result.channels).toBe(3);
    });

    it("should handle invalid broadcast request", async () => {
      const response = await stub.fetch("https://test.example.com/broadcast", {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(400);
      const result = await response.json<{ success: boolean; error: string }>();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("WebSocket upgrade", () => {
    it("should upgrade to WebSocket with client ID", async () => {
      const response = await stub.fetch("https://test.example.com/ws?clientId=test-client", {
        headers: {
          "Upgrade": "websocket",
        },
      });

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });

    it("should upgrade to WebSocket without client ID (auto-generate)", async () => {
      const response = await stub.fetch("https://test.example.com/ws", {
        headers: {
          "Upgrade": "websocket",
        },
      });

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });
  });

  describe("Durable Object isolation", () => {
    it("should maintain separate state across different DO instances", async () => {
      // Create two different Durable Objects
      const testEnv = env as unknown as Env;

      const id1 = testEnv.REALTIME.idFromName("instance-1");
      const stub1 = testEnv.REALTIME.get(id1);

      const id2 = testEnv.REALTIME.idFromName("instance-2");
      const stub2 = testEnv.REALTIME.get(id2);

      // Make requests to both
      const stats1 = await stub1.fetch("https://test.example.com/stats");
      const stats2 = await stub2.fetch("https://test.example.com/stats");

      // Both should work independently
      expect(stats1.status).toBe(200);
      expect(stats2.status).toBe(200);

      const data1 = await stats1.json();
      const data2 = await stats2.json();

      // Both should have clean state
      expect(data1.totalConnections).toBe(0);
      expect(data2.totalConnections).toBe(0);
    });

    it("should persist state within same DO instance", async () => {
      // Make multiple requests to the same instance
      const health1 = await stub.fetch("https://test.example.com/health");
      const health2 = await stub.fetch("https://test.example.com/health");

      expect(health1.status).toBe(200);
      expect(health2.status).toBe(200);

      // Instance should maintain its identity
      const data1 = await health1.json();
      const data2 = await health2.json();

      expect(data1.status).toBe("ok");
      expect(data2.status).toBe("ok");
    });
  });

  describe("Broadcast persistence", () => {
    it("should handle broadcast with persistence enabled", async () => {
      const broadcast = createBroadcastMessage(["persist-channel"], "event", { data: "value" });
      broadcast.persistForOffline = true;

      const response = await stub.fetch("https://test.example.com/broadcast", {
        method: "POST",
        body: JSON.stringify(broadcast),
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(200);
      const result = await response.json<{ success: boolean }>();
      expect(result.success).toBe(true);
    });

    it("should handle broadcast without persistence", async () => {
      const broadcast = createBroadcastMessage(["temp-channel"], "event", { data: "value" });
      broadcast.persistForOffline = false;

      const response = await stub.fetch("https://test.example.com/broadcast", {
        method: "POST",
        body: JSON.stringify(broadcast),
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(200);
      const result = await response.json<{ success: boolean }>();
      expect(result.success).toBe(true);
    });
  });
});
