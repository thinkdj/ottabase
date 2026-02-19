import type { Formatter, LogEntry, LogLevel } from './types.js';

/**
 * ANSI color codes for terminal output
 */
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
} as const;

/**
 * Get color for log level
 */
function getLevelColor(level: LogLevel): string {
    switch (level) {
        case 0: // DEBUG
            return colors.cyan;
        case 1: // INFO
            return colors.blue;
        case 2: // WARN
            return colors.yellow;
        case 3: // ERROR
            return colors.red;
        default:
            return colors.reset;
    }
}

/**
 * Format a timestamp
 */
function formatTimestamp(date: Date): string {
    return date.toISOString();
}

/**
 * Pad end of string (polyfill for ES2017 String.padEnd)
 */
function padEnd(str: string, targetLength: number, padString: string = ' '): string {
    if (str.length >= targetLength) {
        return str;
    }
    const padLength = targetLength - str.length;
    let pad = '';
    for (let i = 0; i < padLength; i++) {
        pad += padString;
    }
    return str + pad;
}

/**
 * Serialize an Error for JSON output (JSON.stringify omits Error properties)
 */
function serializeError(error: Error): Record<string, unknown> {
    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
    };
}

/**
 * JSON formatter - outputs logs as JSON strings
 */
export const jsonFormatter: Formatter = (entry: LogEntry): string => {
    const serializable: Record<string, unknown> = {
        level: entry.level,
        levelName: entry.levelName,
        message: entry.message,
        timestamp: entry.timestamp,
        ...(entry.name != null && { name: entry.name }),
        ...(entry.context != null && { context: entry.context }),
        ...(entry.error != null && { error: serializeError(entry.error) }),
    };
    return JSON.stringify(serializable);
};

/**
 * Pretty formatter - outputs human-readable colored logs
 */
export const prettyFormatter: Formatter = (entry: LogEntry): string => {
    const { level, levelName, message, timestamp, context, error, ...rest } = entry;
    const color = getLevelColor(level);
    const parts: string[] = [];

    // Timestamp
    parts.push(`${colors.gray}${formatTimestamp(timestamp)}${colors.reset}`);

    // Level
    parts.push(`${color}${padEnd(levelName.toUpperCase(), 5)}${colors.reset}`);

    // Message
    parts.push(message);

    // Context
    if (context && Object.keys(context).length > 0) {
        parts.push(`${colors.dim}${JSON.stringify(context)}${colors.reset}`);
    }

    // Additional fields
    const additionalFields = { ...rest };
    delete additionalFields.name;
    if (Object.keys(additionalFields).length > 0) {
        parts.push(`${colors.dim}${JSON.stringify(additionalFields)}${colors.reset}`);
    }

    let output = parts.join(' ');

    // Error
    if (error) {
        output += `\n${colors.red}${error.stack || error.message}${colors.reset}`;
    }

    return output;
};

/**
 * Simple formatter - outputs logs without colors (suitable for production/files)
 */
export const simpleFormatter: Formatter = (entry: LogEntry): string => {
    const { level, levelName, message, timestamp, context, error, ...rest } = entry;
    const parts: string[] = [];

    // Timestamp
    parts.push(formatTimestamp(timestamp));

    // Level
    parts.push(padEnd(levelName.toUpperCase(), 5));

    // Message
    parts.push(message);

    // Context
    if (context && Object.keys(context).length > 0) {
        parts.push(JSON.stringify(context));
    }

    // Additional fields
    const additionalFields = { ...rest };
    delete additionalFields.name;
    if (Object.keys(additionalFields).length > 0) {
        parts.push(JSON.stringify(additionalFields));
    }

    let output = parts.join(' ');

    // Error
    if (error) {
        output += `\n${error.stack || error.message}`;
    }

    return output;
};

/**
 * Create a custom formatter
 */
export function createFormatter(format: (entry: LogEntry) => string): Formatter {
    return format;
}
