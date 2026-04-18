import { createAutoLogger, FileTransport, HttpTransport, SentryTransport } from '@ottabase/logger';
import { simpleFormatter } from '@ottabase/logger/formatters';
import { logConfig } from '../config/log.config';

/**
 * Application logger instance
 *
 * Automatically detects the environment (server/client/worker)
 * and creates a logger with the appropriate configuration.
 *
 * Usage:
 * ```ts
 * import { logger } from '@/ottabase/utils/logger';
 *
 * logger.info('User logged in', { userId: 123 });
 * logger.error('Failed to save', error, { context: 'additional info' });
 * ```
 */
export const logger = createAutoLogger(logConfig, {
    // File transport factory (server-side only)
    file: (options) =>
        new FileTransport({
            path: (options?.path as string) || './logs/app.log',
            maxSize: (options?.maxSize as number) || 10 * 1024 * 1024,
            maxFiles: (options?.maxFiles as number) || 5,
            formatter: simpleFormatter,
        }),

    // HTTP transport factory
    http: (options) =>
        new HttpTransport({
            url: (options?.url as string) || '/api/logs',
            bufferSize: (options?.bufferSize as number) || 100,
            flushInterval: (options?.flushInterval as number) || 5000,
            headers: (options?.headers as Record<string, string>) || {},
        }),

    // Sentry transport factory
    sentry: (options) =>
        new SentryTransport({
            dsn: (options?.dsn as string) || '',
            environment: (options?.environment as string) || 'production',
            release: options?.release as string,
            sampleRate: (options?.sampleRate as number) || 1.0,
            tracesSampleRate: (options?.tracesSampleRate as number) || 0.1,
        }),
});

/**
 * Create a child logger with additional context
 *
 * Useful for creating module-specific loggers
 *
 * Usage:
 * ```ts
 * const authLogger = createChildLogger({ module: 'auth' });
 * authLogger.info('Authentication successful');
 * ```
 */
export function createChildLogger(context: Record<string, unknown>) {
    return logger.child(context);
}

/**
 * Get current time in milliseconds (with fallback for environments without performance.now)
 */
function now(): number {
    if (typeof performance !== 'undefined' && performance?.now) {
        return performance.now();
    }
    return Date.now();
}

/**
 * Performance logging helper
 *
 * Usage:
 * ```ts
 * const end = logPerformance('data-fetch');
 * // ... do work ...
 * end({ recordsProcessed: 100 });
 * ```
 */
export function logPerformance(operation: string) {
    const start = now();

    return (additionalContext?: Record<string, unknown>) => {
        const duration = now() - start;
        logger.info(`Performance: ${operation}`, {
            operation,
            duration: `${duration.toFixed(2)}ms`,
            ...additionalContext,
        });
    };
}

/**
 * Log an API request
 */
export function logApiRequest(method: string, url: string, context?: Record<string, unknown>) {
    logger.info(`API Request: ${method} ${url}`, {
        method,
        url,
        ...context,
    });
}

/**
 * Log an API response
 */
export function logApiResponse(
    method: string,
    url: string,
    status: number,
    duration: number,
    context?: Record<string, unknown>,
) {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    logger[level](`API Response: ${method} ${url} - ${status}`, {
        method,
        url,
        status,
        duration: `${duration}ms`,
        ...context,
    });
}

/**
 * Log user action
 */
export function logUserAction(action: string, context?: Record<string, unknown>) {
    logger.info(`User Action: ${action}`, {
        action,
        ...context,
    });
}
