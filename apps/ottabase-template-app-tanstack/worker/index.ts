import type { CloudflareEnv } from "@ottabase/cf";
import { RealtimeActor } from "@ottabase/cf-realtime/server";
import { errorResponse, ServiceError } from "@ottabase/utils/http-errors";
import { jsonResponse } from "@ottabase/utils/http-response";
import { getCorsHeaders, handleOptions, withCorsHeaders } from "./cors";
import { handleAssets } from "./handlers/assets";
import { handleAuthRoutes } from "./handlers/auth";
import { handleCloudflareRoutes } from "./handlers/cloudflare";
import { handleDemoRoutes } from "./handlers/demo";
import { handleEmailTest } from "./handlers/email";
import { handleOttaOrmRoutes } from "./handlers/ottaorm";
import { handleReferralRoutes } from "./handlers/referrals";
import { handleShortlinkRoutes } from "./handlers/shortlinks";
import { handleUploadRoutes } from "./handlers/upload";

export { RealtimeActor };

async function handleRoute(
  request: Request,
  env: CloudflareEnv,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    return jsonResponse({
      ok: true,
      name: "ottabase-template-app-tanstack",
      timestamp: Date.now(),
    });
  }

  const handlers = [
    () => handleAuthRoutes(request, env, corsHeaders),
    () => handleEmailTest(request, env),
    () => handleOttaOrmRoutes(request, env),
    () => handleShortlinkRoutes(request, env),
    () => handleReferralRoutes(request, env),
    () => handleDemoRoutes(request),
    () => handleCloudflareRoutes(request, env),
    () => handleUploadRoutes(request, env),
  ];

  for (const handler of handlers) {
    const response = await handler();
    if (response) {
      if (url.pathname.startsWith("/api/")) {
        return withCorsHeaders(response, corsHeaders);
      }
      return response;
    }
  }

  return handleAssets(request, env);
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    try {
      const optionsResponse = handleOptions(request);
      if (optionsResponse) return optionsResponse;

      const corsHeaders = getCorsHeaders(request);
      const response = await handleRoute(request, env, corsHeaders);
      return response;
    } catch (err) {
      console.error("Worker unhandled error:", err);

      if (err instanceof ServiceError) {
        return errorResponse(err.message, err.status, err.toApiResponse());
      }

      return errorResponse(
        err instanceof Error ? err.message : "An unexpected error occurred",
        500,
        { code: "INTERNAL_SERVER_ERROR" },
      );
    }
  },
};
