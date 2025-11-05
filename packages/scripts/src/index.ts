export { concatenatePrismaSchema } from "./concatenate";

// Re-export types from @ottabase/db
export type {
  CoreSchemaName,
  PrismaConfig,
  PrismaDatasource,
} from "@ottabase/db/prisma";

export { definePrismaConfig } from "@ottabase/db/prisma";
