// ============================================================
// @ottabase/db - Configuration Types and Helpers
// ============================================================

/**
 * Supported database providers
 * - d1: Cloudflare D1 (default, serverless SQLite)
 * - sqlite: Local SQLite
 * - postgresql: PostgreSQL
 * - mysql: MySQL/MariaDB
 * - sqlserver: SQL Server
 * - mongodb: MongoDB
 * - cockroachdb: CockroachDB
 */
export type DbProvider = 'd1' | 'sqlite' | 'postgresql' | 'mysql' | 'sqlserver' | 'mongodb' | 'cockroachdb';

/**
 * Core schema names available in @ottabase/db
 * @deprecated Core models are now always included from the base schema.
 * Use features to extend the schema instead.
 */
export type CoreSchemaName = 'user' | 'post';

/**
 * Feature identifiers that can be enabled per app
 * Built-in features + custom string identifiers
 */
export type FeatureId = 'auth' | 'billing' | 'notifications' | (string & {});

// ============================================================
// FEATURE SCHEMA TYPES
// ============================================================

/**
 * Metadata for a feature's database schema
 */
export interface FeatureSchemaDefinition {
    /** Unique feature identifier */
    featureId: FeatureId;

    /** Human-readable name */
    name: string;

    /** Feature description */
    description?: string;

    /** Path to the .schema.prisma file (relative to feature package root) */
    schemaPath: string;

    /** Path to migrations directory (relative to feature package root) */
    migrationsPath?: string;

    /** Dependencies on other features (must be loaded first) */
    dependencies?: FeatureId[];

    /** Package name for resolution (e.g., "@ottabase/auth") */
    packageName: string;

    /** Version of the feature schema */
    version?: string;
}

// ============================================================
// APP DATABASE CONFIGURATION
// ============================================================

/**
 * Prisma generator configuration options
 */
export interface GeneratorConfig {
    /** Generator provider (default: "prisma-client-js") */
    provider?: string;
    /** Preview features to enable */
    previewFeatures?: string[];
    /** Binary targets for deployment */
    binaryTargets?: string[];
}

/**
 * Migration configuration options
 */
export interface MigrationConfig {
    /** Auto-run migrations on startup (dev only, default: false) */
    autoRun?: boolean;
    /** Custom migrations directory */
    directory?: string;
}

/**
 * Database configuration for an application
 */
export interface AppDbConfig {
    /** Unique app identifier (e.g., "web", "admin", "api") */
    appId: string;

    /** Database provider (default: "d1") */
    dbProvider?: DbProvider;

    /**
     * Core schemas to include from @ottabase/db
     * @deprecated Core models (User, Post) are now always included from the base schema.
     * Use features to extend the schema instead.
     */
    coreSchemas?: CoreSchemaName[];

    /** Feature packages to include (e.g., ["auth", "billing"]) */
    features?: FeatureId[];

    /** Path to app-specific schema file (relative to app root) */
    appSchemaPath?: string;

    /** Output path for generated schema (relative to app root) */
    outputSchemaPath?: string;

    /** Database URL environment variable name (default: "DATABASE_URL") */
    databaseUrlEnvVar?: string;

    /** Prisma client generator options */
    generator?: GeneratorConfig;

    /** Migration configuration */
    migrations?: MigrationConfig;

    // ============================================================
    // D1-SPECIFIC CONFIGURATION
    // ============================================================

    /**
     * D1 database binding name (default: "DB")
     * This should match the binding name in wrangler.toml
     *
     * @example
     * ```toml
     * [[d1_databases]]
     * binding = "DB"
     * database_name = "my-database"
     * database_id = "xxx"
     * ```
     */
    d1Database?: string;

    /**
     * Path to wrangler configuration file (default: auto-detect)
     * Supports: wrangler.toml, wrangler.jsonc, wrangler.json
     *
     * @example "wrangler.toml"
     * @example "wrangler.jsonc"
     */
    wranglerConfig?: string;

    /**
     * Auto-apply migrations in development (default: false)
     * When true, migrations are automatically applied to local D1 after generation
     *
     * ⚠️ Use with caution - only recommended for development environments
     */
    autoApplyMigrations?: boolean;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedAppDbConfig {
    appId: string;
    dbProvider: DbProvider;
    coreSchemas: CoreSchemaName[];
    features: FeatureId[];
    appSchemaPath: string;
    outputSchemaPath: string;
    databaseUrlEnvVar: string;
    generator: Required<GeneratorConfig>;
    migrations: Required<MigrationConfig>;
    /** Resolved feature definitions */
    resolvedFeatures: FeatureSchemaDefinition[];
    /** All schema paths to concatenate (in order) */
    schemaPaths: string[];
    /** All migration paths (in dependency order) */
    migrationPaths: string[];
}

// ============================================================
// FEATURE REGISTRY INTERFACE
// ============================================================

/**
 * Registry for managing feature schemas
 */
export interface FeatureRegistry {
    /** Register a feature schema */
    register(definition: FeatureSchemaDefinition): void;

    /** Get a feature by ID */
    get(featureId: FeatureId): FeatureSchemaDefinition | undefined;

    /** Get all registered features */
    getAll(): FeatureSchemaDefinition[];

    /** Check if a feature is registered */
    has(featureId: FeatureId): boolean;

    /** Resolve features with dependencies (topological sort) */
    resolve(featureIds: FeatureId[]): FeatureSchemaDefinition[];
}

// ============================================================
// CLIENT FACTORY TYPES
// ============================================================

/**
 * Options for creating a Prisma client
 *
 * For D1-specific options, use @ottabase/cf/prisma-d1
 */
export interface CreateClientOptions {
    /** Database provider */
    provider?: DbProvider;

    /** Database URL (for non-D1 providers) */
    databaseUrl?: string;

    /** Enable query logging */
    log?: boolean | ('query' | 'info' | 'warn' | 'error')[];
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: {
    dbProvider: DbProvider;
    coreSchemas: CoreSchemaName[];
    features: FeatureId[];
    appSchemaPath: string;
    outputSchemaPath: string;
    databaseUrlEnvVar: string;
    generator: Required<GeneratorConfig>;
    migrations: Required<MigrationConfig>;
} = {
    dbProvider: 'd1',
    coreSchemas: [],
    features: [],
    appSchemaPath: 'ottabase/prisma/app.schema.prisma',
    outputSchemaPath: 'prisma/schema.prisma',
    databaseUrlEnvVar: 'DATABASE_URL',
    generator: {
        provider: 'prisma-client-js',
        previewFeatures: ['driverAdapters'],
        binaryTargets: ['native', 'rhel-openssl-3.0.x'], // native + Cloudflare Workers
    },
    migrations: {
        autoRun: false,
        directory: 'prisma/migrations',
    },
};

/**
 * Define app database configuration with type safety and defaults
 *
 * @example
 * ```typescript
 * // apps/web/db.config.ts
 * import { defineAppDbConfig } from "@ottabase/db";
 *
 * export default defineAppDbConfig({
 *   appId: "web",
 *   dbProvider: "d1",
 *   features: ["auth"], // Enable auth feature
 * });
 * ```
 */
export function defineAppDbConfig(config: AppDbConfig): AppDbConfig {
    return {
        dbProvider: DEFAULT_CONFIG.dbProvider,
        coreSchemas: DEFAULT_CONFIG.coreSchemas,
        features: DEFAULT_CONFIG.features,
        appSchemaPath: DEFAULT_CONFIG.appSchemaPath,
        outputSchemaPath: DEFAULT_CONFIG.outputSchemaPath,
        databaseUrlEnvVar: DEFAULT_CONFIG.databaseUrlEnvVar,
        generator: {
            ...DEFAULT_CONFIG.generator,
            ...config.generator,
        },
        migrations: {
            ...DEFAULT_CONFIG.migrations,
            ...config.migrations,
        },
        ...config,
    };
}

/**
 * Define a feature schema for registration
 *
 * @example
 * ```typescript
 * // packages/auth/db.feature.ts
 * import { defineFeatureSchema } from "@ottabase/db";
 *
 * export default defineFeatureSchema({
 *   featureId: "auth",
 *   name: "Authentication",
 *   packageName: "@ottabase/auth",
 *   schemaPath: "prisma/auth.schema.prisma",
 * });
 * ```
 */
export function defineFeatureSchema(definition: FeatureSchemaDefinition): FeatureSchemaDefinition {
    return {
        migrationsPath: definition.migrationsPath ?? 'migrations',
        dependencies: definition.dependencies ?? [],
        ...definition,
    };
}

/**
 * Resolve an AppDbConfig to a fully resolved configuration with all defaults
 */
export function resolveAppDbConfig(
    config: AppDbConfig,
    resolvedFeatures: FeatureSchemaDefinition[] = [],
    schemaPaths: string[] = [],
    migrationPaths: string[] = [],
): ResolvedAppDbConfig {
    return {
        appId: config.appId,
        dbProvider: config.dbProvider ?? DEFAULT_CONFIG.dbProvider,
        coreSchemas: config.coreSchemas ?? DEFAULT_CONFIG.coreSchemas,
        features: config.features ?? DEFAULT_CONFIG.features,
        appSchemaPath: config.appSchemaPath ?? DEFAULT_CONFIG.appSchemaPath,
        outputSchemaPath: config.outputSchemaPath ?? DEFAULT_CONFIG.outputSchemaPath,
        databaseUrlEnvVar: config.databaseUrlEnvVar ?? DEFAULT_CONFIG.databaseUrlEnvVar,
        generator: {
            provider: config.generator?.provider ?? DEFAULT_CONFIG.generator.provider,
            previewFeatures: config.generator?.previewFeatures ?? DEFAULT_CONFIG.generator.previewFeatures,
            binaryTargets: config.generator?.binaryTargets ?? DEFAULT_CONFIG.generator.binaryTargets,
        },
        migrations: {
            autoRun: config.migrations?.autoRun ?? DEFAULT_CONFIG.migrations.autoRun,
            directory: config.migrations?.directory ?? DEFAULT_CONFIG.migrations.directory,
        },
        resolvedFeatures,
        schemaPaths,
        migrationPaths,
    };
}
