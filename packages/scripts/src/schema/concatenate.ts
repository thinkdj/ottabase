// ============================================================
// @ottabase/scripts - Schema Concatenation
// ============================================================

import type { AppDbConfig, DbProvider, FeatureSchemaDefinition } from '@ottabase/db/config';
import { getFeatureRegistry } from '@ottabase/db/registry';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ============================================================
// CONSTANTS
// ============================================================

const BASE_SCHEMA_PATH = 'packages/db/prisma/schema.prisma';
const DEFAULT_APP_SCHEMA_PATH = 'ottabase/prisma/app.schema.prisma';
const DEFAULT_OUTPUT_SCHEMA_PATH = 'prisma/schema.prisma';

// ============================================================
// SCHEMA GENERATION
// ============================================================

/**
 * Generate the base Prisma schema (generator + datasource)
 */
function generateBaseSchema(
    provider: DbProvider,
    dbUrlEnvVar: string,
    previewFeatures: string[] = ['driverAdapters'],
): string {
    const actualProvider = provider === 'd1' ? 'sqlite' : provider;

    const comments =
        provider === 'd1'
            ? `// ============================================================
// Cloudflare D1 Configuration
// ============================================================
// Provider: D1 (SQLite-compatible)
// Adapter: @prisma/adapter-d1
//
// Usage in Cloudflare Worker:
//   import { PrismaClient } from "@prisma/client";
//   import { PrismaD1 } from "@prisma/adapter-d1";
//
//   const adapter = new PrismaD1(env.OBCF_D1);
//   const prisma = new PrismaClient({ adapter });
// ============================================================
`
            : `// Database Provider: ${provider}\n`;

    const previewFeaturesStr =
        previewFeatures.length > 0 ? `\n  previewFeatures = [${previewFeatures.map((f) => `"${f}"`).join(', ')}]` : '';

    return `${comments}
generator client {
  provider        = "prisma-client-js"${previewFeaturesStr}
}

datasource db {
  provider = "${actualProvider}"
  url      = env("${dbUrlEnvVar}")
}`;
}

/**
 * Transform schema content for datasource compatibility
 */
function transformSchemaForProvider(
    content: string,
    provider: DbProvider,
): { content: string; transformations: string[] } {
    const transformations: string[] = [];
    let transformed = content;

    if (provider === 'd1' || provider === 'sqlite') {
        // Remove @db.Text (SQLite uses TEXT by default for String)
        if (/@db\.Text/.test(transformed)) {
            transformed = transformed.replace(/@db\.Text/g, '');
            transformations.push('Removed @db.Text (SQLite default)');
        }

        // Remove @db.VarChar (not supported in SQLite)
        if (/@db\.VarChar\(\d+\)/.test(transformed)) {
            transformed = transformed.replace(/@db\.VarChar\(\d+\)/g, '');
            transformations.push('Removed @db.VarChar (not supported in SQLite)');
        }

        // Remove @db.Uuid (not supported in SQLite)
        if (/@db\.Uuid/.test(transformed)) {
            transformed = transformed.replace(/@db\.Uuid/g, '');
            transformations.push('Removed @db.Uuid (not supported in SQLite)');
        }
    }

    // Clean up any double spaces left by removals
    transformed = transformed.replace(/  +/g, ' ');
    // Clean up trailing spaces on lines
    transformed = transformed.replace(/ +$/gm, '');

    return { content: transformed, transformations };
}

/**
 * Read the base schema from @ottabase/db
 * Returns the schema content without generator/datasource blocks
 */
async function readBaseSchema(workspaceRoot: string): Promise<string> {
    const possiblePaths = [
        // Direct path from workspace root
        path.join(workspaceRoot, BASE_SCHEMA_PATH),
        // From node_modules
        path.join(workspaceRoot, 'node_modules', '@ottabase', 'db', 'prisma', 'schema.prisma'),
    ];

    for (const schemaPath of possiblePaths) {
        if (existsSync(schemaPath)) {
            const content = await readFile(schemaPath, 'utf8');
            // Remove generator and datasource blocks (we generate our own)
            return stripGeneratorAndDatasource(content);
        }
    }

    throw new Error(`Base schema not found. Tried:\n${possiblePaths.join('\n')}`);
}

/**
 * Strip generator and datasource blocks from schema content
 */
function stripGeneratorAndDatasource(content: string): string {
    // Remove generator blocks
    let result = content.replace(/generator\s+\w+\s*\{[^}]*\}/gs, '');
    // Remove datasource blocks
    result = result.replace(/datasource\s+\w+\s*\{[^}]*\}/gs, '');
    // Remove leading comments (header)
    result = result.replace(/^(\/\/[^\n]*\n)+/g, '');
    // Clean up extra whitespace
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
}

/**
 * Extract model names from schema content
 */
function extractModelNames(content: string): Set<string> {
    const modelRegex = /model\s+(\w+)\s*\{/g;
    const models = new Set<string>();
    let match;
    while ((match = modelRegex.exec(content)) !== null) {
        models.add(match[1]);
    }
    return models;
}

/**
 * Remove specific models from schema content
 */
function removeModels(content: string, modelNames: Set<string>): string {
    let result = content;
    for (const modelName of modelNames) {
        // Match model block including any preceding comments
        const modelRegex = new RegExp(`(///[^\\n]*\\n)*model\\s+${modelName}\\s*\\{[^}]*\\}`, 'gs');
        result = result.replace(modelRegex, '');
    }
    // Clean up extra whitespace
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
}

/**
 * Read a feature schema from its package
 */
async function readFeatureSchema(feature: FeatureSchemaDefinition, workspaceRoot: string): Promise<string> {
    // Extract feature name from package name or featureId
    const featureName = feature.featureId;

    // Try multiple paths to find the schema
    const possiblePaths = [
        // Workspace path (monorepo) - feature-{name} pattern
        path.join(workspaceRoot, 'packages', `feature-${featureName}`, feature.schemaPath),
        // Workspace path (monorepo) - direct name
        path.join(workspaceRoot, 'packages', featureName, feature.schemaPath),
        // node_modules path
        path.join(workspaceRoot, 'node_modules', feature.packageName, feature.schemaPath),
    ];

    for (const schemaPath of possiblePaths) {
        if (existsSync(schemaPath)) {
            return readFile(schemaPath, 'utf8');
        }
    }

    throw new Error(`Feature schema "${feature.featureId}" not found. Tried:\n${possiblePaths.join('\n')}`);
}

/**
 * Read app-specific schema
 */
async function readAppSchema(appDir: string, appSchemaPath: string): Promise<string | null> {
    const fullPath = path.join(appDir, appSchemaPath);

    if (!existsSync(fullPath)) {
        return null;
    }

    return readFile(fullPath, 'utf8');
}

// ============================================================
// MAIN CONCATENATION FUNCTION
// ============================================================

export interface ConcatenateOptions {
    /** App directory (where db.config.ts is located) */
    appDir: string;
    /** Workspace root directory */
    workspaceRoot?: string;
    /** Skip prisma generate after concatenation */
    skipGenerate?: boolean;
    /** Verbose logging */
    verbose?: boolean;
}

export interface ConcatenateResult {
    outputPath: string;
    schemaContent: string;
    transformations: string[];
    features: string[];
}

/**
 * Concatenate Prisma schemas for an app based on its configuration
 */
export async function concatenateAppSchema(
    config: AppDbConfig,
    options: ConcatenateOptions,
): Promise<ConcatenateResult> {
    const { appDir, workspaceRoot = path.resolve(appDir, '../..'), verbose = false } = options;

    const log = verbose ? console.log : () => {};

    // Resolve configuration defaults
    const dbProvider = config.dbProvider ?? 'd1';
    const features = config.features ?? [];
    const appSchemaPath = config.appSchemaPath ?? DEFAULT_APP_SCHEMA_PATH;
    const outputSchemaPath = config.outputSchemaPath ?? DEFAULT_OUTPUT_SCHEMA_PATH;
    const databaseUrlEnvVar = config.databaseUrlEnvVar ?? 'DATABASE_URL';
    const previewFeatures = config.generator?.previewFeatures ?? ['driverAdapters'];

    const allTransformations: string[] = [];
    const schemaParts: string[] = [];

    log(`\n🔧 Generating schema for app: ${config.appId}`);
    log(`   Provider: ${dbProvider}`);

    // 1. Generate generator/datasource block
    const generatorDatasource = generateBaseSchema(dbProvider, databaseUrlEnvVar, previewFeatures);
    schemaParts.push(generatorDatasource);

    // 2. Collect all feature schemas first to determine model replacements
    const featureNames: string[] = [];
    const featureSchemaContents: { featureId: string; content: string }[] = [];
    const featureModelNames = new Set<string>();

    if (features.length > 0) {
        const registry = getFeatureRegistry();

        // Check if features are registered
        const unregistered = features.filter((f: string) => !registry.has(f));
        if (unregistered.length > 0) {
            log(`   ⚠️  Unregistered features (skipping): ${unregistered.join(', ')}`);
        }

        // Only resolve registered features
        const registeredFeatures = features.filter((f: string) => registry.has(f));
        if (registeredFeatures.length > 0) {
            const resolvedFeatures = registry.resolve(registeredFeatures);

            log(`   Features: ${resolvedFeatures.map((f: FeatureSchemaDefinition) => f.featureId).join(', ')}`);

            for (const feature of resolvedFeatures) {
                try {
                    const content = await readFeatureSchema(feature, workspaceRoot);
                    const { content: transformed, transformations } = transformSchemaForProvider(content, dbProvider);

                    featureSchemaContents.push({
                        featureId: feature.featureId,
                        content: transformed.trim(),
                    });
                    allTransformations.push(...transformations);
                    featureNames.push(feature.featureId);

                    // Track models defined in features
                    const models = extractModelNames(transformed);
                    for (const model of models) {
                        featureModelNames.add(model);
                    }
                } catch (error) {
                    log(`   ⚠️  Failed to load feature "${feature.featureId}": ${(error as Error).message}`);
                }
            }
        }
    }

    // 3. Add base schema (with models that are replaced by features removed)
    const baseSchemaContent = await readBaseSchema(workspaceRoot);
    const { content: transformedBase, transformations: baseTransformations } = transformSchemaForProvider(
        baseSchemaContent,
        dbProvider,
    );
    allTransformations.push(...baseTransformations);

    // Remove models from base that are redefined in features
    const filteredBase = removeModels(transformedBase, featureModelNames);
    if (filteredBase.trim()) {
        schemaParts.push(`\n// ---- Base: @ottabase/db ----\n${filteredBase}`);
    }

    // 4. Add feature schemas
    for (const { featureId, content } of featureSchemaContents) {
        schemaParts.push(`\n// ---- Feature: ${featureId} ----\n${content}`);
    }

    // 4. Add app-specific schema
    const appSchema = await readAppSchema(appDir, appSchemaPath);
    if (appSchema) {
        const { content: transformed, transformations } = transformSchemaForProvider(appSchema, dbProvider);

        schemaParts.push(`\n// ---- App: ${config.appId} ----\n${transformed.trim()}`);
        allTransformations.push(...transformations);
        log(`   App schema: ${appSchemaPath}`);
    }

    // 5. Combine all parts
    const timestamp = new Date().toISOString();
    const header = `// ============================================================
// AUTO-GENERATED PRISMA SCHEMA
// ============================================================
// App: ${config.appId}
// Provider: ${dbProvider}
// Generated: ${timestamp}
//
// DO NOT EDIT THIS FILE DIRECTLY
// Edit source schemas and run: pnpm db:generate
// ============================================================
`;

    const schemaContent = header + schemaParts.join('\n\n') + '\n';

    // 6. Write output
    const outputPath = path.join(appDir, outputSchemaPath);
    const outputDir = path.dirname(outputPath);

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, schemaContent, 'utf8');

    log(`\n✅ Schema generated: ${outputPath}`);

    if (allTransformations.length > 0) {
        const uniqueTransformations = [...new Set(allTransformations)];
        log(`   Transformations applied:`);
        for (const t of uniqueTransformations) {
            log(`     - ${t}`);
        }
    }

    return {
        outputPath,
        schemaContent,
        transformations: allTransformations,
        features: featureNames,
    };
}
