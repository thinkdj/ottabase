import type { CloudflareEnv } from "@ottabase/cf";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { registerConnection } from "@ottabase/ottaorm";
import { errorResponse } from "@ottabase/utils/http-errors";
import { jsonResponse } from "@ottabase/utils/http-response";
import {
  paginatedJsonResponse,
  parsePaginationParams,
} from "@ottabase/utils/pagination";
import { Shortlink } from "../../ottabase/models/Shortlink";
import { readJson } from "../utils";

export async function handleShortlinkRoutes(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const envAny = env as any;

  if (url.pathname === "/api/shortlinks" && request.method === "GET") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    registerConnection("default", createD1Driver(envAny.OBCF_D1));

    const { page, perPage, orderBy, order } = parsePaginationParams(
      url.searchParams,
    );

    const appName = url.searchParams.get("appName");
    const type = url.searchParams.get("type");

    const whereConditions: Record<string, any> = {};
    if (appName) whereConditions.appName = appName;
    if (type) whereConditions.type = type;

    const paginationResult = await Shortlink.paginate(
      page,
      perPage,
      Object.keys(whereConditions).length > 0 ? whereConditions : undefined,
      { orderBy, orderDirection: order },
    );

    return paginatedJsonResponse({
      data: paginationResult.data.map((s) => s.toJson()),
      total: paginationResult.total,
      page: paginationResult.page,
      perPage: paginationResult.perPage,
      path: "/api/shortlinks",
    });
  }

  if (url.pathname === "/api/shortlinks" && request.method === "POST") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    registerConnection("default", createD1Driver(envAny.OBCF_D1));

    const body = await readJson<{
      fullUrl?: string;
      shortCode?: string;
      type?: string;
      appName?: string;
      expiryDate?: string | null;
    }>(request);

    if (!body.fullUrl || !body.shortCode) {
      return errorResponse("fullUrl and shortCode are required", 400);
    }

    const existing = await Shortlink.findByCode(body.shortCode);
    if (existing) {
      return errorResponse("Short code already exists", 409, {
        code: "DUPLICATE_SHORT_CODE",
      });
    }

    try {
      const shortlink = await Shortlink.create({
        fullUrl: body.fullUrl,
        shortCode: body.shortCode,
        type: body.type || "redirect",
        appName: body.appName || "default",
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      });

      return jsonResponse({
        success: true,
        data: shortlink.toJson(),
      });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to create shortlink",
        400,
        { code: "VALIDATION_ERROR" },
      );
    }
  }

  const shortlinkUpdateMatch = url.pathname.match(/^\/api\/shortlinks\/(.+)$/);
  if (shortlinkUpdateMatch && request.method === "PATCH") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    registerConnection("default", createD1Driver(envAny.OBCF_D1));

    const id = shortlinkUpdateMatch[1];
    const body = await readJson<{
      fullUrl?: string;
      shortCode?: string;
      type?: string;
      expiryDate?: string | null;
    }>(request);

    const shortlink = await Shortlink.find(id);
    if (!shortlink) {
      return errorResponse("Shortlink not found", 404);
    }

    if (body.shortCode && body.shortCode !== shortlink.get("shortCode")) {
      const existing = await Shortlink.findByCode(body.shortCode);
      if (existing) {
        return errorResponse("Short code already exists", 409, {
          code: "DUPLICATE_SHORT_CODE",
        });
      }
      shortlink.set("shortCode", body.shortCode);
    }

    if (body.fullUrl) shortlink.set("fullUrl", body.fullUrl);
    if (body.type) shortlink.set("type", body.type);
    if (body.expiryDate !== undefined) {
      shortlink.set(
        "expiryDate",
        body.expiryDate ? new Date(body.expiryDate) : null,
      );
    }

    try {
      await shortlink.save();
      return jsonResponse({
        success: true,
        data: shortlink.toJson(),
      });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to update shortlink",
        400,
        { code: "VALIDATION_ERROR" },
      );
    }
  }

  if (shortlinkUpdateMatch && request.method === "DELETE") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    registerConnection("default", createD1Driver(envAny.OBCF_D1));

    const id = shortlinkUpdateMatch[1];
    const shortlink = await Shortlink.find(id);
    if (!shortlink) {
      return errorResponse("Shortlink not found", 404);
    }

    await Shortlink.delete(id);
    return jsonResponse({
      success: true,
      message: "Shortlink deleted successfully",
    });
  }

  if (url.pathname === "/shortlinks/go") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    const code =
      url.searchParams.get("code") ||
      url.searchParams.get("s") ||
      url.searchParams.get("id");

    if (!code) {
      return errorResponse("Missing shortlink code", 400, {
        hint: "Use /shortlinks/go?code=... or ?s=...",
      });
    }

    registerConnection("default", createD1Driver(envAny.OBCF_D1));

    try {
      const shortlink = await Shortlink.findByCode(code);

      if (!shortlink) {
        return errorResponse("Shortlink not found", 404, {
          code: "LINK_NOT_FOUND",
        });
      }

      if (shortlink.isExpired()) {
        return errorResponse("This shortlink has expired", 410, {
          code: "LINK_EXPIRED",
        });
      }

      shortlink.trackClick().catch((err) => {
        console.error("Failed to track shortlink click:", err);
      });

      return Response.redirect(shortlink.get("fullUrl"), 302);
    } catch (error) {
      console.error("Shortlink explicit redirect error:", error);
      return errorResponse("Failed to process shortlink", 500);
    }
  }

  if (
    envAny.OBCF_D1 &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/@") &&
    url.pathname !== "/" &&
    !/\.[a-zA-Z0-9]+$/.test(url.pathname)
  ) {
    try {
      registerConnection("default", createD1Driver(envAny.OBCF_D1));

      const shortCode = url.pathname.substring(1);
      const shortlink = await Shortlink.findByCode(shortCode);

      if (shortlink) {
        if (shortlink.isExpired()) {
          return errorResponse("This shortlink has expired", 410, {
            code: "LINK_EXPIRED",
          });
        }

        shortlink.trackClick().catch((error) => {
          console.error("Shortlink click tracking error:", error);
        });

        return Response.redirect(shortlink.get("fullUrl"), 302);
      }
    } catch (error) {
      console.error("Shortlink redirect error:", error);
    }
  }

  return null;
}
