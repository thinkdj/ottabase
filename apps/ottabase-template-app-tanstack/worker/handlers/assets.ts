import type { CloudflareEnv } from "@ottabase/cf";
import { errorResponse } from "@ottabase/utils/http-errors";
import { isHtmlRequest } from "../utils";

const SPA_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export async function handleAssets(
  request: Request,
  env: CloudflareEnv,
): Promise<Response> {
  const envAny = env as any;
  if (!envAny.OBCF_ASSETS) {
    return errorResponse("Assets binding not configured", 500, {
      code: "CONFIG_ERROR",
    });
  }

  const response = await envAny.OBCF_ASSETS.fetch(request);

  if (isHtmlRequest(request)) {
    if (response.status === 404 || SPA_REDIRECT_STATUSES.has(response.status)) {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/index.html";
      return envAny.OBCF_ASSETS.fetch(
        new Request(indexUrl.toString(), request),
      );
    }
  }

  return response;
}
