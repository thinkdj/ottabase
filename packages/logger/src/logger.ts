import type { ILogger, LogEntry, LogLevel, LogLevelName, LoggerOptions, Transport } from './types.js';
import { ConsoleTransport } from './transports.js';

/**
 * Logger class
 */
export class Logger implements ILogger {
    private level: LogLevel;
    private name?: string;
    private transports: Transport[];
    private context: Record<string, unknown>;
    private includeTimestamp: boolean;

    constructor(options: LoggerOptions = {}) {
        this.level = options.level ?? 1; // Default to INFO
        this.name = options.name;
        this.transports = options.transports ?? [new ConsoleTransport()];
        this.context = options.context ?? {};
        this.includeTimestamp = options.includeTimestamp ?? true;
    }

    /**
     * Get log level name from level number
     */
    private getLevelName(level: LogLevel): LogLevelName {
        switch (level) {
            case 0:
                return 'debug';
            case 1:
                return 'info';
            case 2:
                return 'warn';
            case 3:
                return 'error';
            case 4:
                return 'silent';
            default:
                return 'info';
        }
    }

    /**
     * Create a log entry
     */
    private createEntry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
        const entry: LogEntry = {
            level,
            levelName: this.getLevelName(level),
            message,
            timestamp: new Date(),
            ...(this.name && { name: this.name }),
            ...(Object.keys(this.context).length > 0 && { context: { ...this.context } }),
        };

        if (context && Object.keys(context).length > 0) {
            entry.context = { ...entry.context, ...context };
        }

        if (error) {
            entry.error = error;
        }

        return entry;
    }

    /**
     * Log a message
     */
    private async log(
        level: LogLevel,
        message: string,
        context?: Record<string, unknown>,
        error?: Error,
    ): Promise<void> {
        if (level < this.level) {
            return;
        }

        const entry = this.createEntry(level, message, context, error);

        await Promise.all(this.transports.map((transport) => transport.log(entry)));
    }

    /**
     * Log a debug message
     */
    debug(message: string, context?: Record<string, unknown>): void {
        this.log(0, message, context);
    }

    /**
     * Log an info message
     */
    info(message: string, context?: Record<string, unknown>): void {
        this.log(1, message, context);
    }

    /**
     * Log a warning message
     */
    warn(message: string, context?: Record<string, unknown>): void {
        this.log(2, message, context);
    }

    /**
     * Log an error message
     */
    error(message: string, error?: Error, context?: Record<string, unknown>): void {
        this.log(3, message, context, error);
    }

    /**
     * Create a child logger with additional context
     */
    child(context: Record<string, unknown>): ILogger {
        return new Logger({
            level: this.level,
            name: this.name,
            transports: this.transports,
            context: { ...this.context, ...context },
            includeTimestamp: this.includeTimestamp,
        });
    }

    /**
     * Set the log level
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Get the current log level
     */
    getLevel(): LogLevel {
        return this.level;
    }

    /**
     * Add a transport
     */
    addTransport(transport: Transport): void {
        this.transports.push(transport);
    }

    /**
     * Remove a transport
     */
    removeTransport(transport: Transport): void {
        const index = this.transports.indexOf(transport);
        if (index > -1) {
            this.transports.splice(index, 1);
        }
    }

    /**
     * Flush all transports
     */
    async flush(): Promise<void> {
        await Promise.all(this.transports.map((transport) => Promise.resolve(transport.flush?.())));
    }

    /**
     * Close all transports
     */
    async close(): Promise<void> {
        await Promise.all(this.transports.map((transport) => Promise.resolve(transport.close?.())));
    }
}

/**
 * Create a logger instance
 */
export function createLogger(options?: LoggerOptions): ILogger {
    return new Logger(options);
}
