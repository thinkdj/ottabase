/**
 * OttaORM initialization/migration route
 */

import { createD1Driver } from "@ottabase/db/drizzle-d1";
import { coreMigrations, runMigrations } from "@ottabase/ottaorm";
import { appMigrations } from "../../../ottabase/migrations";
import type { RouteModule } from "../../types";
import { checkMigrationAuth } from "../../utils/auth";
import { errorResponse, json } from "../../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/ottaorm/init",
    handlers: {
      GET: async ({ request, env }) => {
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
      },

      POST: async ({ request, env }) => {
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
      },
    },
  },
];
