import { describe, it, expect } from 'vitest';
import { jsonFormatter, prettyFormatter, simpleFormatter, createFormatter } from '../formatters.js';
import type { LogEntry } from '../types.js';

describe('Formatters', () => {
    const baseEntry: LogEntry = {
        level: 1,
        levelName: 'info',
        message: 'test message',
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
    };

    describe('jsonFormatter', () => {
        it('should format log entry as JSON', () => {
            const result = jsonFormatter(baseEntry);
            const parsed = JSON.parse(result);

            expect(parsed.level).toBe(1);
            expect(parsed.levelName).toBe('info');
            expect(parsed.message).toBe('test message');
            expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
        });

        it('should include context in JSON', () => {
            const entry: LogEntry = {
                ...baseEntry,
                context: { userId: 123 },
            };

            const result = jsonFormatter(entry);
            const parsed = JSON.parse(result);

            expect(parsed.context).toEqual({ userId: 123 });
        });

        it('should include error in JSON (serialized as name, message, stack)', () => {
            const error = new Error('test error');
            const entry: LogEntry = {
                ...baseEntry,
                error,
            };

            const result = jsonFormatter(entry);
            const parsed = JSON.parse(result);

            expect(parsed.error).toBeDefined();
            expect(parsed.error.name).toBe('Error');
            expect(parsed.error.message).toBe('test error');
            expect(parsed.error.stack).toBeDefined();
        });
    });

    describe('prettyFormatter', () => {
        it('should format log entry with colors', () => {
            const result = prettyFormatter(baseEntry);

            expect(result).toContain('INFO');
            expect(result).toContain('test message');
            expect(result).toContain('2024-01-01T00:00:00.000Z');
        });

        it('should include context', () => {
            const entry: LogEntry = {
                ...baseEntry,
                context: { userId: 123 },
            };

            const result = prettyFormatter(entry);

            expect(result).toContain('"userId":123');
        });

        it('should include error stack', () => {
            const error = new Error('test error');
            const entry: LogEntry = {
                ...baseEntry,
                error,
            };

            const result = prettyFormatter(entry);

            expect(result).toContain('test error');
        });

        it('should use different colors for different levels', () => {
            const debugEntry: LogEntry = { ...baseEntry, level: 0, levelName: 'debug' };
            const warnEntry: LogEntry = { ...baseEntry, level: 2, levelName: 'warn' };
            const errorEntry: LogEntry = { ...baseEntry, level: 3, levelName: 'error' };

            const debugResult = prettyFormatter(debugEntry);
            const warnResult = prettyFormatter(warnEntry);
            const errorResult = prettyFormatter(errorEntry);

            expect(debugResult).toContain('DEBUG');
            expect(warnResult).toContain('WARN');
            expect(errorResult).toContain('ERROR');
        });
    });

    describe('simpleFormatter', () => {
        it('should format log entry without colors', () => {
            const result = simpleFormatter(baseEntry);

            expect(result).toContain('INFO');
            expect(result).toContain('test message');
            expect(result).toContain('2024-01-01T00:00:00.000Z');
            expect(result).not.toContain('\x1b'); // No ANSI codes
        });

        it('should include context', () => {
            const entry: LogEntry = {
                ...baseEntry,
                context: { userId: 123 },
            };

            const result = simpleFormatter(entry);

            expect(result).toContain('"userId":123');
        });

        it('should include error stack', () => {
            const error = new Error('test error');
            const entry: LogEntry = {
                ...baseEntry,
                error,
            };

            const result = simpleFormatter(entry);

            expect(result).toContain('test error');
        });
    });

    describe('createFormatter', () => {
        it('should create a custom formatter', () => {
            const customFormatter = createFormatter((entry) => `[${entry.levelName}] ${entry.message}`);

            const result = customFormatter(baseEntry);

            expect(result).toBe('[info] test message');
        });

        it('should allow complex custom formatting', () => {
            const customFormatter = createFormatter((entry) => {
                const parts = [entry.levelName.toUpperCase(), entry.message];
                if (entry.context) {
                    parts.push(JSON.stringify(entry.context));
                }
                return parts.join(' | ');
            });

            const entry: LogEntry = {
                ...baseEntry,
                context: { key: 'value' },
            };

            const result = customFormatter(entry);

            expect(result).toBe('INFO | test message | {"key":"value"}');
        });
    });
});
