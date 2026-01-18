import { handleAuthRequest } from "@ottabase/auth/backend";
import { getLoginConfig } from "@ottabase/auth/components";
import type { CloudflareEnv } from "@ottabase/cf";
import { jsonResponse } from "@ottabase/utils/http-response";
import { withCorsHeaders } from "../cors";

export async function handleAuthRoutes(
  request: Request,
  env: CloudflareEnv,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/api/auth/config" && request.method === "GET") {
    const config = getLoginConfig(env as any);
    const response = jsonResponse(
      {
        ...config,
        authSecretConfigured: !!env.AUTH_SECRET,
      },
      200,
    );
    return withCorsHeaders(response, corsHeaders);
  }

  if (url.pathname.startsWith("/api/auth/")) {
    const response = await handleAuthRequest(request, env as any);
    return withCorsHeaders(response, corsHeaders);
  }

  return null;
}
