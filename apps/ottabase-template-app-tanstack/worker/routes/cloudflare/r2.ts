/**
 * R2 API routes
 * Demonstrates Cloudflare R2 object storage operations
 */

import type { RouteModule } from "../../types";
import { errorResponse, json } from "../../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/cloudflare/r2",
    handlers: {
      GET: async ({ request, env, url }) => {
        if (!env.OBCF_R2) {
          return errorResponse("R2 bucket binding not configured", 500);
        }

        // List objects
        if (url.searchParams.get("list") === "true") {
          const listing = await env.OBCF_R2.list({ limit: 100 });
          return json({ objects: listing.objects });
        }

        // Get single object
        const key = url.searchParams.get("key");
        if (!key) return errorResponse("key is required");

        const object = await env.OBCF_R2.get(key);
        if (!object) return errorResponse("Object not found", 404);

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Content-Disposition", `attachment; filename="${key}"`);

        return new Response(object.body, { headers });
      },

      POST: async ({ request, env }) => {
        if (!env.OBCF_R2) {
          return errorResponse("R2 bucket binding not configured", 500);
        }

        const formData = await request.formData();
        const file = formData.get("file");
        const key = formData.get("key");

        if (!key || typeof key !== "string") {
          return errorResponse("key is required");
        }
        if (!(file instanceof File)) {
          return errorResponse("file is required");
        }

        await env.OBCF_R2.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
        });
        return json({ success: true });
      },

      DELETE: async ({ env, url }) => {
        if (!env.OBCF_R2) {
          return errorResponse("R2 bucket binding not configured", 500);
        }

        const key = url.searchParams.get("key");
        if (!key) return errorResponse("key is required");

        await env.OBCF_R2.delete(key);
        return json({ success: true });
      },
    },
  },
];
