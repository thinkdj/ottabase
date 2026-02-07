// ============================================================
// @ottabase/scripts - D1 Migration Executor
// ============================================================
//
// Executes SQL migrations on Cloudflare D1 databases using wrangler CLI.
// Provides validation, error handling, and status tracking.
//
// ============================================================

import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// ============================================================
// TYPES
// ============================================================

export interface D1ExecutionOptions {
    /** Path to the migration SQL file or directory */
    migrationPath: string;

    /** D1 database binding name (e.g., "DB") */
    database: string;

    /** Execute on remote D1 (production) instead of local */
    remote?: boolean;

    /** Path to wrangler config file (default: "wrangler.toml" or "wrangler.jsonc") */
    wranglerConfig?: string;

    /** Working directory for command execution */
    cwd?: string;

    /** Show verbose output */
    verbose?: boolean;
}

export interface D1ValidationResult {
    valid: boolean;
    database?: string;
    databaseId?: string;
    error?: string;
}

export interface MigrationStatus {
    name: string;
    path: string;
    applied: boolean;
    appliedAt?: Date;
}

// ============================================================
// WRANGLER CONFIG VALIDATION
// ============================================================

/**
 * Find wrangler configuration file
 */
function findWranglerConfig(cwd: string, configPath?: string): string | null {
    if (configPath) {
        const fullPath = path.join(cwd, configPath);
        return existsSync(fullPath) ? fullPath : null;
    }

    // Try common config file names
    const candidates = ['wrangler.toml', 'wrangler.jsonc', 'wrangler.json'];

    for (const candidate of candidates) {
        const fullPath = path.join(cwd, candidate);
        if (existsSync(fullPath)) {
            return fullPath;
        }
    }

    return null;
}

/**
 * Parse wrangler.toml to find D1 database configuration
 */
function parseWranglerToml(configPath: string, database: string): D1ValidationResult {
    try {
        const content = readFileSync(configPath, 'utf8');

        // Simple TOML parsing for d1_databases section
        // Format: [[d1_databases]]
        //         binding = "DB"
        //         database_name = "my-db"
        //         database_id = "xxx"

        const lines = content.split('\n');
        let inD1Section = false;
        let currentBinding = '';
        let currentDatabaseName = '';
        let currentDatabaseId = '';

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === '[[d1_databases]]') {
                // Save previous section if it matches
                if (currentBinding === database) {
                    return {
                        valid: true,
                        database: currentDatabaseName,
                        databaseId: currentDatabaseId,
                    };
                }
                // Start new section
                inD1Section = true;
                currentBinding = '';
                currentDatabaseName = '';
                currentDatabaseId = '';
                continue;
            }

            if (inD1Section) {
                // Check for new section start
                if (trimmed.startsWith('[[') || trimmed.startsWith('[')) {
                    inD1Section = false;
                    continue;
                }

                // Parse binding
                const bindingMatch = trimmed.match(/binding\s*=\s*["']([^"']+)["']/);
                if (bindingMatch) {
                    currentBinding = bindingMatch[1];
                }

                // Parse database_name
                const nameMatch = trimmed.match(/database_name\s*=\s*["']([^"']+)["']/);
                if (nameMatch) {
                    currentDatabaseName = nameMatch[1];
                }

                // Parse database_id
                const idMatch = trimmed.match(/database_id\s*=\s*["']([^"']+)["']/);
                if (idMatch) {
                    currentDatabaseId = idMatch[1];
                }
            }
        }

        // Check last section
        if (currentBinding === database) {
            return {
                valid: true,
                database: currentDatabaseName,
                databaseId: currentDatabaseId,
            };
        }

        return {
            valid: false,
            error: `D1 binding "${database}" not found in ${path.basename(configPath)}`,
        };
    } catch (error) {
        return {
            valid: false,
            error: `Failed to parse wrangler config: ${(error as Error).message}`,
        };
    }
}

/**
 * Validate D1 database binding configuration
 */
export function validateD1Binding(database: string, cwd: string, wranglerConfig?: string): D1ValidationResult {
    // Find wrangler config
    const configPath = findWranglerConfig(cwd, wranglerConfig);

    if (!configPath) {
        return {
            valid: false,
            error: 'No wrangler configuration file found. Create wrangler.toml or wrangler.jsonc',
        };
    }

    // Parse and validate
    return parseWranglerToml(configPath, database);
}

// ============================================================
// MIGRATION EXECUTION
// ============================================================

/**
 * Execute SQL migration on D1 database using wrangler
 */
export async function executeD1Migration(options: D1ExecutionOptions): Promise<void> {
    const { migrationPath, database, remote = false, wranglerConfig, cwd = process.cwd(), verbose = false } = options;

    // Validate D1 binding
    const validation = validateD1Binding(database, cwd, wranglerConfig);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Resolve migration file path
    let sqlFilePath: string;

    if (existsSync(migrationPath)) {
        const stats = require('fs').statSync(migrationPath);
        if (stats.isDirectory()) {
            // Look for migration.sql in directory
            sqlFilePath = path.join(migrationPath, 'migration.sql');
            if (!existsSync(sqlFilePath)) {
                throw new Error(`No migration.sql found in directory: ${migrationPath}`);
            }
        } else {
            sqlFilePath = migrationPath;
        }
    } else {
        throw new Error(`Migration path not found: ${migrationPath}`);
    }

    // Build wrangler command
    const args = ['d1', 'execute', database, '--file', sqlFilePath];

    if (remote) {
        args.push('--remote');
    }

    if (wranglerConfig) {
        args.push('--config', wranglerConfig);
    }

    if (verbose) {
        console.log(`\n🔄 Executing: wrangler ${args.join(' ')}`);
        console.log(`   Database: ${validation.database || database}`);
        console.log(`   Environment: ${remote ? 'Remote (Production)' : 'Local (Dev)'}`);
    }

    // Execute wrangler command
    return new Promise((resolve, reject) => {
        const child = spawn('wrangler', args, {
            cwd,
            stdio: verbose ? 'inherit' : 'pipe',
            shell: true,
        });

        let output = '';
        let errorOutput = '';

        if (!verbose) {
            child.stdout?.on('data', (data) => {
                output += data.toString();
            });

            child.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
        }

        child.on('error', (error) => {
            reject(
                new Error(
                    `Failed to execute wrangler: ${error.message}\n` +
                        'Make sure wrangler is installed: npm install -g wrangler',
                ),
            );
        });

        child.on('close', (code) => {
            if (code === 0) {
                if (verbose) {
                    console.log('✅ Migration executed successfully');
                }
                resolve();
            } else {
                const errorMsg = errorOutput || output || 'Unknown error';
                reject(new Error(`Migration execution failed (exit code ${code}):\n${errorMsg}`));
            }
        });
    });
}

/**
 * Check if wrangler CLI is available
 */
export function isWranglerAvailable(): boolean {
    try {
        execSync('wrangler --version', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get wrangler version
 */
export function getWranglerVersion(): string | null {
    try {
        const output = execSync('wrangler --version', {
            encoding: 'utf8',
            stdio: 'pipe',
        });
        return output.trim();
    } catch {
        return null;
    }
}

// ============================================================
// MIGRATION STATUS
// ============================================================

interface AppliedMigration {
    migration_name: string;
    finished_at: string | null;
}

/**
 * Query D1 database using wrangler and return parsed JSON results.
 * Uses `wrangler d1 execute --command --json` to run an inline SQL query.
 */
function queryD1(database: string, sql: string, cwd: string, remote: boolean): Promise<AppliedMigration[]> {
    return new Promise((resolve, reject) => {
        const args = ['d1', 'execute', database, '--command', sql, '--json'];
        if (remote) {
            args.push('--remote');
        }

        const child = spawn('wrangler', args, {
            cwd,
            stdio: 'pipe',
            shell: true,
        });

        let output = '';
        let errorOutput = '';

        child.stdout?.on('data', (data) => {
            output += data.toString();
        });

        child.stderr?.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('error', (error) => {
            reject(new Error(`Failed to query D1: ${error.message}`));
        });

        child.on('close', (code) => {
            if (code !== 0) {
                // Table may not exist yet — this is not a fatal error
                resolve([]);
                return;
            }

            try {
                // wrangler d1 execute --json returns an array of result sets
                // e.g. [{ results: [...], success: true, ... }]
                const parsed = JSON.parse(output);
                const results = Array.isArray(parsed) && parsed.length > 0 ? parsed[0].results ?? [] : [];
                resolve(results);
            } catch {
                // If JSON parsing fails, return empty (table may not exist)
                resolve([]);
            }
        });
    });
}

/**
 * Get list of migration files from prisma/migrations directory
 */
export function getMigrationFiles(
    cwd: string,
    appliedMigrations?: Map<string, Date | undefined>,
): MigrationStatus[] {
    const migrationsDir = path.join(cwd, 'prisma/migrations');

    if (!existsSync(migrationsDir)) {
        return [];
    }

    const fs = require('fs');
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });

    return entries
        .filter((entry: any) => entry.isDirectory())
        .map((entry: any) => {
            const migrationPath = path.join(migrationsDir, entry.name);
            const isApplied = appliedMigrations?.has(entry.name) ?? false;
            const appliedAt = appliedMigrations?.get(entry.name);

            return {
                name: entry.name,
                path: migrationPath,
                applied: isApplied,
                appliedAt,
            };
        })
        .sort((a: MigrationStatus, b: MigrationStatus) => a.name.localeCompare(b.name));
}

/**
 * Get migration status from D1 database.
 * Queries the _prisma_migrations table to determine which local
 * migrations have already been applied.
 */
export async function getD1MigrationStatus(database: string, cwd: string, remote = false): Promise<MigrationStatus[]> {
    // Query D1 for applied migrations from the _prisma_migrations table
    const appliedRows = await queryD1(
        database,
        'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at ASC',
        cwd,
        remote,
    );

    // Build a lookup map: migration name -> applied date
    const appliedMap = new Map<string, Date | undefined>();
    for (const row of appliedRows) {
        const appliedAt = row.finished_at ? new Date(row.finished_at) : undefined;
        appliedMap.set(row.migration_name, appliedAt);
    }

    // Get local migration files with applied status merged in
    return getMigrationFiles(cwd, appliedMap);
}
