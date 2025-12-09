import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { MigrationDatabase } from '../core/StateManager';
import { Logger } from '../utils/logger';

/**
 * Executor for Cloudflare D1 databases using wrangler CLI
 */
export class D1Executor implements MigrationDatabase {
  constructor(
    private dbName: string,
    private isRemote: boolean = false
  ) {}

  /**
   * Execute a single SQL statement
   */
  async run(sql: string, params?: any[]): Promise<void> {
    // D1 doesn't support parameterized queries via wrangler CLI
    // so we need to execute the SQL directly
    if (params && params.length > 0) {
      // Simple parameter replacement (not safe for production, but ok for migrations)
      sql = this.replaceParams(sql, params);
    }

    await this.executeSQL(sql);
  }

  /**
   * Execute multiple SQL statements (batch)
   */
  async exec(sql: string): Promise<void> {
    await this.executeSQL(sql);
  }

  /**
   * Execute a query and return all results
   */
  async all(sql: string, params?: any[]): Promise<any[]> {
    if (params && params.length > 0) {
      sql = this.replaceParams(sql, params);
    }

    const result = await this.executeSQL(sql, true);

    try {
      // Parse JSON output from wrangler
      const parsed = JSON.parse(result);

      // Handle different wrangler output formats
      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (parsed.results && Array.isArray(parsed.results)) {
        return parsed.results;
      }

      if (parsed.success && parsed.results) {
        return parsed.results;
      }

      return [];
    } catch (error) {
      Logger.warn('Failed to parse query results, returning empty array');
      return [];
    }
  }

  /**
   * Execute SQL via wrangler CLI
   */
  private async executeSQL(sql: string, returnOutput: boolean = false): Promise<string> {
    // Create a temporary SQL file
    const tempFile = path.join(os.tmpdir(), `migration-${Date.now()}.sql`);

    try {
      await fs.writeFile(tempFile, sql, 'utf-8');

      // Build wrangler command
      const remoteFlag = this.isRemote ? '--remote' : '--local';
      const command = `wrangler d1 execute ${this.dbName} ${remoteFlag} --file="${tempFile}"`;

      try {
        const result = execSync(command, {
          encoding: 'utf-8',
          stdio: returnOutput ? 'pipe' : 'inherit',
        });

        return result || '';
      } catch (error: any) {
        Logger.error(`Failed to execute SQL via wrangler`);
        if (error.stderr) {
          Logger.error(error.stderr);
        }
        throw new Error(`SQL execution failed: ${error.message}`);
      }
    } finally {
      // Cleanup temp file
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Simple parameter replacement (not SQL-injection safe, only use for migrations)
   */
  private replaceParams(sql: string, params: any[]): string {
    let result = sql;
    params.forEach((param, index) => {
      const value = typeof param === 'string' ? `'${param}'` : String(param);
      result = result.replace('?', value);
    });
    return result;
  }

  /**
   * Execute a migration file directly
   */
  async executeFile(filePath: string): Promise<void> {
    const remoteFlag = this.isRemote ? '--remote' : '--local';
    const command = `wrangler d1 execute ${this.dbName} ${remoteFlag} --file="${filePath}"`;

    try {
      execSync(command, { stdio: 'inherit' });
    } catch (error: any) {
      Logger.error(`Failed to execute migration file: ${filePath}`);
      throw new Error(`Migration file execution failed: ${error.message}`);
    }
  }
}

/**
 * Factory function to create D1 executor
 */
export function createD1Executor(dbName: string, remote: boolean = false): D1Executor {
  return new D1Executor(dbName, remote);
}
