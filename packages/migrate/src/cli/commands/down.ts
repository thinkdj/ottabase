import chalk from 'chalk';
import prompts from 'prompts';
import { getMigrateConfig, getD1Database } from '../../config/loader';
import { createD1Executor } from '../../executor/D1Executor';
import { MigrationManager } from '../../core/MigrationManager';
import { Logger } from '../../utils/logger';

interface DownOptions {
  steps?: string | number;
  dryRun?: boolean;
}

export async function downCommand(options: DownOptions) {
  try {
    const config = await getMigrateConfig();
    const dbName = await getD1Database();
    const executor = createD1Executor(dbName, false);
    const manager = new MigrationManager(executor, config);

    // Initialize if needed
    await manager.initialize();

    // Parse steps
    const steps = typeof options.steps === 'string' ? parseInt(options.steps) : (options.steps || 1);

    // Get applied migrations
    const status = await manager.getStatus();
    const toRollback = status.applied.slice(-steps).reverse();

    if (toRollback.length === 0) {
      Logger.info('No migrations to rollback');
      return;
    }

    // Show what will be rolled back
    console.log();
    console.log(chalk.bold.red(`⚠️  Migrations to rollback (${toRollback.length}):`));
    console.log();

    toRollback.forEach((m, i) => {
      console.log(
        chalk.dim(`  ${i + 1}.`),
        chalk.yellow(m.name),
        chalk.dim(`(${m.feature})`)
      );
    });

    console.log();
    console.log(chalk.yellow('⚠️  Warning: Rolling back migrations may result in data loss!'));
    console.log();

    // Confirm unless dry-run
    if (!options.dryRun) {
      const response = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `Rollback ${toRollback.length} migration(s)?`,
        initial: false,
      });

      if (!response.confirm) {
        Logger.info('Cancelled');
        return;
      }
    }

    // Rollback migrations
    console.log();

    await manager.down({
      steps,
      dryRun: options.dryRun,
    });

    console.log();

    if (!options.dryRun) {
      Logger.success('Rollback completed successfully!');
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
