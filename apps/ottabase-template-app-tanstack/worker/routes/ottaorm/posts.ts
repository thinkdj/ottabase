/**
 * OttaORM Posts API routes
 */

import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { Post, registerConnection } from "@ottabase/ottaorm";
import type { RouteModule } from "../../types";
import { errorResponse, json, readJson } from "../../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/ottaorm/posts",
    handlers: {
      GET: async ({ env }) => {
        if (!env.OBCF_D1) return errorResponse("D1 database not configured", 500);

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const posts = await Post.all({ orderBy: "createdAt", orderDirection: "desc" });
        return json({ posts: posts.map((p) => p.toJson()) });
      },

      POST: async ({ request, env }) => {
        if (!env.OBCF_D1) return errorResponse("D1 database not configured", 500);

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const body = await readJson<{ title?: string; content?: string; authorId?: string }>(
          request,
        );
        if (!body.title) return errorResponse("Title is required");
        if (!body.authorId) return errorResponse("authorId is required");

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
      },
    },
  },
  {
    path: "/api/ottaorm/posts/:id",
    handlers: {
      GET: async ({ env, params }) => {
        if (!env.OBCF_D1) return errorResponse("D1 database not configured", 500);

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const post = await Post.find(params.id);
        if (!post) return errorResponse("Post not found", 404);
        return json({ post: post.toJson() });
      },

      DELETE: async ({ env, params }) => {
        if (!env.OBCF_D1) return errorResponse("D1 database not configured", 500);

        registerConnection("default", createD1Driver(env.OBCF_D1));
        const deleted = await Post.delete(params.id);
        if (!deleted) return errorResponse("Post not found", 404);
        return json({ success: true, message: "Post deleted successfully" });
      },
    },
  },
];
