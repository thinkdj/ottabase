/**
 * D1 API routes
 * Demonstrates Cloudflare D1 database with OttaORM
 */

import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { registerConnection } from "@ottabase/ottaorm";
import { Todo } from "../../../ottabase/models/Todo";
import type { RouteModule } from "../../types";
import { errorResponse, json, readJson } from "../../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/cloudflare/d1/init",
    handlers: {
      POST: async ({ env }) => {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured. Check wrangler.jsonc", 500);
        }

        // Ensure the app-specific table exists (matches Todo model schema)
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
      },
    },
  },
  {
    path: "/api/cloudflare/d1/todos",
    handlers: {
      GET: async ({ env }) => {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500);
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const todos = await Todo.all({ orderBy: "createdAt", orderDirection: "desc" });
        return json({ todos: todos.map((t) => t.toJson()) });
      },

      POST: async ({ request, env }) => {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500);
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const body = await readJson<{ title?: string }>(request);
        if (!body.title || typeof body.title !== "string") {
          return errorResponse("Title is required and must be a string");
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
      },
    },
  },
  {
    path: "/api/cloudflare/d1/todos/:id",
    handlers: {
      PATCH: async ({ request, env, params }) => {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500);
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const id = params.id;
        if (!id) return errorResponse("Invalid id");

        const body = await readJson<{ completed?: boolean }>(request);
        if (typeof body.completed !== "boolean") {
          return errorResponse("Completed must be a boolean");
        }

        const todo = await Todo.find(id);
        if (!todo) return errorResponse("Todo not found", 404);

        todo.set("completed", body.completed);
        await todo.save();

        return json({
          success: true,
          message: "Todo updated successfully",
          todo: todo.toJson(),
        });
      },

      DELETE: async ({ env, params }) => {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500);
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const id = params.id;
        if (!id) return errorResponse("Invalid id");

        const todo = await Todo.find(id);
        if (!todo) return errorResponse("Todo not found", 404);

        await Todo.delete(id);
        return json({ success: true, message: "Todo deleted successfully" });
      },
    },
  },
];
