/**
 * Log levels supported by the logger
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4,
}

/**
 * Log level names
 */
export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Log entry metadata
 */
export interface LogEntry {
    level: LogLevel;
    levelName: LogLevelName;
    message: string;
    timestamp: Date;
    name?: string;
    context?: Record<string, unknown>;
    error?: Error;
    [key: string]: unknown;
}

/**
 * Formatter function that converts a log entry to a string
 */
export type Formatter = (entry: LogEntry) => string;

/**
 * Transport interface for outputting logs
 */
export interface Transport {
    /**
     * Write a log entry
     */
    log(entry: LogEntry): void | Promise<void>;

    /**
     * Flush any buffered logs
     */
    flush?(): void | Promise<void>;

    /**
     * Close the transport
     */
    close?(): void | Promise<void>;
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
    /**
     * Minimum log level to output
     * @default LogLevel.INFO
     */
    level?: LogLevel;

    /**
     * Logger name/identifier
     */
    name?: string;

    /**
     * Transports to use for outputting logs
     * @default [ConsoleTransport]
     */
    transports?: Transport[];

    /**
     * Additional context to include in all log entries
     */
    context?: Record<string, unknown>;

    /**
     * Whether to include timestamps in log entries
     * @default true
     */
    includeTimestamp?: boolean;
}

/**
 * Logger interface
 */
export interface ILogger {
    /**
     * Log a debug message
     */
    debug(message: string, context?: Record<string, unknown>): void;

    /**
     * Log an info message
     */
    info(message: string, context?: Record<string, unknown>): void;

    /**
     * Log a warning message
     */
    warn(message: string, context?: Record<string, unknown>): void;

    /**
     * Log an error message
     */
    error(message: string, error?: Error, context?: Record<string, unknown>): void;

    /**
     * Create a child logger with additional context
     */
    child(context: Record<string, unknown>): ILogger;

    /**
     * Set the log level
     */
    setLevel(level: LogLevel): void;

    /**
     * Get the current log level
     */
    getLevel(): LogLevel;

    /**
     * Add a transport
     */
    addTransport(transport: Transport): void;

    /**
     * Remove a transport
     */
    removeTransport(transport: Transport): void;

    /**
     * Flush all transports
     */
    flush(): Promise<void>;

    /**
     * Close all transports
     */
    close(): Promise<void>;
}
