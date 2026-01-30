// ============================================================
// @ottabase/db/prisma - Prisma ORM Entry Point
// ============================================================
//
// This module provides Prisma-specific functionality:
// - Prisma client instance
// - Prisma configuration types and helpers
// - Feature registry for Prisma schema composition
//
// For Drizzle ORM, use @ottabase/db/drizzle or @ottabase/db/drizzle-d1
//
// ============================================================

// Re-export Prisma client and types
export type { PrismaClient } from '@prisma/client';
export { prisma } from './client';

// Configuration types and helpers
export type {
    AppDbConfig,
    CoreSchemaName,
    CreateClientOptions,
    DbProvider,
    FeatureId,
    FeatureRegistry,
    FeatureSchemaDefinition,
    GeneratorConfig,
    MigrationConfig,
    ResolvedAppDbConfig,
} from '../config';

export { defineAppDbConfig, defineFeatureSchema, resolveAppDbConfig } from '../config';

// Feature registry
export {
    createFeatureRegistry,
    discoverFeatures,
    getFeatureRegistry,
    registerFeature,
    resetFeatureRegistry,
} from '../registry';
