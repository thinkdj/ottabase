import type { CloudflareEnv } from "@ottabase/cf";
import { createR2Client } from "@ottabase/cf/r2";
import {
  uploadFileToCloudflareImages,
  uploadFileToR2,
} from "@ottabase/ottaupload/server";
import { errorResponse } from "@ottabase/utils/http-errors";
import { jsonResponse } from "@ottabase/utils/http-response";

export async function handleUploadRoutes(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const envAny = env as any;

  if (url.pathname === "/api/upload") {
    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const provider = (formData.get("provider") as string) || "r2";

        if (!(file instanceof File)) {
          return errorResponse("file is required", 400);
        }

        if (provider === "cloudflare-images") {
          const accountId = envAny.CLOUDFLARE_ACCOUNT_ID as string;
          const apiToken = envAny.CLOUDFLARE_API_TOKEN as string;

          if (!accountId || !apiToken) {
            return errorResponse(
              "Cloudflare Images not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN",
              500,
              { code: "CONFIG_ERROR" },
            );
          }

          const result = await uploadFileToCloudflareImages(
            file,
            {
              accountId,
              apiToken,
            },
            {
              maxFileSize: 10 * 1024 * 1024,
            },
          );

          if (result.success) {
            return jsonResponse({
              success: true,
              url: result.url,
              key: result.key,
              provider: "cloudflare-images",
            });
          }

          const errorCode = (result as any).code;
          const status = errorCode === "CONFIG_ERROR" ? 500 : 400;
          return errorResponse(
            result.error || "Upload failed",
            status,
            errorCode ? { code: errorCode } : undefined,
          );
        }

        if (!envAny.OBCF_R2) {
          return errorResponse("R2 bucket binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        const r2Client = createR2Client({ bucket: envAny.OBCF_R2 });
        const result = await uploadFileToR2(file, r2Client, {
          maxFileSize: 50 * 1024 * 1024,
        });

        if (result.success) {
          return jsonResponse({
            success: true,
            url: result.url,
            key: result.key,
            provider: "r2",
          });
        }

        return errorResponse(result.error || "Upload failed", 400);
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : "Upload failed",
          500,
        );
      }
    }

    return errorResponse("Method not allowed", 405, {
      code: "METHOD_NOT_ALLOWED",
    });
  }

  if (url.pathname.startsWith("/api/upload/file/")) {
    if (!envAny.OBCF_R2) {
      return errorResponse("R2 bucket binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    const key = url.pathname.replace("/api/upload/file/", "");
    if (!key) {
      return errorResponse("key is required", 400);
    }

    const object = await envAny.OBCF_R2.get(key);
    if (!object) {
      return errorResponse("File not found", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    return new Response(object.body, { headers });
  }

  return null;
}
