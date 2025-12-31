import { createKVClient } from "@ottabase/cf/kv";
import { createQueuesClient } from "@ottabase/cf/queues";
import { createRateLimitingClient } from "@ottabase/cf/rate-limiting";
import { RealtimeBroadcaster, RealtimeActor } from "@ottabase/cf-realtime/server";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { coreMigrations, registerConnection, runMigrations, User, Post } from "@ottabase/ottaorm";
import { appMigrations } from "./ottabase/migrations";
import { Todo } from "./ottabase/models/Todo";

export { RealtimeActor };

function isHtmlRequest(request: Request): boolean {
  const accept = request.headers.get("Accept");
  return !!accept && accept.includes("text/html");
}

function json(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    // @ts-expect-error - ok
    return {};
  }
}

async function simulateRateLimit(env: CloudflareEnv, key: string) {
  if (!env.OBCF_KV) return null;

  const kv = createKVClient({ namespace: env.OBCF_KV as any });
  const rateLimitKey = `ratelimit:${key}`;

  const LIMIT = 10;
  const PERIOD = 60; // seconds

  const result = await kv.getText(rateLimitKey);

  let count = 0;
  let firstRequestTime = Date.now();
  const now = Date.now();

  if (result.success && result.data) {
    try {
      const parsed = JSON.parse(result.data);
      count = parsed.count || 0;
      firstRequestTime = parsed.firstRequestTime || now;
    } catch {
      // ignore
    }
  }

  let elapsed = (now - firstRequestTime) / 1000;
  if (elapsed >= PERIOD) {
    count = 0;
    firstRequestTime = now;
    elapsed = 0;
  }

  count++;
  const isAllowed = count <= LIMIT;
  const remaining = Math.max(0, LIMIT - count);
  const resetAfter = Math.max(1, Math.ceil(PERIOD - elapsed));

  await kv.put(rateLimitKey, JSON.stringify({ count, firstRequestTime }), {
    expirationTtl: PERIOD + 10,
  });

  return {
    success: isAllowed,
    limit: LIMIT,
    remaining,
    resetAfter,
  };
}

async function checkMigrationAuth(request: Request, env: CloudflareEnv): Promise<boolean> {
  const isDev = env.ENVIRONMENT === "development" || !env.ENVIRONMENT;
  if (isDev) return true;

  if (!env.MIGRATION_SECRET) return false;

  let providedSecret: string | null = null;
  const url = new URL(request.url);
  providedSecret = url.searchParams.get("secret");

  if (!providedSecret && request.method === "POST") {
    const body = await readJson<{ secret?: string }>(request);
    providedSecret = body.secret ?? null;
  }

  if (!providedSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      providedSecret = authHeader.substring(7);
    }
  }

  return providedSecret === env.MIGRATION_SECRET;
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, name: "ottabase-template-app-tanstack" });
    }

    // ============================================================
    // Cloudflare demos
    // ============================================================

    // KV: /api/cloudflare/kv
    if (url.pathname === "/api/cloudflare/kv") {
      if (!env.OBCF_KV) {
        return json({ error: "KV namespace binding not configured" }, { status: 500 });
      }

      const kv = createKVClient({ namespace: env.OBCF_KV as any });

      if (request.method === "GET") {
        const key = url.searchParams.get("key");
        if (!key) return json({ error: "Key is required" }, { status: 400 });

        const result = await kv.getText(key);
        if (!result.success) {
          return json(
            { error: "Failed to get value", details: result.error.message },
            { status: 500 },
          );
        }

        return json({ value: result.data });
      }

      if (request.method === "POST") {
        const body = await readJson<{ key?: string; value?: string; ttl?: number | string }>(
          request,
        );
        if (!body.key || !body.value) {
          return json({ error: "Key and value are required" }, { status: 400 });
        }

        const expirationTtl = body.ttl ? parseInt(String(body.ttl), 10) : undefined;
        const result = await kv.put(body.key, body.value, { expirationTtl });
        if (!result.success) {
          return json(
            { error: "Failed to set value", details: result.error.message },
            { status: 500 },
          );
        }
        return json({ success: true });
      }

      if (request.method === "DELETE") {
        const key = url.searchParams.get("key");
        if (!key) return json({ error: "Key is required" }, { status: 400 });

        const result = await kv.delete(key);
        if (!result.success) {
          return json(
            { error: "Failed to delete value", details: result.error.message },
            { status: 500 },
          );
        }
        return json({ success: true });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // R2: /api/cloudflare/r2
    if (url.pathname === "/api/cloudflare/r2") {
      if (!env.OBCF_R2) {
        return json({ error: "R2 bucket binding not configured" }, { status: 500 });
      }

      if (request.method === "GET") {
        if (url.searchParams.get("list") === "true") {
          const listing = await env.OBCF_R2.list({ limit: 100 });
          return json({ objects: listing.objects });
        }

        const key = url.searchParams.get("key");
        if (!key) return json({ error: "key is required" }, { status: 400 });

        const object = await env.OBCF_R2.get(key);
        if (!object) return json({ error: "Object not found" }, { status: 404 });

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
          return json({ error: "key is required" }, { status: 400 });
        }
        if (!(file instanceof File)) {
          return json({ error: "file is required" }, { status: 400 });
        }

        await env.OBCF_R2.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
        });
        return json({ success: true });
      }

      if (request.method === "DELETE") {
        const key = url.searchParams.get("key");
        if (!key) return json({ error: "key is required" }, { status: 400 });
        await env.OBCF_R2.delete(key);
        return json({ success: true });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // D1 demo (raw SQL): /api/cloudflare/d1/*
    if (url.pathname === "/api/cloudflare/d1/init" && request.method === "POST") {
      if (!env.OBCF_D1) {
        return json(
          { error: "D1 database binding not configured. Check wrangler.jsonc" },
          { status: 500 },
        );
      }

      // Ensure the app-specific table exists (matches Todo model schema)
      // Using .batch() instead of .exec() to avoid Wrangler dev mode duration metadata error
      await env.OBCF_D1.batch([
        env.OBCF_D1.prepare(`
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

      // Verify connection using OttaORM
      registerConnection("default", createD1Driver(env.OBCF_D1));
      const count = (await Todo.all()).length;

      return json({
        success: true,
        message: "Database initialized successfully",
        info: `Found ${count} existing todos`,
      });
    }

    if (url.pathname === "/api/cloudflare/d1/todos") {
      if (!env.OBCF_D1) {
        return json({ error: "D1 database binding not configured" }, { status: 500 });
      }

      registerConnection("default", createD1Driver(env.OBCF_D1));

      if (request.method === "GET") {
        const todos = await Todo.all({ orderBy: "createdAt", orderDirection: "desc" });
        return json({ todos: todos.map((t) => t.toJson()) });
      }

      if (request.method === "POST") {
        const body = await readJson<{ title?: string }>(request);
        if (!body.title || typeof body.title !== "string") {
          return json({ error: "Title is required and must be a string" }, { status: 400 });
        }

        const todo = await Todo.create({
          id: crypto.randomUUID(),
          title: body.title.trim(),
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return json({
          success: true,
          message: "Todo created successfully",
          todo: todo.toJson(),
        });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const d1TodoMatch = url.pathname.match(/^\/api\/cloudflare\/d1\/todos\/(.+)$/);
    if (d1TodoMatch) {
      if (!env.OBCF_D1) {
        return json({ error: "D1 database binding not configured" }, { status: 500 });
      }

      registerConnection("default", createD1Driver(env.OBCF_D1));

      const id = d1TodoMatch[1];
      if (!id) return json({ error: "Invalid id" }, { status: 400 });

      if (request.method === "PATCH") {
        const body = await readJson<{ completed?: boolean }>(request);
        if (typeof body.completed !== "boolean") {
          return json({ error: "Completed must be a boolean" }, { status: 400 });
        }

        const todo = await Todo.find(id);
        if (!todo) return json({ error: "Todo not found" }, { status: 404 });

        todo.set("completed", body.completed);
        await todo.save();

        return json({
          success: true,
          message: "Todo updated successfully",
          todo: todo.toJson(),
        });
      }

      if (request.method === "DELETE") {
        const todo = await Todo.find(id);
        if (!todo) return json({ error: "Todo not found" }, { status: 404 });
        
        // Use static delete method instead of instance destroy
        await Todo.delete(id);

        return json({ success: true, message: "Todo deleted successfully" });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Queues: /api/cloudflare/queues
    if (url.pathname === "/api/cloudflare/queues") {
      if (request.method === "POST") {
        if (!env.OBCF_QUEUE) {
          return json({ error: "Queue binding not configured" }, { status: 500 });
        }

        const body = await readJson<{ message?: unknown; batch?: unknown[] }>(request);
        const queue = createQueuesClient({ queue: env.OBCF_QUEUE });

        if (Array.isArray(body.batch)) {
          const messages = body.batch.map((msg) => ({ body: msg }));
          const result = await queue.sendBatch(messages);
          if (!result.success) {
            return json(
              { error: "Failed to send batch", details: result.error.message },
              { status: 500 },
            );
          }

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

        if (body.message) {
          const result = await queue.send(body.message);
          if (!result.success) {
            return json(
              { error: "Failed to send message", details: result.error.message },
              { status: 500 },
            );
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

        return json({ error: "Either message or batch is required" }, { status: 400 });
      }

      if (request.method === "GET") {
        if (!env.OBCF_KV) {
          return json({ error: "KV binding not configured" }, { status: 500 });
        }

        const kv = createKVClient({ namespace: env.OBCF_KV as any });
        const listResult = await kv.list({ prefix: "queue:message:" });
        if (!listResult.success) {
          return json({ error: "Failed to list messages" }, { status: 500 });
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

        return json({ messages });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Rate limiting: /api/cloudflare/rate-limiting
    if (url.pathname === "/api/cloudflare/rate-limiting" && request.method === "POST") {
      const body = await readJson<{ key?: string }>(request);
      if (!body.key) return json({ error: "Key is required" }, { status: 400 });

      let rateLimitData:
        | { success: boolean; limit: number; remaining: number; resetAfter: number }
        | null = null;

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
    }

    // Realtime: /api/cloudflare/realtime/*
    if (url.pathname === "/api/cloudflare/realtime/ws") {
      if (!env.OBCF_REALTIME) {
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

      if (request.headers.get("Upgrade") !== "websocket") {
        return json({ error: "Expected WebSocket upgrade" }, { status: 426 });
      }

      const id = env.OBCF_REALTIME.idFromName("global");
      const stub = env.OBCF_REALTIME.get(id);
      return stub.fetch(request as any) as unknown as Response;
    }

    if (url.pathname === "/api/cloudflare/realtime/broadcast" && request.method === "POST") {
      if (!env.OBCF_REALTIME) {
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

      const body = await readJson<{
        channels?: string[];
        event?: string;
        data?: unknown;
        persistForOffline?: boolean;
      }>(request);

      if (!body.channels || !Array.isArray(body.channels) || body.channels.length === 0) {
        return json({ error: "channels array is required" }, { status: 400 });
      }
      if (!body.event) {
        return json({ error: "event is required" }, { status: 400 });
      }

      const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
      const result = await broadcaster.broadcast({
        channels: body.channels,
        event: body.event,
        data: body.data,
        persistForOffline: body.persistForOffline ?? false,
        metadata: { sentAt: Date.now(), source: "api" },
      });

      if (!result.success) {
        return json({ error: "Failed to broadcast message", details: result.error }, { status: 500 });
      }

      return json({ success: true, channelsCount: body.channels.length });
    }

    if (url.pathname === "/api/cloudflare/realtime/stats" && request.method === "GET") {
      if (!env.OBCF_REALTIME) {
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

      const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
      const stats = await broadcaster.getStats();
      return json(
        stats ?? {
          totalConnections: 0,
          channels: [],
          offlineMessagesQueued: 0,
        },
      );
    }

    // ============================================================
    // OttaORM demos
    // ============================================================

    if (url.pathname === "/api/ottaorm/init" && (request.method === "GET" || request.method === "POST")) {
      if (!env.OBCF_D1) {
        return json({ error: "D1 database not configured" }, { status: 500 });
      }

      const isAuthorized = await checkMigrationAuth(request, env);
      if (!isAuthorized) {
        return json(
          { error: "Unauthorized - MIGRATION_SECRET required in production" },
          { status: 401 },
        );
      }

      const driver = createD1Driver(env.OBCF_D1);
      const result = await runMigrations(driver, [...coreMigrations, ...appMigrations]);
      return json({
        success: true,
        message: "Database migrations completed successfully",
        executed: result.executed,
        skipped: result.skipped,
      });
    }

    if (url.pathname === "/api/ottaorm/users") {
      if (!env.OBCF_D1) return json({ error: "D1 database not configured" }, { status: 500 });
      registerConnection("default", createD1Driver(env.OBCF_D1));

      if (request.method === "GET") {
        const users = await User.all({ orderBy: "createdAt", orderDirection: "desc" });
        return json({ users: users.map((u) => u.toJson()) });
      }

      if (request.method === "POST") {
        const body = await readJson<{ name?: string; email?: string }>(request);
        if (!body.email) return json({ error: "Email is required" }, { status: 400 });

        const user = await User.create({
          id: crypto.randomUUID(),
          name: body.name || null,
          email: body.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return json({ user: user.toJson() });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const userMatch = url.pathname.match(/^\/api\/ottaorm\/users\/(.+)$/);
    if (userMatch) {
      if (!env.OBCF_D1) return json({ error: "D1 database not configured" }, { status: 500 });
      registerConnection("default", createD1Driver(env.OBCF_D1));
      const id = userMatch[1];

      if (request.method === "GET") {
        const user = await User.find(id);
        if (!user) return json({ error: "User not found" }, { status: 404 });
        return json({ user: user.toJson() });
      }

      if (request.method === "DELETE") {
        const deleted = await User.delete(id);
        if (!deleted) return json({ error: "User not found" }, { status: 404 });
        return json({ success: true, message: "User deleted successfully" });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    if (url.pathname === "/api/ottaorm/posts") {
      if (!env.OBCF_D1) return json({ error: "D1 database not configured" }, { status: 500 });
      registerConnection("default", createD1Driver(env.OBCF_D1));

      if (request.method === "GET") {
        const posts = await Post.all({ orderBy: "createdAt", orderDirection: "desc" });
        return json({ posts: posts.map((p) => p.toJson()) });
      }

      if (request.method === "POST") {
        const body = await readJson<{ title?: string; content?: string; authorId?: string }>(request);
        if (!body.title) return json({ error: "Title is required" }, { status: 400 });
        if (!body.authorId) return json({ error: "authorId is required" }, { status: 400 });

        const post = await Post.create({
          id: crypto.randomUUID(),
          title: body.title,
          slug: Post.generateSlug(body.title),
          content: body.content || null,
          published: false,
          authorId: body.authorId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return json({ post: post.toJson() });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const postMatch = url.pathname.match(/^\/api\/ottaorm\/posts\/(.+)$/);
    if (postMatch) {
      if (!env.OBCF_D1) return json({ error: "D1 database not configured" }, { status: 500 });
      registerConnection("default", createD1Driver(env.OBCF_D1));
      const id = postMatch[1];

      if (request.method === "GET") {
        const post = await Post.find(id);
        if (!post) return json({ error: "Post not found" }, { status: 404 });
        return json({ post: post.toJson() });
      }

      if (request.method === "DELETE") {
        const deleted = await Post.delete(id);
        if (!deleted) return json({ error: "Post not found" }, { status: 404 });
        return json({ success: true, message: "Post deleted successfully" });
      }

      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Serve built assets. If the asset isn't found and the client is requesting HTML,
    // fall back to `index.html` to support client-side routing.
    const response = await env.OBCF_ASSETS.fetch(request);
    if (response.status !== 404 || !isHtmlRequest(request)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    return env.OBCF_ASSETS.fetch(new Request(indexUrl.toString(), request));
  },
};
