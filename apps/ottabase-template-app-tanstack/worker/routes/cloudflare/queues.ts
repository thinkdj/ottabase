/**
 * Queues API routes
 * Demonstrates Cloudflare Queues operations
 */

import { createKVClient } from "@ottabase/cf/kv";
import { createQueuesClient } from "@ottabase/cf/queues";
import type { RouteModule } from "../../types";
import { errorResponse, json, readJson } from "../../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/cloudflare/queues",
    handlers: {
      GET: async ({ env }) => {
        if (!env.OBCF_KV) {
          return errorResponse("KV binding not configured", 500);
        }

        const kv = createKVClient({ namespace: env.OBCF_KV as any });
        const listResult = await kv.list({ prefix: "queue:message:" });
        if (!listResult.success) {
          return errorResponse("Failed to list messages", 500);
        }

        const messages: any[] = [];
        for (const key of listResult.data.keys.slice(0, 20)) {
          const result = await kv.get(key.name);
          if (result.success && result.data) {
            try {
              const message = JSON.parse(result.data as string);
              messages.push({ key: key.name, ...message });
            } catch {
              // ignore
            }
          }
        }

        messages.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

        return json({ messages });
      },

      POST: async ({ request, env }) => {
        if (!env.OBCF_QUEUE) {
          return errorResponse("Queue binding not configured", 500);
        }

        const body = await readJson<{ message?: unknown; batch?: unknown[] }>(request);
        const queue = createQueuesClient({ queue: env.OBCF_QUEUE });

        // Handle batch send
        if (Array.isArray(body.batch)) {
          const messages = body.batch.map((msg) => ({ body: msg }));
          const result = await queue.sendBatch(messages);
          if (!result.success) {
            return errorResponse("Failed to send batch", 500, result.error.message);
          }

          // Log to KV for demo purposes
          if (env.OBCF_KV) {
            try {
              const kv = createKVClient({ namespace: env.OBCF_KV as any });
              const timestamp = Date.now();
              for (let i = 0; i < body.batch.length; i++) {
                const key = `queue:message:${timestamp}:${i}`;
                await kv.put(
                  key,
                  JSON.stringify({
                    ...(body.batch[i] as any),
                    sentAt: new Date().toISOString(),
                    type: "batch",
                  }),
                  { expirationTtl: 3600 },
                );
              }
            } catch {
              // ignore demo history errors
            }
          }

          return json({
            success: true,
            message: `Sent ${body.batch.length} messages to queue`,
            count: body.batch.length,
          });
        }

        // Handle single message
        if (body.message) {
          const result = await queue.send(body.message);
          if (!result.success) {
            return errorResponse("Failed to send message", 500, result.error.message);
          }

          if (env.OBCF_KV) {
            try {
              const kv = createKVClient({ namespace: env.OBCF_KV as any });
              const key = `queue:message:${Date.now()}`;
              await kv.put(
                key,
                JSON.stringify({
                  ...(body.message as any),
                  sentAt: new Date().toISOString(),
                  type: "single",
                }),
                { expirationTtl: 3600 },
              );
            } catch {
              // ignore
            }
          }

          return json({ success: true, message: "Message sent to queue" });
        }

        return errorResponse("Either message or batch is required");
      },
    },
  },
];
