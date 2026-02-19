// ============================================================
// @ottabase/db - Shared Database Package
// ============================================================
//
// This package provides database abstractions for Ottabase applications.
// Choose your ORM based on your needs:
//
// ## Prisma ORM
// For traditional databases and Prisma-based workflows:
//   import { prisma, defineAppDbConfig } from "@ottabase/db/prisma";
//
// ## Drizzle ORM (Recommended for Cloudflare D1)
// For Cloudflare D1 and modern edge deployments:
//   import { createD1Driver } from "@ottabase/db/drizzle-d1";
//
// For other Drizzle drivers:
//   import { BaseDbDriver } from "@ottabase/db/drizzle";
//
// ## MongoDB
// For MongoDB databases:
//   import { createMongoDriver } from "@ottabase/db/mongodb";
//
// ============================================================

// Shared types only - no ORM-specific implementations
// Shared types only - no ORM-specific implementations

// MongoDB exports
export type { MongoDriver, MongoDriverConfig } from './mongodb';
