import type { CloudflareEnv } from "@ottabase/cf";
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
import { errorResponse } from "@ottabase/utils/http-errors";
import { jsonResponse } from "@ottabase/utils/http-response";
import { getAllSchemas } from "../../ottabase/db/schemas-helper";
import { appMigrations } from "../../ottabase/migrations";
import { ReferralTracking } from "../../ottabase/models/ReferralTracking";
import { Shortlink } from "../../ottabase/models/Shortlink";
import { Todo } from "../../ottabase/models/Todo";
import { checkMigrationAuth } from "../utils";

export async function handleOttaOrmRoutes(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const envAny = env as any;

  if (url.pathname === "/api/ottaorm/init") {
    if (request.method !== "GET" && request.method !== "POST") {
      return errorResponse("Method not allowed", 405, {
        code: "METHOD_NOT_ALLOWED",
      });
    }

    if (!envAny.OBCF_D1) {
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

    const driver = createD1Driver(envAny.OBCF_D1);
    const allSchemas = getAllSchemas();

    const result = await autoInit({
      driver,
      schema: allSchemas,
      customMigrations: appMigrations,
      verbose: true,
    });

    return jsonResponse(result);
  }

  if (url.pathname.startsWith("/api/ottaorm/")) {
    if (!envAny.OBCF_D1) {
      return errorResponse("D1 database not configured", 500, {
        code: "CONFIG_ERROR",
      });
    }

    registerConnection("default", createD1Driver(envAny.OBCF_D1));
    registerModels([Shortlink, Todo, User, Post, Tag, ReferralTracking]);

    const crudRequest = await parseCrudRequest(request, url, "/api/ottaorm");

    if (!crudRequest) {
      return errorResponse("Invalid CRUD request", 400, {
        code: "INVALID_REQUEST",
        hint: "Use /api/ottaorm/{model}/{id?} format",
      });
    }

    const result = await handleCrud(crudRequest);

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

  return null;
}
