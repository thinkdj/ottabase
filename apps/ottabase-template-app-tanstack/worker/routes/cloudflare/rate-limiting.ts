/**
 * Rate Limiting API routes
 * Demonstrates Cloudflare Rate Limiting
 */

import { createRateLimitingClient } from "@ottabase/cf/rate-limiting";
import type { RouteModule } from "../../types";
import { simulateRateLimit } from "../../utils/auth";
import { errorResponse, json, readJson } from "../../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/cloudflare/rate-limiting",
    handlers: {
      POST: async ({ request, env }) => {
        const body = await readJson<{ key?: string }>(request);
        if (!body.key) return errorResponse("Key is required");

        let rateLimitData: {
          success: boolean;
          limit: number;
          remaining: number;
          resetAfter: number;
        } | null = null;

        // Try native rate limiter first
        if (env.OBCF_RATE_LIMITER) {
          try {
            const limiter = createRateLimitingClient({ rateLimiter: env.OBCF_RATE_LIMITER });
            const result = await limiter.limit({ key: body.key });
            if (result.success) {
              const { success, limit, remaining, resetAfter } = result.data;
              if (limit !== undefined && remaining !== undefined && resetAfter !== undefined) {
                rateLimitData = { success, limit, remaining, resetAfter };
              }
            }
          } catch {
            // ignore - will fall back
          }
        }

        // Fall back to KV-based simulation for local dev
        if (!rateLimitData) {
          rateLimitData = await simulateRateLimit(env, body.key);
          if (!rateLimitData) {
            return json(
              {
                error: "Rate limiter not available",
                hint: "Enable OBCF_RATE_LIMITER binding or ensure OBCF_KV is configured for local dev simulation",
              },
              { status: 500 },
            );
          }
        }

        const { success, limit, remaining, resetAfter } = rateLimitData;

        const headers = {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": resetAfter.toString(),
        };

        if (!success) {
          return json(
            { error: "Rate limit exceeded", limit, remaining, resetAfter },
            { status: 429, headers },
          );
        }

        return json(
          { success: true, message: "Request allowed", limit, remaining, resetAfter },
          { headers },
        );
      },
    },
  },
];
