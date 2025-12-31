/**
 * Realtime API routes
 * Demonstrates Cloudflare Durable Objects for WebSocket-based realtime
 */

import { RealtimeBroadcaster } from "@ottabase/cf-realtime/server";
import type { RouteModule } from "../../types";
import { errorResponse, json, readJson } from "../../utils/response";

/** Cast helper for OBCF_REALTIME namespace */
function getRealtimeNamespace(env: CloudflareEnv): DurableObjectNamespace {
  return env.OBCF_REALTIME as unknown as DurableObjectNamespace;
}

/** Helper to create "not available" response */
function realtimeNotAvailable(env: CloudflareEnv): Response {
  return json(
    {
      error: "Realtime is not available in this environment",
      details: "The Durable Object binding (OBCF_REALTIME) is not configured.",
      hint: "Deploy with `wrangler deploy` to enable Durable Objects.",
      environment: env.ENVIRONMENT ?? "unknown",
    },
    { status: 501 },
  );
}

export const routes: RouteModule["routes"] = [
  {
    path: "/api/cloudflare/realtime/ws",
    handlers: {
      GET: async ({ request, env }) => {
        if (!env.OBCF_REALTIME) {
          return realtimeNotAvailable(env);
        }

        if (request.headers.get("Upgrade") !== "websocket") {
          return errorResponse("Expected WebSocket upgrade", 426);
        }

        const id = env.OBCF_REALTIME.idFromName("global");
        const stub = env.OBCF_REALTIME.get(id);
        return stub.fetch(request as any) as unknown as Response;
      },
    },
  },
  {
    path: "/api/cloudflare/realtime/broadcast",
    handlers: {
      POST: async ({ request, env }) => {
        if (!env.OBCF_REALTIME) {
          return realtimeNotAvailable(env);
        }

        const body = await readJson<{
          channels?: string[];
          event?: string;
          data?: unknown;
          persistForOffline?: boolean;
        }>(request);

        if (!body.channels || !Array.isArray(body.channels) || body.channels.length === 0) {
          return errorResponse("channels array is required");
        }
        if (!body.event) {
          return errorResponse("event is required");
        }

        const broadcaster = new RealtimeBroadcaster(getRealtimeNamespace(env));
        const result = await broadcaster.broadcast({
          channels: body.channels,
          event: body.event,
          data: body.data,
          persistForOffline: body.persistForOffline ?? false,
          metadata: { sentAt: Date.now(), source: "api" },
        });

        if (!result.success) {
          return errorResponse("Failed to broadcast message", 500, result.error);
        }

        return json({ success: true, channelsCount: body.channels.length });
      },
    },
  },
  {
    path: "/api/cloudflare/realtime/stats",
    handlers: {
      GET: async ({ env }) => {
        if (!env.OBCF_REALTIME) {
          return realtimeNotAvailable(env);
        }

        const broadcaster = new RealtimeBroadcaster(getRealtimeNamespace(env));
        const stats = await broadcaster.getStats();
        return json(
          stats ?? {
            totalConnections: 0,
            channels: [],
            offlineMessagesQueued: 0,
          },
        );
      },
    },
  },
];
