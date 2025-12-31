/**
 * OttaORM Users API routes
 */

import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { registerConnection, User } from "@ottabase/ottaorm";
import type { RouteModule } from "../../types";
import { errorResponse, json, readJson } from "../../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/ottaorm/users",
    handlers: {
      GET: async ({ env }) => {
        if (!env.OBCF_D1) return errorResponse("D1 database not configured", 500);

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const users = await User.all({ orderBy: "createdAt", orderDirection: "desc" });
        return json({ users: users.map((u) => u.toJson()) });
      },

      POST: async ({ request, env }) => {
        if (!env.OBCF_D1) return errorResponse("D1 database not configured", 500);

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const body = await readJson<{ name?: string; email?: string }>(request);
        if (!body.email) return errorResponse("Email is required");

        const user = await User.create({
          id: crypto.randomUUID(),
          name: body.name || null,
          email: body.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return json({ user: user.toJson() });
      },
    },
  },
  {
    path: "/api/ottaorm/users/:id",
    handlers: {
      GET: async ({ env, params }) => {
        if (!env.OBCF_D1) return errorResponse("D1 database not configured", 500);

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const user = await User.find(params.id);
        if (!user) return errorResponse("User not found", 404);
        return json({ user: user.toJson() });
      },

      DELETE: async ({ env, params }) => {
        if (!env.OBCF_D1) return errorResponse("D1 database not configured", 500);

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const deleted = await User.delete(params.id);
        if (!deleted) return errorResponse("User not found", 404);
        return json({ success: true, message: "User deleted successfully" });
      },
    },
  },
];
