import { handleAuthRequest } from "@ottabase/auth/backend";
import {
  RealtimeActor,
  RealtimeBroadcaster,
} from "@ottabase/cf-realtime/server";
import { createImagesClient } from "@ottabase/cf/images";
import { createKVClient } from "@ottabase/cf/kv";
import { createQueuesClient } from "@ottabase/cf/queues";
import { createR2Client } from "@ottabase/cf/r2";
import { createRateLimitingClient } from "@ottabase/cf/rate-limiting";
import { createD1Driver } from "@ottabase/db/drizzle-d1";
import {
  Post,
  Tag,
  User,
  autoInit,
  handleCrud,
  parseCrudRequest,
  registerConnection,
  registerModels,
} from "@ottabase/ottaorm";
import {
  uploadFileToCloudflareImages,
  uploadFileToR2,
} from "@ottabase/ottaupload/server";
import { ServiceError, errorResponse } from "@ottabase/utils/http-errors";
import { jsonResponse } from "@ottabase/utils/http-response";
import {
  paginatedJsonResponse,
  parsePaginationParams,
} from "@ottabase/utils/pagination";
import { getAllSchemas } from "./ottabase/db/schemas-helper";
import { appMigrations } from "./ottabase/migrations";
import { ReferralTracking } from "./ottabase/models/ReferralTracking";
import { Shortlink } from "./ottabase/models/Shortlink";
import { Todo } from "./ottabase/models/Todo";
import { processReferralAttribution } from "./ottabase/helpers/referral-attribution";

export { RealtimeActor };

const SPA_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function isHtmlRequest(request: Request): boolean {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // If the path has a file extension, it's not an HTML request
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return false;
  }

  // For routes without extensions, check the Accept header as fallback
  const accept = request.headers.get("Accept");
  return !!accept && accept.includes("text/html");
}

async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    // @ts-expect-error - ok
    return {};
  }
}

async function simulateRateLimit(env: CloudflareEnv, key: string) {
  if (!env.OBCF_KV) return null;

  const kv = createKVClient({ namespace: env.OBCF_KV as any });
  const rateLimitKey = `ratelimit:${key}`;

  const LIMIT = 10;
  const PERIOD = 60; // seconds

  const result = await kv.getText(rateLimitKey);

  let count = 0;
  let firstRequestTime = Date.now();
  const now = Date.now();

  if (result.success && result.data) {
    try {
      const parsed = JSON.parse(result.data);
      count = parsed.count || 0;
      firstRequestTime = parsed.firstRequestTime || now;
    } catch {
      // ignore
    }
  }

  let elapsed = (now - firstRequestTime) / 1000;
  if (elapsed >= PERIOD) {
    count = 0;
    firstRequestTime = now;
    elapsed = 0;
  }

  count++;
  const isAllowed = count <= LIMIT;
  const remaining = Math.max(0, LIMIT - count);
  const resetAfter = Math.max(1, Math.ceil(PERIOD - elapsed));

  await kv.put(rateLimitKey, JSON.stringify({ count, firstRequestTime }), {
    expirationTtl: PERIOD + 10,
  });

  return {
    success: isAllowed,
    limit: LIMIT,
    remaining,
    resetAfter,
  };
}

async function checkMigrationAuth(
  request: Request,
  env: CloudflareEnv,
): Promise<boolean> {
  const isDev = env.ENVIRONMENT === "development" || !env.ENVIRONMENT;
  if (isDev) return true;

  if (!env.MIGRATION_SECRET) return false;

  let providedSecret: string | null = null;
  const url = new URL(request.url);
  providedSecret = url.searchParams.get("secret");

  if (!providedSecret && request.method === "POST") {
    const body = await readJson<{ secret?: string }>(request);
    providedSecret = body.secret ?? null;
  }

  if (!providedSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      providedSecret = authHeader.substring(7);
    }
  }

  return providedSecret === env.MIGRATION_SECRET;
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/health") {
        return Response.json({
          ok: true,
          name: "ottabase-template-app-tanstack",
          timestamp: Date.now(),
        });
      }

      // ============================================================
      // Generic OttaORM CRUD API
      // ============================================================
      // Handles all registered models via /api/ottaorm/{model}/{id?}
      // GET    /api/ottaorm/shortlinks              - List all (paginated)
      // GET    /api/ottaorm/shortlinks/123          - Get by ID
      // POST   /api/ottaorm/shortlinks              - Create
      // PATCH  /api/ottaorm/shortlinks/123          - Update
      // DELETE /api/ottaorm/shortlinks/123          - Delete
      // Query params: page, per_page, sort, order, where (JSON)
      // ============================================================

      if (url.pathname.startsWith("/api/ottaorm/")) {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        // Initialize database connection and register models
        registerConnection("default", createD1Driver(env.OBCF_D1));
        registerModels([Shortlink, Todo, User, Post, Tag, ReferralTracking]);

        // Parse the request into a CrudRequest
        const crudRequest = await parseCrudRequest(
          request,
          url,
          "/api/ottaorm",
        );

        if (!crudRequest) {
          return errorResponse("Invalid CRUD request", 400, {
            code: "INVALID_REQUEST",
            hint: "Use /api/ottaorm/{model}/{id?} format",
          });
        }

        // Handle the CRUD operation
        const result = await handleCrud(crudRequest);

        // Return response based on result
        if (!result.success) {
          return errorResponse(result.error || "Unknown error", result.status, {
            code: result.code,
            details: result.details,
            hint: result.hint,
            messages: result.messages,
            fieldErrors: result.fieldErrors,
          });
        }

        return jsonResponse(result.data, result.status);
      }

      // ============================================================
      // Shortlink Management (Legacy - use /api/ottaorm/shortlinks instead)
      // ============================================================

      // List all shortlinks (paginated)
      if (url.pathname === "/api/shortlinks" && request.method === "GET") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        // Parse pagination params from query string (defaults applied automatically)
        const { page, perPage, orderBy, order } = parsePaginationParams(
          url.searchParams,
        );

        // Optional filters
        const appName = url.searchParams.get("appName");
        const type = url.searchParams.get("type");

        // Build where conditions
        const whereConditions: Record<string, any> = {};
        if (appName) whereConditions.appName = appName;
        if (type) whereConditions.type = type;

        // Use OttaORM's paginate method
        const paginationResult = await Shortlink.paginate(
          page,
          perPage,
          Object.keys(whereConditions).length > 0 ? whereConditions : undefined,
          { orderBy, orderDirection: order },
        );

        // Return paginated response
        return paginatedJsonResponse({
          data: paginationResult.data.map((s) => s.toJson()),
          total: paginationResult.total,
          page: paginationResult.page,
          perPage: paginationResult.perPage,
          path: "/api/shortlinks",
        });
      }

      // Create shortlink
      if (url.pathname === "/api/shortlinks" && request.method === "POST") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

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

        // Check if shortCode already exists
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
            error instanceof Error
              ? error.message
              : "Failed to create shortlink",
            400,
            { code: "VALIDATION_ERROR" },
          );
        }
      }

      // Update shortlink
      const shortlinkUpdateMatch = url.pathname.match(
        /^\/api\/shortlinks\/(.+)$/,
      );
      if (shortlinkUpdateMatch && request.method === "PATCH") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

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

        // If updating shortCode, check for duplicates
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
            error instanceof Error
              ? error.message
              : "Failed to update shortlink",
            400,
            { code: "VALIDATION_ERROR" },
          );
        }
      }

      // Delete shortlink
      if (shortlinkUpdateMatch && request.method === "DELETE") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

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

      // ============================================================
      // Referral System API
      // ============================================================

      // Track referral click
      if (url.pathname === "/api/referrals/track" && request.method === "POST") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        const body = await readJson<{
          referralCode?: string;
          referer?: string;
          meta?: Record<string, any>;
        }>(request);

        if (!body.referralCode) {
          return errorResponse("referralCode is required", 400);
        }

        // Find the user by referral username
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

          // Some headers (like X-Forwarded-For) can contain multiple IPs.
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
          // NOTE: IP addresses from headers are not trustworthy and must not be
          // used for authentication, authorization, or other security decisions.
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

        // Extract IP and user agent
        const ipAddress = getClientIpAddress(request);
        const userAgent = request.headers.get("User-Agent") || "unknown";

        // Create tracking record
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

      // Get referral stats
      if (url.pathname === "/api/referrals/stats" && request.method === "GET") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        // TODO: Get userId from session
        const userId = url.searchParams.get("userId");

        if (!userId) {
          return errorResponse("userId is required", 400);
        }

        const stats = await ReferralTracking.getStats(userId);

        return jsonResponse(stats);
      }

      // Get user referral data
      if (url.pathname === "/api/referrals/user" && request.method === "GET") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        // TODO: Get userId from session
        const userId = url.searchParams.get("userId");

        if (!userId) {
          return errorResponse("userId is required", 400);
        }

        const user = await User.find(userId);

        if (!user) {
          return errorResponse("User not found", 404);
        }

        const stats = await ReferralTracking.getStats(userId);
        const trackingRecords = await ReferralTracking.forUser(userId, { limit: 100 });

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

      // Update referral username
      if (url.pathname === "/api/referrals/username" && request.method === "PUT") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        const body = await readJson<{
          userId?: string;
          referralUsername?: string;
        }>(request);

        // TODO: Get userId from session instead
        if (!body.userId || !body.referralUsername) {
          return errorResponse("userId and referralUsername are required", 400);
        }

        // Validate username format
        const { validateReferralUsername } = await import("@ottabase/referrals");
        const validation = validateReferralUsername(body.referralUsername);

        if (!validation.valid) {
          return errorResponse(validation.error || "Invalid username", 400, {
            code: "INVALID_USERNAME",
          });
        }

        // Check if username is already taken
        const existing = await User.findByReferralUsername(body.referralUsername);
        if (existing && existing.get("id") !== body.userId) {
          return errorResponse("Username already taken", 400, {
            code: "USERNAME_TAKEN",
          });
        }

        // Update user
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

      // List tracking records (with filters and pagination)
      if (url.pathname === "/api/referrals/tracking" && request.method === "GET") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        // TODO: Get userId from session
        const userId = url.searchParams.get("userId");

        if (!userId) {
          return errorResponse("userId is required", 400);
        }

        const { page, perPage } = parsePaginationParams(url.searchParams);
        const status = url.searchParams.get("status") as "pending" | "completed" | "invalid" | null;

        const offset = (page - 1) * perPage;
        const trackingRecords = await ReferralTracking.forUser(userId, {
          status: status || undefined,
          limit: perPage,
          offset,
        });

        // Get total count
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

      // ============================================================
      // Custom Registration with Referral Attribution
      // ============================================================

      // This is a demo endpoint showing how to handle registration with referral attribution
      // In production, you'd integrate this logic into your Auth.js callbacks
      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        const body = await readJson<{
          email?: string;
          password?: string;
          name?: string;
          referralCode?: string;
        }>(request);

        if (!body.email || !body.password) {
          return errorResponse("email and password are required", 400);
        }

        try {
          // TODO: In production, you would:
          // 1. Hash the password
          // 2. Validate email uniqueness
          // 3. Create user in database
          // 4. Send verification email

          // For demo purposes, create a mock user
          const newUser = await User.create({
            email: body.email,
            name: body.name,
            emailVerified: null,
          });

          const newUserId = newUser.get("id");

          // Process referral attribution if referralCode provided
          let attributionResult;
          if (body.referralCode) {
            attributionResult = await processReferralAttribution({
              newUserId,
              referralCode: body.referralCode,
            });
          }

          return jsonResponse({
            success: true,
            user: newUser.toJson(),
            referralAttribution: attributionResult || null,
          });
        } catch (error) {
          console.error("Registration error:", error);
          return errorResponse(
            error instanceof Error ? error.message : "Registration failed",
            500
          );
        }
      }

      // ============================================================
      // Authentication - Auth.js Routes
      // ============================================================
      // Handles all Auth.js routes: /api/auth/signin, /api/auth/signout,
      // /api/auth/session, /api/auth/callback/*, etc.
      if (url.pathname.startsWith("/api/auth/")) {
        return handleAuthRequest(request, env as any);
      }

      // ============================================================
      // API Client Demo
      // ============================================================

      if (url.pathname === "/api/demo") {
        if (request.method === "GET") {
          return jsonResponse({
            message: "Hello from GET",
            method: "GET",
            timestamp: Date.now(),
          });
        }

        if (request.method === "POST") {
          const body = await readJson<{ name?: string }>(request);
          return jsonResponse({
            message: `Hello, ${body.name || "World"}!`,
            method: "POST",
            timestamp: Date.now(),
          });
        }

        if (request.method === "DELETE") {
          return jsonResponse({
            message: "Resource deleted",
            method: "DELETE",
            timestamp: Date.now(),
          });
        }

        return errorResponse("Method not allowed", 405, {
          code: "METHOD_NOT_ALLOWED",
        });
      }

      if (url.pathname === "/api/demo/error") {
        return errorResponse("Something went wrong", 500, {
          code: "DEMO_ERROR",
          hint: "This is a demo error response with multiple messages",
          messages: [
            "Primary error: Database connection failed",
            "Secondary issue: Authentication token expired",
            "Additional context: Rate limit may have been exceeded",
          ],
        });
      }

      // ============================================================
      // Cloudflare demos
      // ============================================================

      // KV: /api/cloudflare/kv
      if (url.pathname === "/api/cloudflare/kv") {
        if (!env.OBCF_KV) {
          return errorResponse("KV namespace binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        const kv = createKVClient({ namespace: env.OBCF_KV as any });

        if (request.method === "GET") {
          const key = url.searchParams.get("key");
          if (!key) return errorResponse("Key is required", 400);

          const result = await kv.getText(key);
          if (!result.success) {
            return errorResponse("Failed to get value", 500, {
              details: result.error.message,
            });
          }

          return jsonResponse({ value: result.data });
        }

        if (request.method === "POST") {
          const body = await readJson<{
            key?: string;
            value?: string;
            ttl?: number | string;
          }>(request);
          if (!body.key || !body.value) {
            return errorResponse("Key and value are required", 400);
          }

          const expirationTtl = body.ttl
            ? parseInt(String(body.ttl), 10)
            : undefined;
          const result = await kv.put(body.key, body.value, { expirationTtl });
          if (!result.success) {
            return errorResponse("Failed to set value", 500, {
              details: result.error.message,
            });
          }
          return jsonResponse({ success: true });
        }

        if (request.method === "DELETE") {
          const key = url.searchParams.get("key");
          if (!key) return errorResponse("Key is required", 400);

          const result = await kv.delete(key);
          if (!result.success) {
            return errorResponse("Failed to delete value", 500, {
              details: result.error.message,
            });
          }
          return jsonResponse({ success: true });
        }

        return errorResponse("Method not allowed", 405, {
          code: "METHOD_NOT_ALLOWED",
        });
      }

      // R2: /api/cloudflare/r2
      if (url.pathname === "/api/cloudflare/r2") {
        if (!env.OBCF_R2) {
          return errorResponse("R2 bucket binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        if (request.method === "GET") {
          if (url.searchParams.get("list") === "true") {
            const listing = await env.OBCF_R2.list({ limit: 100 });
            return jsonResponse({ objects: listing.objects });
          }

          const key = url.searchParams.get("key");
          if (!key) return errorResponse("key is required", 400);

          const object = await env.OBCF_R2.get(key);
          if (!object) return errorResponse("Object not found", 404);

          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("etag", object.httpEtag);
          headers.set("Content-Disposition", `attachment; filename=\"${key}\"`);

          return new Response(object.body, { headers });
        }

        if (request.method === "POST") {
          const formData = await request.formData();
          const file = formData.get("file");
          const key = formData.get("key");

          if (!key || typeof key !== "string") {
            return errorResponse("key is required", 400);
          }
          if (!(file instanceof File)) {
            return errorResponse("file is required", 400);
          }

          await env.OBCF_R2.put(key, await file.arrayBuffer(), {
            httpMetadata: {
              contentType: file.type || "application/octet-stream",
            },
          });

          // Construct public URL - assuming domain is same as worker or configured R2 public domain
          // For simple R2 buckets without public access, this might just be the key or we might need presigned urls.
          // But for this demo, we'll return a URL that points to this worker's GET endpoint
          const publicUrl = `/api/cloudflare/r2?key=${encodeURIComponent(key)}`;

          return jsonResponse({ success: true, data: { url: publicUrl } });
        }

        if (request.method === "DELETE") {
          const key = url.searchParams.get("key");
          if (!key) return errorResponse("key is required", 400);
          await env.OBCF_R2.delete(key);
          return jsonResponse({ success: true });
        }

        return errorResponse("Method not allowed", 405, {
          code: "METHOD_NOT_ALLOWED",
        });
      }

      // Upload: /api/upload
      if (url.pathname === "/api/upload") {
        if (request.method === "POST") {
          try {
            const formData = await request.formData();
            const file = formData.get("file");
            const provider = (formData.get("provider") as string) || "r2";

            if (!(file instanceof File)) {
              return errorResponse("file is required", 400);
            }

            // Handle different providers
            if (provider === "cloudflare-images") {
              // Cloudflare Images provider
              const accountId = env.CLOUDFLARE_ACCOUNT_ID as string;
              const apiToken = env.CLOUDFLARE_API_TOKEN as string;

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
                  maxFileSize: 10 * 1024 * 1024, // 10MB max for images
                },
              );

              if (result.success) {
                return jsonResponse({
                  success: true,
                  url: result.url,
                  key: result.key,
                  provider: "cloudflare-images",
                });
              } else {
                const errorCode = (result as any).code;
                const status = errorCode === "CONFIG_ERROR" ? 500 : 400;
                return errorResponse(
                  result.error || "Upload failed",
                  status,
                  errorCode ? { code: errorCode } : undefined,
                );
              }
            } else {
              // R2 provider (default)
              if (!env.OBCF_R2) {
                return errorResponse("R2 bucket binding not configured", 500, {
                  code: "CONFIG_ERROR",
                });
              }

              // Create R2 client
              const r2Client = createR2Client({ bucket: env.OBCF_R2 });

              // Upload file
              const result = await uploadFileToR2(file, r2Client, {
                maxFileSize: 50 * 1024 * 1024, // 50MB max
              });

              if (result.success) {
                return jsonResponse({
                  success: true,
                  url: result.url,
                  key: result.key,
                  provider: "r2",
                });
              } else {
                return errorResponse(result.error || "Upload failed", 400);
              }
            }
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

      // Upload file download: /api/upload/file/:key
      if (url.pathname.startsWith("/api/upload/file/")) {
        if (!env.OBCF_R2) {
          return errorResponse("R2 bucket binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        const key = url.pathname.replace("/api/upload/file/", "");
        if (!key) {
          return errorResponse("key is required", 400);
        }

        const object = await env.OBCF_R2.get(key);
        if (!object) {
          return errorResponse("File not found", 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);

        return new Response(object.body, { headers });
      }

      // Images: /api/cloudflare/images
      if (url.pathname === "/api/cloudflare/images") {
        // @ts-ignore - Env variables might not be typed in CloudflareEnv yet
        const accountId = env.CF_IMAGES_ACCOUNT_ID;
        // @ts-ignore
        const apiToken = env.CF_IMAGES_API_TOKEN;

        if (!accountId || !apiToken) {
          return errorResponse(
            "Cloudflare Images credentials not configured",
            500,
            { code: "CONFIG_ERROR" },
          );
        }

        const imagesClient = createImagesClient({ accountId, apiToken });

        if (request.method === "POST") {
          const formData = await request.formData();
          const file = formData.get("file");

          if (!(file instanceof File)) {
            return errorResponse("file is required", 400);
          }

          // Upload to CF Images
          const result = await imagesClient.upload(file);

          if (!result.success) {
            return errorResponse(result.error.message, 500);
          }

          // Return the first variant as the URL (public)
          const variants = result.data.variants;
          const publicUrl =
            variants && variants.length > 0 ? variants[0] : null;

          return jsonResponse({
            success: true,
            data: {
              url: publicUrl,
              variants: variants,
              id: result.data.id,
            },
          });
        }

        return errorResponse("Method not allowed", 405, {
          code: "METHOD_NOT_ALLOWED",
        });
      }

      // D1 demo (raw SQL): /api/cloudflare/d1/*
      if (
        url.pathname === "/api/cloudflare/d1/init" &&
        request.method === "POST"
      ) {
        if (!env.OBCF_D1) {
          return errorResponse(
            "D1 database binding not configured. Check wrangler.jsonc",
            500,
            { code: "CONFIG_ERROR" },
          );
        }

        // Ensure the app-specific table exists (matches Todo model schema)
        // Using .batch() instead of .exec() to avoid Wrangler dev mode duration metadata error
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

        return jsonResponse({
          success: true,
          message: "Database initialized successfully",
          info: `Found ${count} existing todos`,
        });
      }

      if (url.pathname === "/api/cloudflare/d1/todos") {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        if (request.method === "GET") {
          const todos = await Todo.all({
            orderBy: "createdAt",
            orderDirection: "desc",
          });
          return jsonResponse({ todos: todos.map((t) => t.toJson()) });
        }

        if (request.method === "POST") {
          const body = await readJson<{ title?: string }>(request);
          if (!body.title || typeof body.title !== "string") {
            return errorResponse("Title is required and must be a string", 400);
          }

          const todo = await Todo.create({
            id: crypto.randomUUID(),
            title: body.title.trim(),
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          return jsonResponse({
            success: true,
            message: "Todo created successfully",
            todo: todo.toJson(),
          });
        }

        return errorResponse("Method not allowed", 405, {
          code: "METHOD_NOT_ALLOWED",
        });
      }

      const d1TodoMatch = url.pathname.match(
        /^\/api\/cloudflare\/d1\/todos\/(.+)$/,
      );
      if (d1TodoMatch) {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database binding not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        registerConnection("default", createD1Driver(env.OBCF_D1));

        const id = d1TodoMatch[1];
        if (!id) return errorResponse("Invalid id", 400);

        if (request.method === "PATCH") {
          const body = await readJson<{ completed?: boolean }>(request);
          if (typeof body.completed !== "boolean") {
            return errorResponse("Completed must be a boolean", 400);
          }

          const todo = await Todo.find(id);
          if (!todo) return errorResponse("Todo not found", 404);

          todo.set("completed", body.completed);
          await todo.save();

          return jsonResponse({
            success: true,
            message: "Todo updated successfully",
            todo: todo.toJson(),
          });
        }

        if (request.method === "DELETE") {
          const todo = await Todo.find(id);
          if (!todo) return errorResponse("Todo not found", 404);

          // Use static delete method instead of instance destroy
          await Todo.delete(id);

          return jsonResponse({
            success: true,
            message: "Todo deleted successfully",
          });
        }

        return errorResponse("Method not allowed", 405, {
          code: "METHOD_NOT_ALLOWED",
        });
      }

      // Queues: /api/cloudflare/queues
      if (url.pathname === "/api/cloudflare/queues") {
        if (request.method === "POST") {
          if (!env.OBCF_QUEUE) {
            return errorResponse("Queue binding not configured", 500, {
              code: "CONFIG_ERROR",
            });
          }

          const body = await readJson<{ message?: unknown; batch?: unknown[] }>(
            request,
          );
          const queue = createQueuesClient({ queue: env.OBCF_QUEUE });

          if (Array.isArray(body.batch)) {
            const messages = body.batch.map((msg) => ({ body: msg }));
            const result = await queue.sendBatch(messages);
            if (!result.success) {
              return errorResponse("Failed to send batch", 500, {
                details: result.error.message,
              });
            }

            if (env.OBCF_KV) {
              try {
                const kv = createKVClient({ namespace: env.OBCF_KV as any });
                const timestamp = Date.now();
                for (let i = 0; i < body.batch.length; i++) {
                  const key = `queue:message:${timestamp}:${i}`;
                  await kv.put(
                    key,
                    JSON.stringify({
                      ...(body.batch[i] as any),
                      sentAt: new Date().toISOString(),
                      type: "batch",
                    }),
                    { expirationTtl: 3600 },
                  );
                }
              } catch {
                // ignore demo history errors
              }
            }

            return jsonResponse({
              success: true,
              message: `Sent ${body.batch.length} messages to queue`,
              count: body.batch.length,
            });
          }

          if (body.message) {
            const result = await queue.send(body.message);
            if (!result.success) {
              return errorResponse("Failed to send message", 500, {
                details: result.error.message,
              });
            }

            if (env.OBCF_KV) {
              try {
                const kv = createKVClient({ namespace: env.OBCF_KV as any });
                const key = `queue:message:${Date.now()}`;
                await kv.put(
                  key,
                  JSON.stringify({
                    ...(body.message as any),
                    sentAt: new Date().toISOString(),
                    type: "single",
                  }),
                  { expirationTtl: 3600 },
                );
              } catch {
                // ignore
              }
            }

            return jsonResponse({
              success: true,
              message: "Message sent to queue",
            });
          }

          return errorResponse("Either message or batch is required", 400);
        }

        if (request.method === "GET") {
          if (!env.OBCF_KV) {
            return errorResponse("KV binding not configured", 500, {
              code: "CONFIG_ERROR",
            });
          }

          const kv = createKVClient({ namespace: env.OBCF_KV as any });
          const listResult = await kv.list({ prefix: "queue:message:" });
          if (!listResult.success) {
            return errorResponse("Failed to list messages", 500);
          }

          const messages: any[] = [];
          for (const key of listResult.data.keys.slice(0, 20)) {
            const result = await kv.get(key.name);
            if (result.success && result.data) {
              try {
                const message = JSON.parse(result.data as string);
                messages.push({ key: key.name, ...message });
              } catch {
                // ignore
              }
            }
          }

          messages.sort(
            (a, b) =>
              new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
          );

          return jsonResponse({ messages });
        }

        return errorResponse("Method not allowed", 405, {
          code: "METHOD_NOT_ALLOWED",
        });
      }

      // Rate limiting: /api/cloudflare/rate-limiting
      if (
        url.pathname === "/api/cloudflare/rate-limiting" &&
        request.method === "POST"
      ) {
        const body = await readJson<{ key?: string }>(request);
        if (!body.key) return errorResponse("Key is required", 400);

        let rateLimitData: {
          success: boolean;
          limit: number;
          remaining: number;
          resetAfter: number;
        } | null = null;

        if (env.OBCF_RATE_LIMITER) {
          try {
            const limiter = createRateLimitingClient({
              rateLimiter: env.OBCF_RATE_LIMITER,
            });
            const result = await limiter.limit({ key: body.key });
            if (result.success) {
              const { success, limit, remaining, resetAfter } = result.data;
              if (
                limit !== undefined &&
                remaining !== undefined &&
                resetAfter !== undefined
              ) {
                rateLimitData = { success, limit, remaining, resetAfter };
              }
            }
          } catch {
            // ignore - will fall back
          }
        }

        if (!rateLimitData) {
          rateLimitData = await simulateRateLimit(env, body.key);
          if (!rateLimitData) {
            return errorResponse("Rate limiter not available", 500, {
              hint: "Enable OBCF_RATE_LIMITER binding or ensure OBCF_KV is configured for local dev simulation",
              code: "CONFIG_ERROR",
            });
          }
        }

        const { success, limit, remaining, resetAfter } = rateLimitData;

        const headers = {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": resetAfter.toString(),
        };

        if (!success) {
          return errorResponse("Rate limit exceeded", 429, {
            code: "RATE_LIMITED",
            details: `Limit: ${limit}, Remaining: ${remaining}, Reset After: ${resetAfter}`,
            status: 429,
          } as any); // status is handled by errorResponse
        }

        return jsonResponse(
          {
            success: true,
            message: "Request allowed",
            limit,
            remaining,
            resetAfter,
          },
          { headers },
        );
      }

      // Realtime: /api/cloudflare/realtime/*
      if (url.pathname === "/api/cloudflare/realtime/ws") {
        if (!env.OBCF_REALTIME) {
          return errorResponse(
            "Realtime is not available in this environment",
            501,
            {
              details:
                "The Durable Object binding (OBCF_REALTIME) is not configured.",
              hint: "Deploy with `wrangler deploy` to enable Durable Objects.",
              code: "CONFIG_ERROR",
            },
          );
        }

        if (request.headers.get("Upgrade") !== "websocket") {
          return errorResponse("Expected WebSocket upgrade", 426, {
            code: "UPGRADE_REQUIRED",
          });
        }

        const id = env.OBCF_REALTIME.idFromName("global");
        const stub = env.OBCF_REALTIME.get(id);
        return stub.fetch(request as any) as unknown as Response;
      }

      if (
        url.pathname === "/api/cloudflare/realtime/broadcast" &&
        request.method === "POST"
      ) {
        if (!env.OBCF_REALTIME) {
          return errorResponse(
            "Realtime is not available in this environment",
            501,
            { code: "CONFIG_ERROR" },
          );
        }

        const body = await readJson<{
          channels?: string[];
          event?: string;
          data?: unknown;
          persistForOffline?: boolean;
        }>(request);

        if (
          !body.channels ||
          !Array.isArray(body.channels) ||
          body.channels.length === 0
        ) {
          return errorResponse("channels array is required", 400);
        }
        if (!body.event) {
          return errorResponse("event is required", 400);
        }

        const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
        const result = await broadcaster.broadcast({
          channels: body.channels,
          event: body.event,
          data: body.data,
          persistForOffline: body.persistForOffline ?? false,
          metadata: { sentAt: Date.now(), source: "api" },
        });

        if (!result.success) {
          return errorResponse("Failed to broadcast message", 500, {
            details: result.error,
          });
        }

        return jsonResponse({
          success: true,
          channelsCount: body.channels.length,
        });
      }

      if (
        url.pathname === "/api/cloudflare/realtime/stats" &&
        request.method === "GET"
      ) {
        if (!env.OBCF_REALTIME) {
          return errorResponse(
            "Realtime is not available in this environment",
            501,
            { code: "CONFIG_ERROR" },
          );
        }

        const broadcaster = new RealtimeBroadcaster(env.OBCF_REALTIME);
        const stats = await broadcaster.getStats();
        return jsonResponse(
          stats ?? {
            totalConnections: 0,
            channels: [],
            offlineMessagesQueued: 0,
          },
        );
      }

      // ============================================================
      // OttaORM Init
      // ============================================================

      if (
        url.pathname === "/api/ottaorm/init" &&
        (request.method === "GET" || request.method === "POST")
      ) {
        if (!env.OBCF_D1) {
          return errorResponse("D1 database not configured", 500, {
            code: "CONFIG_ERROR",
          });
        }

        const isAuthorized = await checkMigrationAuth(request, env);
        if (!isAuthorized) {
          return errorResponse(
            "Unauthorized - MIGRATION_SECRET required in production",
            401,
            { code: "UNAUTHORIZED" },
          );
        }

        // ============================================================
        // AUTOMATED MIGRATIONS
        // ============================================================
        // This automatically:
        // 1. Detects all tables from CORE schemas (@ottabase/ottaorm)
        // 2. Detects all tables from APP-SPECIFIC schemas (Todo, etc.)
        // 3. Detects all tables from ENABLED PACKAGES (shortlinks, etc.)
        // 4. Creates tables that don't exist
        // 5. Adds new columns to existing tables
        // 6. Runs custom migrations (core + app + package)
        //
        // Just define your Models and call this endpoint!
        // ============================================================
        const driver = createD1Driver(env.OBCF_D1);

        // Get ALL schemas: core + app + packages
        const allSchemas = getAllSchemas();

        const result = await autoInit({
          driver,
          schema: allSchemas,
          customMigrations: appMigrations,
          verbose: true,
        });

        return jsonResponse(result);
      }

      // ============================================================
      // Generic CRUD handler for all registered models
      // Handles: /api/ottaorm/{model} and /api/ottaorm/{model}/{id}
      // ============================================================
      if (
        url.pathname.startsWith("/api/ottaorm/") &&
        !url.pathname.startsWith("/api/ottaorm/init")
      ) {
        if (!env.OBCF_D1)
          return errorResponse("D1 database not configured", 500, {
            code: "CONFIG_ERROR",
          });
        registerConnection("default", createD1Driver(env.OBCF_D1));

        // Register all models for dynamic lookup
        registerModels([User, Post, Tag, Todo, Shortlink]);

        // Parse the request into a CrudRequest
        const crudRequest = await parseCrudRequest(
          request,
          url,
          "/api/ottaorm",
        );
        if (!crudRequest) {
          return errorResponse("Invalid request path", 400);
        }

        // Handle the CRUD operation
        const result = await handleCrud(crudRequest);
        if (!result.success) {
          return errorResponse(result.error!, result.status, {
            code: result.code,
            details: result.details,
            hint: result.hint,
            messages: result.messages,
            fieldErrors: result.fieldErrors,
          });
        }
        return jsonResponse(result.data, { status: result.status });
      }

      // ============================================================
      // Shortlink Explicit Redirect: /shortlinks/go?code=xyz
      // ============================================================
      if (url.pathname === "/shortlinks/go") {
        if (!env.OBCF_D1) {
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

        registerConnection("default", createD1Driver(env.OBCF_D1));

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

          // Track usage
          shortlink.trackClick().catch((err) => {
            console.error("Failed to track shortlink click:", err);
          });

          return Response.redirect(shortlink.get("fullUrl"), 302);
        } catch (error) {
          console.error("Shortlink explicit redirect error:", error);
          return errorResponse("Failed to process shortlink", 500);
        }
      }

      // ============================================================
      // Shortlink Redirect Handler
      // ============================================================
      // Handle shortlink redirects (e.g., go.example.com/gh)
      // Must be checked before static assets to intercept shortcodes
      if (
        env.OBCF_D1 &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/@") &&
        url.pathname !== "/" &&
        !/\.[a-zA-Z0-9]+$/.test(url.pathname)
      ) {
        try {
          registerConnection("default", createD1Driver(env.OBCF_D1));

          // Extract shortcode from path (remove leading slash)
          const shortCode = url.pathname.substring(1);

          const shortlink = await Shortlink.findByCode(shortCode);

          if (shortlink) {
            // Check if expired
            if (shortlink.isExpired()) {
              // Return 410 Gone for expired links
              return errorResponse("This shortlink has expired", 410, {
                code: "LINK_EXPIRED",
              });
            }

            // Track the click asynchronously (don't wait for it), but log failures
            shortlink.trackClick().catch((error) => {
              console.error("Shortlink click tracking error:", error);
            });

            // Redirect to the full URL
            return Response.redirect(shortlink.get("fullUrl"), 302);
          }
        } catch (error) {
          console.error("Shortlink redirect error:", error);
          // Continue to serve assets if shortlink lookup fails
        }
      }

      // Serve built assets. If the asset isn't found and the client is requesting HTML,
      // fall back to `index.html` to support client-side routing.
      if (!env.OBCF_ASSETS) {
        return errorResponse("Assets binding not configured", 500, {
          code: "CONFIG_ERROR",
        });
      }

      const response = await env.OBCF_ASSETS.fetch(request);

      // Handle SPA routes on direct navigation/refresh
      if (isHtmlRequest(request)) {
        if (
          response.status === 404 ||
          SPA_REDIRECT_STATUSES.has(response.status)
        ) {
          const indexUrl = new URL(request.url);
          indexUrl.pathname = "/index.html";
          return env.OBCF_ASSETS.fetch(
            new Request(indexUrl.toString(), request),
          );
        }
      }

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
