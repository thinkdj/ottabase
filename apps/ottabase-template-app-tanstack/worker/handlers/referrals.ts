import type { CloudflareEnv } from "@ottabase/cf";
import { User } from "@ottabase/ottaorm";
import { errorResponse } from "@ottabase/utils/http-errors";
import { jsonResponse } from "@ottabase/utils/http-response";
import {
  paginatedJsonResponse,
  parsePaginationParams,
} from "@ottabase/utils/pagination";
import { ReferralTracking } from "../../ottabase/models/ReferralTracking";
import { readJson } from "../utils";

export async function handleReferralRoutes(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const envAny = env as any;

  if (url.pathname === "/api/referrals/track" && request.method === "POST") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    const body = await readJson<{
      referralCode?: string;
      referer?: string;
      meta?: Record<string, any>;
    }>(request);

    if (!body.referralCode) {
      return errorResponse("referralCode is required", 400);
    }

    const referrer = await User.findByReferralUsername(body.referralCode);

    if (!referrer) {
      return errorResponse("Invalid referral code", 404, {
        code: "INVALID_REFERRAL_CODE",
      });
    }

    function isValidIpAddress(rawValue: string | null): string {
      if (!rawValue) {
        return "unknown";
      }

      const candidate = rawValue.split(",")[0]!.trim();
      if (!candidate) {
        return "unknown";
      }

      const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^[0-9a-fA-F:]+$/;

      if (ipv4Regex.test(candidate)) {
        const parts = candidate.split(".");
        const validOctets = parts.every((part) => {
          const n = Number(part);
          return Number.isInteger(n) && n >= 0 && n <= 255;
        });
        if (!validOctets) {
          return "unknown";
        }
        return candidate;
      }

      if (ipv6Regex.test(candidate) && candidate.includes(":")) {
        return candidate;
      }

      return "unknown";
    }

    function getClientIpAddress(request: Request): string {
      const headerCandidates = [
        "CF-Connecting-IP",
        "X-Forwarded-For",
        "X-Real-IP",
      ];

      for (const header of headerCandidates) {
        const headerValue = request.headers.get(header);
        const validIp = isValidIpAddress(headerValue);
        if (validIp !== "unknown") {
          return validIp;
        }
      }

      return "unknown";
    }

    const ipAddress = getClientIpAddress(request);
    const userAgent = request.headers.get("User-Agent") || "unknown";

    const tracking = await ReferralTracking.create({
      userId: referrer.get("id"),
      referralCode: body.referralCode,
      status: "pending",
      ipAddress,
      userAgent,
      referer: body.referer || request.headers.get("Referer") || null,
      meta: body.meta || {},
    });

    return jsonResponse({
      success: true,
      tracking: tracking.toJson(),
    });
  }

  if (url.pathname === "/api/referrals/stats" && request.method === "GET") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    const userId = url.searchParams.get("userId");

    if (!userId) {
      return errorResponse("userId is required", 400);
    }

    const stats = await ReferralTracking.getStats(userId);
    return jsonResponse(stats);
  }

  if (url.pathname === "/api/referrals/user" && request.method === "GET") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    const userId = url.searchParams.get("userId");

    if (!userId) {
      return errorResponse("userId is required", 400);
    }

    const user = await User.find(userId);

    if (!user) {
      return errorResponse("User not found", 404);
    }

    const stats = await ReferralTracking.getStats(userId);
    const trackingRecords = await ReferralTracking.forUser(userId, {
      limit: 100,
    });

    return jsonResponse({
      user: {
        id: user.get("id"),
        name: user.get("name"),
        email: user.get("email"),
        referralUsername: user.get("referralUsername"),
        referredById: user.get("referredById"),
      },
      stats,
      tracking: trackingRecords.map((t) => t.toJson()),
    });
  }

  if (url.pathname === "/api/referrals/username" && request.method === "PUT") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    const body = await readJson<{
      userId?: string;
      referralUsername?: string;
    }>(request);

    if (!body.userId || !body.referralUsername) {
      return errorResponse("userId and referralUsername are required", 400);
    }

    const { validateReferralUsername } = await import("@ottabase/referrals");
    const validation = validateReferralUsername(body.referralUsername);

    if (!validation.valid) {
      return errorResponse(validation.error || "Invalid username", 400, {
        code: "INVALID_USERNAME",
      });
    }

    const existing = await User.findByReferralUsername(body.referralUsername);
    if (existing && existing.get("id") !== body.userId) {
      return errorResponse("Username already taken", 400, {
        code: "USERNAME_TAKEN",
      });
    }

    const user = await User.find(body.userId);
    if (!user) {
      return errorResponse("User not found", 404);
    }

    user.set("referralUsername", body.referralUsername);
    await user.save();

    return jsonResponse({
      success: true,
      user: user.toJson(),
    });
  }

  if (url.pathname === "/api/referrals/tracking" && request.method === "GET") {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database binding not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    const userId = url.searchParams.get("userId");

    if (!userId) {
      return errorResponse("userId is required", 400);
    }

    const { page, perPage } = parsePaginationParams(url.searchParams);
    const status = url.searchParams.get("status") as
      | "pending"
      | "completed"
      | "invalid"
      | null;

    const offset = (page - 1) * perPage;
    const trackingRecords = await ReferralTracking.forUser(userId, {
      status: status || undefined,
      limit: perPage,
      offset,
    });

    const allRecords = await ReferralTracking.forUser(userId, {
      status: status || undefined,
    });

    return paginatedJsonResponse({
      data: trackingRecords.map((t) => t.toJson()),
      total: allRecords.length,
      page,
      perPage,
      path: "/api/referrals/tracking",
    });
  }

  return null;
}
