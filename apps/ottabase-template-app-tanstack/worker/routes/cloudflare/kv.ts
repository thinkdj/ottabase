/**
 * KV API routes
 * Demonstrates Cloudflare KV operations
 */

import { createKVClient } from "@ottabase/cf/kv";
import type { RouteModule } from "../../types";
import { errorResponse, json, readJson } from "../../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/cloudflare/kv",
    handlers: {
      GET: async ({ env, url }) => {
        if (!env.OBCF_KV) {
          return errorResponse("KV namespace binding not configured", 500);
        }

        const kv = createKVClient({ namespace: env.OBCF_KV as any });
        const key = url.searchParams.get("key");
        if (!key) return errorResponse("Key is required");

        const result = await kv.getText(key);
        if (!result.success) {
          return errorResponse("Failed to get value", 500, result.error.message);
        }

        return json({ value: result.data });
      },

      POST: async ({ request, env }) => {
        if (!env.OBCF_KV) {
          return errorResponse("KV namespace binding not configured", 500);
        }

        const kv = createKVClient({ namespace: env.OBCF_KV as any });
        const body = await readJson<{ key?: string; value?: string; ttl?: number | string }>(
          request,
        );
        if (!body.key || !body.value) {
          return errorResponse("Key and value are required");
        }

        const expirationTtl = body.ttl ? parseInt(String(body.ttl), 10) : undefined;
        const result = await kv.put(body.key, body.value, { expirationTtl });
        if (!result.success) {
          return errorResponse("Failed to set value", 500, result.error.message);
        }
        return json({ success: true });
      },

      DELETE: async ({ env, url }) => {
        if (!env.OBCF_KV) {
          return errorResponse("KV namespace binding not configured", 500);
        }

        const kv = createKVClient({ namespace: env.OBCF_KV as any });
        const key = url.searchParams.get("key");
        if (!key) return errorResponse("Key is required");

        const result = await kv.delete(key);
        if (!result.success) {
          return errorResponse("Failed to delete value", 500, result.error.message);
        }
        return json({ success: true });
      },
    },
  },
];
