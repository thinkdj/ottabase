export type { CoreSchemaName } from "../prisma/schemas";

/**
 * Datasource type for database connection
 * - Standard databases: postgresql, mysql, sqlite, sqlserver, mongodb, cockroachdb
 * - d1: Cloudflare D1 (serverless SQLite with @prisma/adapter-d1)
 */
export type PrismaDatasource =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "sqlserver"
  | "mongodb"
  | "cockroachdb"
  | "d1";

export interface PrismaConfig {
  /**
   * Array of core schema names to include from @ottabase/db/prisma/schemas/
   * Example: ["user", "post"]
   */
  coreSchemas?: import("../prisma/schemas").CoreSchemaName[];

  /**
   * Datasource configuration to use
   * Options: "postgresql", "mysql", "sqlite", "sqlserver", "mongodb", "cockroachdb", "d1"
   * Defaults to "d1" if not specified
   *
   * For Cloudflare D1: Set to "d1" and install @prisma/adapter-d1
   */
  datasource?: PrismaDatasource;

  /**
   * Path to the app-specific schema file (relative to app root)
   * Defaults to "ottabase/prisma/app.schema.prisma"
   */
  appSchemaPath?: string;

  /**
   * Path where the concatenated schema will be written (relative to app root)
   * Defaults to "prisma/schema.prisma"
   */
  outputSchemaPath?: string;

  /**
   * Prisma generate configuration
   */
  prismaGenerate?: {
    enabled?: boolean;
  };
}

export const definePrismaConfig = (config: PrismaConfig): PrismaConfig =>
  config;
