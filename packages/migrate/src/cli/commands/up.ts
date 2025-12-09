import chalk from 'chalk';
import prompts from 'prompts';
import { getMigrateConfig, getD1Database } from '../../config/loader';
import { createD1Executor } from '../../executor/D1Executor';
import { MigrationManager } from '../../core/MigrationManager';
import { Logger } from '../../utils/logger';

interface UpOptions {
  steps?: number;
  feature?: string;
  remote?: boolean;
  dryRun?: boolean;
}

export async function upCommand(options: UpOptions) {
  try {
    const config = await getMigrateConfig();
    const dbName = await getD1Database();

    // Ask about remote/local if not specified
    let isRemote = options.remote || false;

    if (!options.dryRun && !options.remote) {
      const response = await prompts({
        type: 'select',
        name: 'target',
        message: 'Apply migrations to:',
        choices: [
          { title: '💻 Local D1 (development)', value: 'local' },
          { title: '☁️  Remote D1 (production)', value: 'remote' },
        ],
      });

      isRemote = response.target === 'remote';
    }

    const executor = createD1Executor(dbName, isRemote);
    const manager = new MigrationManager(executor, config);

    // Initialize if needed
    await manager.initialize();

    // Get status
    const status = await manager.getStatus();
    let pending = status.pending;

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

    // Show what will be applied
    console.log();
    console.log(chalk.bold(`Migrations to apply (${pending.length}):`));
    console.log();

    pending.forEach((m, i) => {
      console.log(
        chalk.dim(`  ${i + 1}.`),
        chalk.cyan(m.name),
        chalk.dim(`(${m.feature})`)
      );
    });

    console.log();

    // Confirm unless dry-run
    if (!options.dryRun) {
      const response = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `Apply ${pending.length} migration(s) to ${isRemote ? 'REMOTE' : 'local'} database?`,
        initial: true,
      });

      if (!response.confirm) {
        Logger.info('Cancelled');
        return;
      }
    }

    // Apply migrations
    console.log();

    await manager.up({
      steps: options.steps,
      feature: options.feature,
      dryRun: options.dryRun,
    });

    console.log();

    if (!options.dryRun) {
      Logger.success('All migrations applied successfully!');
    } else {
      Logger.info('[DRY RUN] No changes were made');
    }

    console.log();
  } catch (error: any) {
    Logger.error(error.message);
    if (error.stack) {
      Logger.dim(error.stack);
    }
    process.exit(1);
  }
}
