/**
 * OttaORM CRUD API routes
 * Provides generic CRUD operations for all registered models
 */

import { createD1Driver } from "@ottabase/db/drizzle-d1";
import {
  coreMigrations,
  handleCrud,
  parseCrudRequest,
  Post,
  registerConnection,
  registerModels,
  runMigrations,
  Tag,
  User,
} from "@ottabase/ottaorm";
import { appMigrations } from "../../../ottabase/migrations";
import { Todo } from "../../../ottabase/models/Todo";
import type { RouteContext, RouteModule } from "../../types";
import { checkMigrationAuth } from "../../utils/auth";
import { errorResponse, json } from "../../utils/response";

/** Initialize database connection and register models */
function initDb(env: CloudflareEnv) {
  registerConnection("default", createD1Driver(env.OBCF_D1));
  registerModels([User, Post, Tag, Todo]);
}

/** Handle migration init request */
async function handleInit(ctx: RouteContext): Promise<Response> {
  const { request, env } = ctx;

  if (!env.OBCF_D1) {
    return errorResponse("D1 database not configured", 500);
  }

  const isAuthorized = await checkMigrationAuth(request, env);
  if (!isAuthorized) {
    return errorResponse("Unauthorized - MIGRATION_SECRET required in production", 401);
  }

  const driver = createD1Driver(env.OBCF_D1);
  const result = await runMigrations(driver, [...coreMigrations, ...appMigrations]);
  return json({
    success: true,
    message: "Database migrations completed successfully",
    executed: result.executed,
    skipped: result.skipped,
  });
}

/** Handle generic CRUD operations for any registered model */
async function handleGenericCrud(ctx: RouteContext): Promise<Response> {
  const { request, env, url } = ctx;

  if (!env.OBCF_D1) {
    return errorResponse("D1 database not configured", 500);
  }

  initDb(env);

  // Parse the request into a CrudRequest
  const crudRequest = await parseCrudRequest(request, url, "/api/ottaorm");
  if (!crudRequest) {
    return errorResponse("Invalid request path");
  }

  // Handle the CRUD operation
  const result = await handleCrud(crudRequest);
  return json(result.data || { error: result.error }, { status: result.status });
}

export const routes: RouteModule["routes"] = [
  {
    path: "/api/ottaorm/init",
    handlers: {
      GET: handleInit,
      POST: handleInit,
    },
  },
  // Generic CRUD handler matches /api/ottaorm/{model} and /api/ottaorm/{model}/{id}
  {
    path: "/api/ottaorm/:model",
    handlers: {
      GET: handleGenericCrud,
      POST: handleGenericCrud,
    },
  },
  {
    path: "/api/ottaorm/:model/:id",
    handlers: {
      GET: handleGenericCrud,
      PUT: handleGenericCrud,
      PATCH: handleGenericCrud,
      DELETE: handleGenericCrud,
    },
  },
];
