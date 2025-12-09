import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import type { MigrateConfig } from '../config/types';
import type { MigrationDatabase } from './StateManager';
import { StateManager, type MigrationRecord } from './StateManager';
import { LockManager } from './LockManager';
import { ModelDiscovery } from '../generator/ModelDiscovery';
import { DrizzleGenerator } from '../generator/DrizzleGenerator';
import { generateChecksum } from '../utils/checksum';
import { Logger } from '../utils/logger';

export interface PendingMigration {
  name: string;
  feature: string;
  filePath: string;
}

export interface MigrationStatus {
  pending: PendingMigration[];
  applied: MigrationRecord[];
  total: number;
}

export interface CreateMigrationOptions {
  name: string;
  feature?: string;
  models?: string[]; // Optional: specific models to include
}

export interface ApplyMigrationOptions {
  steps?: number;
  feature?: string;
  dryRun?: boolean;
}

export interface RollbackOptions {
  steps?: number;
  dryRun?: boolean;
}

/**
 * Main migration manager that orchestrates all migration operations
 */
export class MigrationManager {
  private stateManager: StateManager;
  private lockManager: LockManager;
  private discovery: ModelDiscovery;
  private generator: DrizzleGenerator;

  constructor(
    private db: MigrationDatabase,
    private config: MigrateConfig,
    private appDir: string = process.cwd()
  ) {
    this.stateManager = new StateManager(db, config);
    this.lockManager = new LockManager(db, config);
    this.discovery = new ModelDiscovery();
    this.generator = new DrizzleGenerator();
  }

  /**
   * Initialize the migration system (create tables, etc.)
   */
  async initialize(): Promise<void> {
    await this.stateManager.ensureTables();
    await this.lockManager.ensureLockTable();
    Logger.success('Migration system initialized');
  }

  /**
   * Create a new migration
   */
  async createMigration(options: CreateMigrationOptions): Promise<string> {
    Logger.info(`Creating migration: ${options.name}`);

    // 1. Discover models
    const allModels = await this.discovery.discover(this.config, this.appDir);

    // 2. Filter models
    let models = allModels;

    if (options.feature) {
      models = models.filter((m) => m.feature === options.feature);
      Logger.info(`Filtered to feature: ${options.feature} (${models.length} models)`);
    }

    if (options.models && options.models.length > 0) {
      models = models.filter((m) => options.models!.includes(m.name));
      Logger.info(`Filtered to models: ${options.models.join(', ')} (${models.length} models)`);
    }

    if (models.length === 0) {
      throw new Error('No models found to generate migration');
    }

    Logger.info(`Discovered ${models.length} models`);

    // 3. Generate migration
    const outputDir = path.resolve(this.appDir, this.config.migrationsPath);
    const migrationPath = await this.generator.generateMigration({
      models,
      name: options.name,
      feature: options.feature || 'app',
      outputDir,
    });

    return migrationPath;
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    const applied = await this.stateManager.getAppliedMigrations();
    const pending = await this.getPendingMigrations();

    return {
      applied,
      pending,
      total: applied.length + pending.length,
    };
  }

  /**
   * Get pending migrations (files that haven't been applied)
   */
  async getPendingMigrations(): Promise<PendingMigration[]> {
    const migrationsDir = path.resolve(this.appDir, this.config.migrationsPath);

    // Check if migrations directory exists
    try {
      await fs.access(migrationsDir);
    } catch {
      // Directory doesn't exist, no pending migrations
      return [];
    }

    // Read all migration files
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter((f) => f.endsWith('.ts') && !f.startsWith('.temp'))
      .sort();

    // Get applied migrations
    const applied = await this.stateManager.getAppliedMigrations();
    const appliedNames = new Set(applied.map((m) => m.name));

    // Find pending migrations
    const pending: PendingMigration[] = [];

    for (const file of migrationFiles) {
      const name = file.replace('.ts', '');

      if (!appliedNames.has(name)) {
        // Import the migration to get its feature
        const filePath = path.join(migrationsDir, file);
        try {
          const fileUrl = pathToFileURL(filePath).href;
          const migration = await import(fileUrl);
          pending.push({
            name,
            feature: migration.default?.feature || 'unknown',
            filePath,
          });
        } catch (error) {
          Logger.warn(`Failed to load migration ${file}: ${error}`);
        }
      }
    }

    return pending;
  }

  /**
   * Apply pending migrations
   */
  async up(options: ApplyMigrationOptions = {}): Promise<void> {
    // Acquire lock
    const locked = await this.lockManager.acquireLock('migration-up');
    if (!locked) {
      throw new Error('Another migration is in progress. Please wait or use --force to override.');
    }

    try {
      // Get pending migrations
      let pending = await this.getPendingMigrations();

      // Filter by feature if specified
      if (options.feature) {
        pending = pending.filter((m) => m.feature === options.feature);
      }

      // Limit by steps if specified
      if (options.steps) {
        pending = pending.slice(0, options.steps);
      }

      if (pending.length === 0) {
        Logger.info('No pending migrations to apply');
        return;
      }

      Logger.info(`Applying ${pending.length} migration(s)...`);

      // Apply each migration
      for (const migration of pending) {
        if (options.dryRun) {
          Logger.info(`[DRY RUN] Would apply: ${migration.name}`);
          continue;
        }

        await this.applyMigration(migration);
      }

      Logger.success(`Applied ${pending.length} migration(s)`);
    } finally {
      await this.lockManager.releaseLock();
    }
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(pending: PendingMigration): Promise<void> {
    const startTime = Date.now();
    Logger.info(`Applying: ${pending.name}...`);

    try {
      // Load the migration file
      const fileUrl = pathToFileURL(pending.filePath).href;
      const migration = await import(fileUrl);

      if (!migration.default || typeof migration.default.up !== 'function') {
        throw new Error(`Migration ${pending.name} does not export a valid up() function`);
      }

      // Read the file content for checksum
      const content = await fs.readFile(pending.filePath, 'utf-8');
      const checksum = generateChecksum(content);

      // Execute the migration
      await migration.default.up(this.db);

      const executionTime = Date.now() - startTime;

      // Record in database
      await this.stateManager.recordMigration({
        name: pending.name,
        feature: pending.feature,
        checksum,
        executedAt: Date.now(),
        executionTime,
        status: 'applied',
      });

      Logger.success(`Applied: ${pending.name} (${executionTime}ms)`);
    } catch (error) {
      Logger.error(`Failed to apply migration ${pending.name}`);
      if (error instanceof Error) {
        Logger.error(error.message);
      }

      // Mark as failed
      try {
        await this.stateManager.recordMigration({
          name: pending.name,
          feature: pending.feature,
          checksum: 'failed',
          executedAt: Date.now(),
          status: 'failed',
        });
      } catch {
        // Ignore errors when recording failure
      }

      throw error;
    }
  }

  /**
   * Rollback migrations
   */
  async down(options: RollbackOptions = {}): Promise<void> {
    const steps = options.steps || 1;

    // Acquire lock
    const locked = await this.lockManager.acquireLock('migration-down');
    if (!locked) {
      throw new Error('Another migration is in progress. Please wait or use --force to override.');
    }

    try {
      // Get applied migrations (latest first)
      const applied = await this.stateManager.getAppliedMigrations();
      const toRollback = applied.slice(-steps).reverse();

      if (toRollback.length === 0) {
        Logger.info('No migrations to rollback');
        return;
      }

      Logger.info(`Rolling back ${toRollback.length} migration(s)...`);

      for (const migration of toRollback) {
        if (options.dryRun) {
          Logger.info(`[DRY RUN] Would rollback: ${migration.name}`);
          continue;
        }

        await this.rollbackMigration(migration);
      }

      Logger.success(`Rolled back ${toRollback.length} migration(s)`);
    } finally {
      await this.lockManager.releaseLock();
    }
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(record: MigrationRecord): Promise<void> {
    Logger.info(`Rolling back: ${record.name}...`);

    try {
      // Load the migration file
      const migrationsDir = path.resolve(this.appDir, this.config.migrationsPath);
      const filePath = path.join(migrationsDir, `${record.name}.ts`);
      const fileUrl = pathToFileURL(filePath).href;
      const migration = await import(fileUrl);

      if (!migration.default || typeof migration.default.down !== 'function') {
        throw new Error(`Migration ${record.name} does not export a valid down() function`);
      }

      // Execute the down migration
      await migration.default.down(this.db);

      // Mark as rolled back
      await this.stateManager.markRolledBack(record.name);

      Logger.success(`Rolled back: ${record.name}`);
    } catch (error) {
      Logger.error(`Failed to rollback migration ${record.name}`);
      if (error instanceof Error) {
        Logger.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Reset database (rollback all migrations)
   */
  async reset(): Promise<void> {
    const applied = await this.stateManager.getAppliedMigrations();

    if (applied.length === 0) {
      Logger.info('No migrations to reset');
      return;
    }

    Logger.warn(`Resetting database (rolling back ${applied.length} migrations)...`);

    await this.down({ steps: applied.length });
  }

  /**
   * Get migration statistics
   */
  async getStats() {
    return await this.stateManager.getStats();
  }
}
