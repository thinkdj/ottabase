// ============================================================
// @ottabase/logger - Audit Database Transport
// ============================================================

import type { LogEntry, Transport } from './types';

/**
 * Database transport for audit logging
 * Writes logs to the AuditLog model for persistence
 *
 * @example
 * ```typescript
 * import { createLogger } from '@ottabase/logger';
 * import { AuditDbTransport } from '@ottabase/logger/audit-transport';
 *
 * const logger = createLogger({
 *   transports: [
 *     new AuditDbTransport({
 *       getUserContext: () => ({ userId: 'user-123', userEmail: 'user@example.com' }),
 *       getRequestContext: () => ({ ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0' })
 *     })
 *   ]
 * });
 *
 * // Log an action
 * logger.info('User updated', {
 *   action: 'update',
 *   resourceType: 'user',
 *   resourceId: 'user-123',
 *   changes: { name: { from: 'Old', to: 'New' } }
 * });
 * ```
 */
export class AuditDbTransport implements Transport {
    private getUserContext: () =>
        | { userId?: string; userEmail?: string }
        | Promise<{ userId?: string; userEmail?: string }>;
    private getRequestContext: () =>
        | { ipAddress?: string; userAgent?: string }
        | Promise<{ ipAddress?: string; userAgent?: string }>;
    private minLevel: number;
    private buffer: LogEntry[] = [];
    private bufferSize: number;
    private flushInterval: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private flushing: boolean = false;

    constructor(
        options: {
            getUserContext?: () =>
                | { userId?: string; userEmail?: string }
                | Promise<{ userId?: string; userEmail?: string }>;
            getRequestContext?: () =>
                | { ipAddress?: string; userAgent?: string }
                | Promise<{ ipAddress?: string; userAgent?: string }>;
            minLevel?: number;
            bufferSize?: number;
            flushInterval?: number;
        } = {},
    ) {
        this.getUserContext = options.getUserContext || (() => ({}));
        this.getRequestContext = options.getRequestContext || (() => ({}));
        this.minLevel = options.minLevel ?? 1; // INFO level by default
        this.bufferSize = options.bufferSize || 10;
        this.flushInterval = options.flushInterval || 5000;

        this.startTimer();
    }

    private startTimer(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.timer = setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    log(entry: LogEntry): void {
        // Only log entries at or above the minimum level
        if (entry.level < this.minLevel) {
            return;
        }

        this.buffer.push(entry);

        // Flush if buffer is full
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
    }

    async flush(): Promise<void> {
        if (this.flushing || this.buffer.length === 0) {
            return;
        }

        this.flushing = true;
        const entries = [...this.buffer];
        this.buffer = [];

        try {
            // Check global connection registry (stored on globalThis by ottaorm)
            const globalConnections = (globalThis as any).__OTTAORM_CONNECTIONS__ as Map<string, any> | undefined;
            if (!globalConnections || !globalConnections.has('default')) {
                // No DB configured (common in tests) — skip writing without noisy errors
                this.flushing = false;
                return;
            }

            // Dynamic import using a computed string so TypeScript won't statically
            // resolve the module during d.ts generation (avoids rootDir errors).
            const moduleName = '@' + 'ottabase' + '/ottaorm';
            const ottaorm = (await import(/* @vite-ignore */ moduleName)) as any;
            const { AuditLog } = ottaorm;

            const userContext = await this.getUserContext();
            const requestContext = await this.getRequestContext();

            for (const entry of entries) {
                try {
                    await AuditLog.log({
                        userId: userContext.userId,
                        userEmail: userContext.userEmail,
                        action: (entry.context?.action as string) || 'log',
                        resourceType: (entry.context?.resourceType as string) || 'system',
                        resourceId: entry.context?.resourceId as string | undefined,
                        changes: entry.context?.changes as Record<string, any> | undefined,
                        metadata: {
                            message: entry.message,
                            level: entry.level,
                            levelName: this.getLevelName(entry.level),
                            timestamp: entry.timestamp,
                            context: entry.context,
                            error: entry.error,
                        },
                        ipAddress: requestContext.ipAddress,
                        userAgent: requestContext.userAgent,
                        status: entry.level >= 3 ? 'error' : 'success',
                        errorMessage: entry.error?.message,
                    });
                } catch (error) {
                    // If logging fails, log to console to avoid losing the log
                    console.error('Failed to write audit log to database:', error);
                }
            }
        } catch (error) {
            console.error('Failed to import AuditLog model:', error);
            // Re-add entries to buffer to retry later
            this.buffer.unshift(...entries);
        } finally {
            this.flushing = false;
        }
    }

    async close(): Promise<void> {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.flush();
    }

    private getLevelName(level: number): string {
        switch (level) {
            case 0:
                return 'DEBUG';
            case 1:
                return 'INFO';
            case 2:
                return 'WARN';
            case 3:
                return 'ERROR';
            default:
                return 'UNKNOWN';
        }
    }
}
