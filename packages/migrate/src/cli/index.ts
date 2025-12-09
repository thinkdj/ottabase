#!/usr/bin/env node

import { Command } from 'commander';
import { statusCommand } from './commands/status';
import { createCommand } from './commands/create';
import { upCommand } from './commands/up';
import { downCommand } from './commands/down';

const program = new Command();

program
  .name('migrate')
  .description('Drizzle migration system for Ottabase with Cloudflare D1 support')
  .version('0.1.0');

// Status command
program
  .command('status')
  .description('Show migration status dashboard')
  .option('-f, --feature <feature>', 'Filter by feature')
  .action(statusCommand);

// Create command
program
  .command('create')
  .description('Create a new migration')
  .option('-n, --name <name>', 'Migration name')
  .option('-f, --feature <feature>', 'Feature name')
  .option('-m, --models <models...>', 'Specific models to include')
  .action(createCommand);

// Up command (apply migrations)
program
  .command('up')
  .description('Apply pending migrations')
  .option('-s, --steps <number>', 'Number of migrations to apply', parseInt)
  .option('-f, --feature <feature>', 'Apply only specific feature')
  .option('--remote', 'Apply to remote D1 (default: local)')
  .option('--dry-run', 'Preview without executing')
  .action(upCommand);

// Down command (rollback migrations)
program
  .command('down')
  .description('Rollback migrations')
  .option('-s, --steps <number>', 'Number to rollback', '1')
  .option('--dry-run', 'Preview without executing')
  .action(downCommand);

// Reset command (rollback all)
program
  .command('reset')
  .description('Reset database (rollback all migrations)')
  .option('--force', 'Skip confirmation')
  .action(async (options) => {
    const chalk = await import('chalk');

    if (!options.force) {
      console.log(chalk.default.red('⚠️  This will rollback ALL migrations!'));
      console.log(chalk.default.yellow('Use --force to confirm'));
      process.exit(1);
    }

    // Import and execute reset
    const { getMigrateConfig, getD1Database } = await import('../config/loader');
    const { createD1Executor } = await import('../executor/D1Executor');
    const { MigrationManager } = await import('../core/MigrationManager');

    try {
      const config = await getMigrateConfig();
      const dbName = await getD1Database();
      const executor = createD1Executor(dbName, false);
      const manager = new MigrationManager(executor, config);

      await manager.initialize();
      await manager.reset();
    } catch (error: any) {
      console.error(chalk.default.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Init command (initialize migration system)
program
  .command('init')
  .description('Initialize migration system (create migration tables)')
  .action(async () => {
    const chalk = await import('chalk');
    const { getMigrateConfig, getD1Database } = await import('../config/loader');
    const { createD1Executor } = await import('../executor/D1Executor');
    const { MigrationManager } = await import('../core/MigrationManager');
    const { Logger } = await import('../utils/logger');

    try {
      const config = await getMigrateConfig();
      const dbName = await getD1Database();
      const executor = createD1Executor(dbName, false);
      const manager = new MigrationManager(executor, config);

      await manager.initialize();
      Logger.success('Migration system initialized');
    } catch (error: any) {
      console.error(chalk.default.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
