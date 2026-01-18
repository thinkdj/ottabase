import type { CloudflareEnv } from "@ottabase/cf";
import { RealtimeBroadcaster } from "@ottabase/cf-realtime/server";
import { createImagesClient } from "@ottabase/cf/images";
import { createKVClient } from "@ottabase/cf/kv";
import { createQueuesClient } from "@ottabase/cf/queues";
import { createRateLimitingClient } from "@ottabase/cf/rate-limiting";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { registerConnection } from "@ottabase/ottaorm";
import { errorResponse } from "@ottabase/utils/http-errors";
import { jsonResponse } from "@ottabase/utils/http-response";
import { Todo } from "../../ottabase/models/Todo";
import { readJson, simulateRateLimit } from "../utils";

export async function handleCloudflareRoutes(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const envAny = env as any;

  if (url.pathname === "/api/cloudflare/kv") {
    if (!envAny.OBCF_KV) {
      return errorResponse("KV namespace binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    const kv = createKVClient({ namespace: envAny.OBCF_KV as any });

    if (request.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) return errorResponse("Key is required", 400);

      const result = await kv.getText(key);
      if (!result.success) {
        return errorResponse("Failed to get value", 500, {
          details: result.error.message,
        });
      }

      return jsonResponse({ value: result.data });
    }

    if (request.method === "POST") {
      const body = await readJson<{
        key?: string;
        value?: string;
        ttl?: number | string;
      }>(request);
      if (!body.key || !body.value) {
        return errorResponse("Key and value are required", 400);
      }

      const expirationTtl = body.ttl
        ? parseInt(String(body.ttl), 10)
        : undefined;
      const result = await kv.put(body.key, body.value, { expirationTtl });
      if (!result.success) {
        return errorResponse("Failed to set value", 500, {
          details: result.error.message,
        });
      }
      return jsonResponse({ success: true });
    }

    if (request.method === "DELETE") {
      const key = url.searchParams.get("key");
      if (!key) return errorResponse("Key is required", 400);

      const result = await kv.delete(key);
      if (!result.success) {
        return errorResponse("Failed to delete value", 500, {
          details: result.error.message,
        });
      }
      return jsonResponse({ success: true });
    }

    return errorResponse("Method not allowed", 405, {
      code: "METHOD_NOT_ALLOWED",
    });
  }

  if (url.pathname === "/api/cloudflare/r2") {
    if (!envAny.OBCF_R2) {
      return errorResponse("R2 bucket binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    if (request.method === "GET") {
      if (url.searchParams.get("list") === "true") {
        const listing = await envAny.OBCF_R2.list({ limit: 100 });
        return jsonResponse({ objects: listing.objects });
      }

      const key = url.searchParams.get("key");
      if (!key) return errorResponse("key is required", 400);

      const object = await envAny.OBCF_R2.get(key);
      if (!object) return errorResponse("Object not found", 404);

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Content-Disposition", `attachment; filename=\"${key}\"`);

      return new Response(object.body, { headers });
    }

    if (request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      const key = formData.get("key");

      if (!key || typeof key !== "string") {
        return errorResponse("key is required", 400);
      }
      if (!(file instanceof File)) {
        return errorResponse("file is required", 400);
      }

      await envAny.OBCF_R2.put(key, await file.arrayBuffer(), {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
        },
      });

      const publicUrl = `/api/cloudflare/r2?key=${encodeURIComponent(key)}`;

      return jsonResponse({ success: true, data: { url: publicUrl } });
    }

    if (request.method === "DELETE") {
      const key = url.searchParams.get("key");
      if (!key) return errorResponse("key is required", 400);
      await envAny.OBCF_R2.delete(key);
      return jsonResponse({ success: true });
    }

    return errorResponse("Method not allowed", 405, {
      code: "METHOD_NOT_ALLOWED",
    });
  }

  if (url.pathname === "/api/cloudflare/images") {
    const accountId = envAny.CF_IMAGES_ACCOUNT_ID as string;
    const apiToken = envAny.CF_IMAGES_API_TOKEN as string;

    if (!accountId || !apiToken) {
      return errorResponse(
        "Cloudflare Images credentials not configured",
        500,
        {
          code: "CONFIG_ERROR",
        },
      );
    }

    const imagesClient = createImagesClient({ accountId, apiToken });

    if (request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return errorResponse("file is required", 400);
      }

      const result = await imagesClient.upload(file);

      if (!result.success) {
        return errorResponse(result.error.message, 500);
      }

      const variants = result.data.variants;
      const publicUrl = variants && variants.length > 0 ? variants[0] : null;

      return jsonResponse({
        success: true,
        data: {
          url: publicUrl,
          variants,
          id: result.data.id,
        },
      });
    }

    return errorResponse("Method not allowed", 405, {
      code: "METHOD_NOT_ALLOWED",
    });
  }

  if (url.pathname === "/api/cloudflare/d1/init" && request.method === "POST") {
    if (!envAny.OBCF_D1) {
      return errorResponse(
        "D1 database binding not configured. Check wrangler.jsonc",
        500,
        { code: "CONFIG_ERROR" },
      );
    }

    await envAny.OBCF_D1.batch([
      envAny.OBCF_D1.prepare(`
          CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            user_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `),
    ]);

    registerConnection("default", createD1Driver(envAny.OBCF_D1));
    const count = (await Todo.all()).length;

    return jsonResponse({
      success: true,
      message: "Database initialized successfully",
      info: `Found ${count} existing todos`,
    });
  }

  if (url.pathname === "/api/cloudflare/d1/todos") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    registerConnection("default", createD1Driver(envAny.OBCF_D1));

    if (request.method === "GET") {
      const todos = await Todo.all({
        orderBy: "createdAt",
        orderDirection: "desc",
      });
      return jsonResponse({ todos: todos.map((t) => t.toJson()) });
    }

    if (request.method === "POST") {
      const body = await readJson<{ title?: string }>(request);
      if (!body.title || typeof body.title !== "string") {
        return errorResponse("Title is required and must be a string", 400);
      }

      const todo = await Todo.create({
        id: crypto.randomUUID(),
        title: body.title.trim(),
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return jsonResponse({
        success: true,
        message: "Todo created successfully",
        todo: todo.toJson(),
      });
    }

    return errorResponse("Method not allowed", 405, {
      code: "METHOD_NOT_ALLOWED",
    });
  }

  const d1TodoMatch = url.pathname.match(
    /^\/api\/cloudflare\/d1\/todos\/(.+)$/,
  );
  if (d1TodoMatch) {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    registerConnection("default", createD1Driver(envAny.OBCF_D1));

    const id = d1TodoMatch[1];
    if (!id) return errorResponse("Invalid id", 400);

    if (request.method === "PATCH") {
      const body = await readJson<{ completed?: boolean }>(request);
      if (typeof body.completed !== "boolean") {
        return errorResponse("Completed must be a boolean", 400);
      }

      const todo = await Todo.find(id);
      if (!todo) return errorResponse("Todo not found", 404);

      todo.set("completed", body.completed);
      await todo.save();

      return jsonResponse({
        success: true,
        message: "Todo updated successfully",
        todo: todo.toJson(),
      });
    }

    if (request.method === "DELETE") {
      const todo = await Todo.find(id);
      if (!todo) return errorResponse("Todo not found", 404);

      await Todo.delete(id);
      return jsonResponse({
        success: true,
        message: "Todo deleted successfully",
      });
    }

    return errorResponse("Method not allowed", 405, {
      code: "METHOD_NOT_ALLOWED",
    });
  }

  if (url.pathname === "/api/cloudflare/queues") {
    if (request.method === "POST") {
      if (!envAny.OBCF_QUEUE) {
        return errorResponse("Queue binding not configured", 500, {
          code: "CONFIG_ERROR",
        });
      }

      const body = await readJson<{ message?: unknown; batch?: unknown[] }>(
        request,
      );
      const queue = createQueuesClient({ queue: envAny.OBCF_QUEUE });

      if (Array.isArray(body.batch)) {
        const messages = body.batch.map((msg) => ({ body: msg }));
        const result = await queue.sendBatch(messages);
        if (!result.success) {
          return errorResponse("Failed to send batch", 500, {
            details: result.error.message,
          });
        }

        if (envAny.OBCF_KV) {
          try {
            const kv = createKVClient({ namespace: envAny.OBCF_KV as any });
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

        return jsonResponse({
          success: true,
          message: `Sent ${body.batch.length} messages to queue`,
          count: body.batch.length,
        });
      }

      if (body.message) {
        const result = await queue.send(body.message);
        if (!result.success) {
          return errorResponse("Failed to send message", 500, {
            details: result.error.message,
          });
        }

        if (envAny.OBCF_KV) {
          try {
            const kv = createKVClient({ namespace: envAny.OBCF_KV as any });
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

        return jsonResponse({
          success: true,
          message: "Message sent to queue",
        });
      }

      return errorResponse("Either message or batch is required", 400);
    }

    if (request.method === "GET") {
      if (!envAny.OBCF_KV) {
        return errorResponse("KV binding not configured", 500, {
          code: "CONFIG_ERROR",
        });
      }

      const kv = createKVClient({ namespace: envAny.OBCF_KV as any });
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

      messages.sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      );

      return jsonResponse({ messages });
    }

    return errorResponse("Method not allowed", 405, {
      code: "METHOD_NOT_ALLOWED",
    });
  }

  if (
    url.pathname === "/api/cloudflare/rate-limiting" &&
    request.method === "POST"
  ) {
    const body = await readJson<{ key?: string }>(request);
    if (!body.key) return errorResponse("Key is required", 400);

    let rateLimitData: {
      success: boolean;
      limit: number;
      remaining: number;
      resetAfter: number;
    } | null = null;

    if (envAny.OBCF_RATE_LIMITER) {
      try {
        const limiter = createRateLimitingClient({
          rateLimiter: envAny.OBCF_RATE_LIMITER,
        });
        const result = await limiter.limit({ key: body.key });
        if (result.success) {
          const { success, limit, remaining, resetAfter } = result.data;
          if (
            limit !== undefined &&
            remaining !== undefined &&
            resetAfter !== undefined
          ) {
            rateLimitData = { success, limit, remaining, resetAfter };
          }
        }
      } catch {
        // ignore - will fall back
      }
    }

    if (!rateLimitData) {
      rateLimitData = await simulateRateLimit(envAny, body.key);
      if (!rateLimitData) {
        return errorResponse("Rate limiter not available", 500, {
          hint: "Enable OBCF_RATE_LIMITER binding or ensure OBCF_KV is configured for local dev simulation",
          code: "CONFIG_ERROR",
        });
      }
    }

    const { success, limit, remaining, resetAfter } = rateLimitData;

    const headers = {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": resetAfter.toString(),
    };

    if (!success) {
      return errorResponse("Rate limit exceeded", 429, {
        code: "RATE_LIMITED",
        details: `Limit: ${limit}, Remaining: ${remaining}, Reset After: ${resetAfter}`,
        status: 429,
      } as any);
    }

    return jsonResponse(
      {
        success: true,
        message: "Request allowed",
        limit,
        remaining,
        resetAfter,
      },
      200,
      { headers },
    );
  }

  if (url.pathname === "/api/cloudflare/realtime/ws") {
    if (!envAny.OBCF_REALTIME) {
      return errorResponse(
        "Realtime is not available in this environment",
        501,
        {
          details:
            "The Durable Object binding (OBCF_REALTIME) is not configured.",
          hint: "Deploy with `wrangler deploy` to enable Durable Objects.",
          code: "CONFIG_ERROR",
        },
      );
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return errorResponse("Expected WebSocket upgrade", 426, {
        code: "UPGRADE_REQUIRED",
      });
    }

    const id = envAny.OBCF_REALTIME.idFromName("global");
    const stub = envAny.OBCF_REALTIME.get(id);
    return stub.fetch(request as any) as unknown as Response;
  }

  if (
    url.pathname === "/api/cloudflare/realtime/broadcast" &&
    request.method === "POST"
  ) {
    if (!envAny.OBCF_REALTIME) {
      return errorResponse(
        "Realtime is not available in this environment",
        501,
        { code: "CONFIG_ERROR" },
      );
    }

    const body = await readJson<{
      channels?: string[];
      event?: string;
      data?: unknown;
      persistForOffline?: boolean;
    }>(request);

    if (
      !body.channels ||
      !Array.isArray(body.channels) ||
      body.channels.length === 0
    ) {
      return errorResponse("channels array is required", 400);
    }
    if (!body.event) {
      return errorResponse("event is required", 400);
    }

    const broadcaster = new RealtimeBroadcaster(envAny.OBCF_REALTIME);
    const result = await broadcaster.broadcast({
      channels: body.channels,
      event: body.event,
      data: body.data,
      persistForOffline: body.persistForOffline ?? false,
      metadata: { sentAt: Date.now(), source: "api" },
    });

    if (!result.success) {
      return errorResponse("Failed to broadcast message", 500, {
        details: result.error,
      });
    }

    return jsonResponse({
      success: true,
      channelsCount: body.channels.length,
    });
  }

  if (
    url.pathname === "/api/cloudflare/realtime/stats" &&
    request.method === "GET"
  ) {
    if (!envAny.OBCF_REALTIME) {
      return errorResponse(
        "Realtime is not available in this environment",
        501,
        { code: "CONFIG_ERROR" },
      );
    }

    const broadcaster = new RealtimeBroadcaster(envAny.OBCF_REALTIME);
    const stats = await broadcaster.getStats();
    return jsonResponse(
      stats ?? {
        totalConnections: 0,
        channels: [],
        offlineMessagesQueued: 0,
      },
    );
  }

  return null;
}
