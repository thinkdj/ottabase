import chalk from 'chalk';
import prompts from 'prompts';
import { getMigrateConfig, getD1Database } from '../../config/loader';
import { createD1Executor } from '../../executor/D1Executor';
import { MigrationManager } from '../../core/MigrationManager';
import { Logger } from '../../utils/logger';

interface CreateOptions {
  name?: string;
  feature?: string;
  models?: string[];
}

export async function createCommand(options: CreateOptions) {
  try {
    const config = await getMigrateConfig();
    const dbName = await getD1Database();
    const executor = createD1Executor(dbName, false);
    const manager = new MigrationManager(executor, config);

    // Initialize if needed
    await manager.initialize();

    // Collect input
    let name = options.name;
    let feature = options.feature;
    const models = options.models;

    // Interactive prompts if not provided
    if (!name) {
      const response = await prompts({
        type: 'text',
        name: 'name',
        message: 'Migration name:',
        validate: (value) => (value ? true : 'Name is required'),
      });

      if (!response.name) {
        Logger.error('Migration name is required');
        process.exit(1);
      }

      name = response.name;
    }

    if (!feature) {
      const response = await prompts({
        type: 'select',
        name: 'feature',
        message: 'Select feature:',
        choices: [
          { title: 'core - Core models', value: 'core' },
          { title: 'auth - Authentication', value: 'auth' },
          { title: 'app - Application models', value: 'app' },
          { title: 'other - Custom feature', value: 'other' },
        ],
      });

      feature = response.feature;
    }

    if (!feature) {
      feature = 'app';
    }

    // Ensure we have a name (shouldn't reach here without one, but TypeScript needs the check)
    if (!name) {
      Logger.error('Migration name is required');
      process.exit(1);
    }

    // Create migration
    console.log();
    Logger.info(`Creating migration: ${name} (feature: ${feature})`);
    console.log();

    const migrationPath = await manager.createMigration({
      name,
      feature,
      models,
    });

    console.log();
    Logger.success('Migration created successfully!');
    console.log();
    console.log(chalk.dim('  File:'), chalk.cyan(migrationPath));
    console.log();
    console.log(chalk.dim('  Next steps:'));
    console.log(chalk.dim('    1. Review the generated migration file'));
    console.log(chalk.dim('    2. Run'), chalk.cyan('migrate up'), chalk.dim('to apply'));
    console.log();
  } catch (error: any) {
    Logger.error(error.message);
    if (error.stack) {
      Logger.dim(error.stack);
    }
    process.exit(1);
  }
}
