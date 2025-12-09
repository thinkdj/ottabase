import path from 'path';
import { pathToFileURL } from 'url';
import type { MigrateConfig } from './types';

export interface AppDbConfig {
  appId: string;
  dbProvider: 'd1' | 'sqlite' | 'postgresql';
  d1Database?: string;
  wranglerConfig?: string;
  migrations?: MigrateConfig;
}

/**
 * Load db.config.ts from the application directory
 */
export async function loadConfig(appDir: string = process.cwd()): Promise<AppDbConfig> {
  const configPath = path.resolve(appDir, 'db.config.ts');

  try {
    // Use dynamic import with file:// protocol for Windows compatibility
    const fileUrl = pathToFileURL(configPath).href;
    const module = await import(fileUrl);
    const config = module.default;

    if (!config) {
      throw new Error('db.config.ts must export a default configuration');
    }

    if (!config.migrations) {
      throw new Error('db.config.ts must include a migrations configuration');
    }

    return config;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        `Could not find db.config.ts in ${appDir}. Make sure you're running this command from the app directory.`
      );
    }
    throw error;
  }
}

/**
 * Get migration configuration from the loaded config
 */
export async function getMigrateConfig(appDir: string = process.cwd()): Promise<MigrateConfig> {
  const config = await loadConfig(appDir);

  if (!config.migrations) {
    throw new Error('No migrations configuration found in db.config.ts');
  }

  return config.migrations;
}

/**
 * Get D1 database name from config
 */
export async function getD1Database(appDir: string = process.cwd()): Promise<string> {
  const config = await loadConfig(appDir);

  if (!config.d1Database) {
    throw new Error('No d1Database specified in db.config.ts');
  }

  return config.d1Database;
}

/**
 * Get wrangler config path
 */
export async function getWranglerConfig(appDir: string = process.cwd()): Promise<string> {
  const config = await loadConfig(appDir);
  return config.wranglerConfig || 'wrangler.jsonc';
}
