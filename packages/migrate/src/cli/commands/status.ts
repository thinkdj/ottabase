import chalk from 'chalk';
import { getMigrateConfig, getD1Database } from '../../config/loader';
import { createD1Executor } from '../../executor/D1Executor';
import { MigrationManager } from '../../core/MigrationManager';
import { Logger } from '../../utils/logger';

interface StatusOptions {
  feature?: string;
}

export async function statusCommand(options: StatusOptions) {
  try {
    const config = await getMigrateConfig();
    const dbName = await getD1Database();
    const executor = createD1Executor(dbName, false);
    const manager = new MigrationManager(executor, config);

    // Initialize if needed
    await manager.initialize();

    // Get status
    const status = await manager.getStatus();

    // Filter by feature if specified
    let applied = status.applied;
    let pending = status.pending;

    if (options.feature) {
      applied = applied.filter((m) => m.feature === options.feature);
      pending = pending.filter((m) => m.feature === options.feature);
    }

    // Print header
    console.log();
    console.log(chalk.bold('📊 Migration Status'));
    console.log(chalk.dim('━'.repeat(80)));
    console.log();

    // Print summary
    console.log(
      chalk.white('Total:'),
      chalk.cyan(applied.length + pending.length),
      chalk.dim('|'),
      chalk.green('✓ Applied:'),
      chalk.green(applied.length),
      chalk.dim('|'),
      chalk.yellow('○ Pending:'),
      chalk.yellow(pending.length)
    );
    console.log();

    // Print migrations table
    if (applied.length === 0 && pending.length === 0) {
      Logger.info('No migrations found');
      return;
    }

    // Combine and sort
    const all = [
      ...applied.map((m) => ({
        name: m.name,
        feature: m.feature,
        status: '✓ Applied',
        date: new Date(m.executedAt).toLocaleString(),
        color: chalk.green,
      })),
      ...pending.map((m) => ({
        name: m.name,
        feature: m.feature,
        status: '○ Pending',
        date: '-',
        color: chalk.yellow,
      })),
    ];

    // Print table header
    console.log(
      chalk.bold(
        padRight('Name', 40),
        padRight('Feature', 15),
        padRight('Status', 12),
        'Date'
      )
    );
    console.log(chalk.dim('─'.repeat(80)));

    // Print rows
    all.forEach((row) => {
      console.log(
        padRight(row.name, 40),
        padRight(row.feature, 15),
        row.color(padRight(row.status, 12)),
        row.date
      );
    });

    console.log();
  } catch (error: any) {
    Logger.error(error.message);
    process.exit(1);
  }
}

function padRight(str: string, length: number): string {
  return str + ' '.repeat(Math.max(0, length - str.length));
}
