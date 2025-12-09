import type { MigrateConfig } from '../config/types';
import type { MigrationDatabase } from './StateManager';

/**
 * Manages migration locks to prevent concurrent migrations
 */
export class LockManager {
  constructor(
    private db: MigrationDatabase,
    private config: MigrateConfig
  ) {}

  /**
   * Ensure the lock table exists
   */
  async ensureLockTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.config.lockTable} (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        locked_at INTEGER NOT NULL,
        locked_by TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  /**
   * Try to acquire the migration lock
   * Returns true if lock was acquired, false if already locked
   */
  async acquireLock(lockId: string = 'migration'): Promise<boolean> {
    const now = Date.now();
    const expiresAt = now + this.config.lockTimeout;

    try {
      // Try to insert a new lock
      await this.db.run(
        `INSERT INTO ${this.config.lockTable} (id, locked_at, locked_by, expires_at)
         VALUES (1, ?, ?, ?)`,
        [now, lockId, expiresAt]
      );

      return true;
    } catch (error) {
      // Lock already exists, check if it's expired
      const existingLock = await this.db.all(
        `SELECT expires_at FROM ${this.config.lockTable} WHERE id = 1`
      );

      if (existingLock.length === 0) {
        // No lock exists, retry acquiring
        return this.acquireLock(lockId);
      }

      const lock = existingLock[0];

      if (lock.expires_at < now) {
        // Lock has expired, force release and retry
        await this.releaseLock();
        return this.acquireLock(lockId);
      }

      // Lock is still active
      return false;
    }
  }

  /**
   * Release the migration lock
   */
  async releaseLock(): Promise<void> {
    await this.db.run(`DELETE FROM ${this.config.lockTable} WHERE id = 1`);
  }

  /**
   * Check if a lock is currently held
   */
  async isLocked(): Promise<boolean> {
    const result = await this.db.all(
      `SELECT expires_at FROM ${this.config.lockTable} WHERE id = 1`
    );

    if (result.length === 0) {
      return false;
    }

    const now = Date.now();
    return result[0].expires_at > now;
  }

  /**
   * Get lock information
   */
  async getLockInfo(): Promise<{
    locked: boolean;
    lockedBy?: string;
    lockedAt?: Date;
    expiresAt?: Date;
  } | null> {
    const result = await this.db.all(
      `SELECT * FROM ${this.config.lockTable} WHERE id = 1`
    );

    if (result.length === 0) {
      return { locked: false };
    }

    const lock = result[0];
    const now = Date.now();

    if (lock.expires_at < now) {
      // Lock has expired
      return { locked: false };
    }

    return {
      locked: true,
      lockedBy: lock.locked_by,
      lockedAt: new Date(lock.locked_at),
      expiresAt: new Date(lock.expires_at),
    };
  }

  /**
   * Force release a lock (use with caution)
   */
  async forceRelease(): Promise<void> {
    await this.releaseLock();
  }

  /**
   * Extend the lock timeout
   */
  async extendLock(additionalTime: number = 300000): Promise<void> {
    const now = Date.now();
    const newExpiresAt = now + additionalTime;

    await this.db.run(
      `UPDATE ${this.config.lockTable}
       SET expires_at = ?
       WHERE id = 1`,
      [newExpiresAt]
    );
  }
}
