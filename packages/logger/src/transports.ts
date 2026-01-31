import { jsonFormatter, prettyFormatter, simpleFormatter } from './formatters.js';
import type { Formatter, LogEntry, Transport } from './types.js';

/**
 * Console transport - outputs logs via console (debug/info/warn/error).
 * Default transport for createLogger(). Works in browser, Node.js, and Cloudflare Workers.
 */
export class ConsoleTransport implements Transport {
    private formatter: Formatter;

    constructor(options: { formatter?: Formatter } = {}) {
        this.formatter = options.formatter || prettyFormatter;
    }

    log(entry: LogEntry): void {
        const formatted = this.formatter(entry);

        switch (entry.level) {
            case 0: // DEBUG
                console.debug(formatted);
                break;
            case 1: // INFO
                console.info(formatted);
                break;
            case 2: // WARN
                console.warn(formatted);
                break;
            case 3: // ERROR
                console.error(formatted);
                break;
        }
    }
}

/**
 * Memory transport - stores logs in memory (useful for testing)
 */
export class MemoryTransport implements Transport {
    private logs: LogEntry[] = [];
    private maxSize: number;

    constructor(options: { maxSize?: number } = {}) {
        this.maxSize = options.maxSize || 1000;
    }

    log(entry: LogEntry): void {
        this.logs.push(entry);
        if (this.logs.length > this.maxSize) {
            this.logs.shift();
        }
    }

    /**
     * Get all stored logs
     */
    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    /**
     * Clear all stored logs
     */
    clear(): void {
        this.logs = [];
    }

    flush(): void {
        // No-op for memory transport
    }

    close(): void {
        this.clear();
    }
}

/**
 * Buffered transport - buffers logs and flushes them in batches
 */
export class BufferedTransport implements Transport {
    private buffer: LogEntry[] = [];
    private bufferSize: number;
    private maxBufferSize: number;
    private flushInterval: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private onFlush: (entries: LogEntry[]) => void | Promise<void>;
    private flushing: boolean = false;

    constructor(options: {
        bufferSize?: number;
        maxBufferSize?: number;
        flushInterval?: number;
        onFlush: (entries: LogEntry[]) => void | Promise<void>;
    }) {
        this.bufferSize = options.bufferSize || 100;
        this.maxBufferSize = options.maxBufferSize || this.bufferSize * 10; // 10x buffer size by default
        this.flushInterval = options.flushInterval || 5000;
        this.onFlush = options.onFlush;

        this.startTimer();
    }

    private startTimer(): void {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            this.flush();
        }, this.flushInterval);
    }

    log(entry: LogEntry): void {
        this.buffer.push(entry);

        // If buffer exceeds max size, drop oldest entries
        if (this.buffer.length > this.maxBufferSize) {
            const dropped = this.buffer.length - this.maxBufferSize;
            this.buffer = this.buffer.slice(dropped);
            console.warn(`BufferedTransport: Dropped ${dropped} old log entries due to max buffer size`);
        }

        // Flush if we reach the normal buffer size (skip if already flushing)
        if (!this.flushing && this.buffer.length >= this.bufferSize) {
            void this.flush();
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
            await this.onFlush(entries);
        } catch (error) {
            console.error('Error flushing logs:', error);
        } finally {
            this.flushing = false;
            this.startTimer();
        }
    }

    async close(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        await this.flush();
    }
}

/**
 * Multi transport - sends logs to multiple transports
 */
export class MultiTransport implements Transport {
    private transports: Transport[];

    constructor(transports: Transport[]) {
        this.transports = transports;
    }

    async log(entry: LogEntry): Promise<void> {
        await Promise.all(this.transports.map((transport) => transport.log(entry)));
    }

    async flush(): Promise<void> {
        await Promise.all(this.transports.map((transport) => transport.flush?.()));
    }

    async close(): Promise<void> {
        await Promise.all(this.transports.map((transport) => transport.close?.()));
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
}

/**
 * Filter transport - wraps another transport and filters log entries
 */
export class FilterTransport implements Transport {
    private transport: Transport;
    private filter: (entry: LogEntry) => boolean;

    constructor(transport: Transport, filter: (entry: LogEntry) => boolean) {
        this.transport = transport;
        this.filter = filter;
    }

    async log(entry: LogEntry): Promise<void> {
        if (this.filter(entry)) {
            await this.transport.log(entry);
        }
    }

    async flush(): Promise<void> {
        await this.transport.flush?.();
    }

    async close(): Promise<void> {
        await this.transport.close?.();
    }
}

/**
 * HTTP transport - sends logs to an HTTP endpoint
 */
export class HttpTransport implements Transport {
    private url: string;
    private formatter: Formatter;
    private headers: Record<string, string>;
    private buffered: BufferedTransport;

    constructor(options: {
        url: string;
        formatter?: Formatter;
        headers?: Record<string, string>;
        bufferSize?: number;
        flushInterval?: number;
    }) {
        this.url = options.url;
        this.formatter = options.formatter || jsonFormatter;
        this.headers = options.headers || { 'Content-Type': 'application/json' };

        this.buffered = new BufferedTransport({
            bufferSize: options.bufferSize,
            flushInterval: options.flushInterval,
            onFlush: async (entries) => {
                await this.sendBatch(entries);
            },
        });
    }

    private async sendBatch(entries: LogEntry[]): Promise<void> {
        try {
            const body = entries.map((entry) => this.formatter(entry)).join('\n');
            await fetch(this.url, {
                method: 'POST',
                headers: this.headers,
                body,
            });
        } catch (error) {
            console.error('Error sending logs to HTTP endpoint:', error);
        }
    }

    log(entry: LogEntry): void {
        this.buffered.log(entry);
    }

    async flush(): Promise<void> {
        await this.buffered.flush();
    }

    async close(): Promise<void> {
        await this.buffered.close();
    }
}

/**
 * File transport - writes logs to a file (Node.js only)
 * Note: This requires Node.js fs module and won't work in browser/Workers
 */
export class FileTransport implements Transport {
    private formatter: Formatter;
    private filePath: string;
    private maxSize: number;
    private maxFiles: number;
    private currentSize: number = 0;
    private writeStream: any;
    private fs: any;
    private buffer: LogEntry[] = [];
    private initializing: boolean = true;

    constructor(options: {
        path: string;
        formatter?: Formatter;
        maxSize?: number; // in bytes
        maxFiles?: number;
    }) {
        this.filePath = options.path;
        this.formatter = options.formatter || simpleFormatter;
        this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
        this.maxFiles = options.maxFiles || 5;

        // Dynamic import for Node.js fs module
        this.initializeFileSystem();
    }

    private async initializeFileSystem(): Promise<void> {
        try {
            // Only load fs in Node.js environment
            if (typeof process !== 'undefined' && process.versions?.node) {
                // Dynamic import of Node.js module
                this.fs = await import('fs');
                this.createWriteStream();

                // Flush buffer
                this.initializing = false;
                if (this.buffer.length > 0) {
                    this.buffer.forEach((entry) => this.log(entry));
                    this.buffer = [];
                }
            } else {
                this.initializing = false;
            }
        } catch (error) {
            console.error('FileTransport requires Node.js fs module:', error);
            this.initializing = false;
        }
    }

    private createWriteStream(): void {
        if (!this.fs) return;

        try {
            // Get current file size
            if (this.fs.existsSync(this.filePath)) {
                const stats = this.fs.statSync(this.filePath);
                this.currentSize = stats.size;
            }

            this.writeStream = this.fs.createWriteStream(this.filePath, { flags: 'a' });
        } catch (error) {
            console.error('Error creating write stream:', error);
        }
    }

    private rotateFiles(): void {
        if (!this.fs) return;

        try {
            // Close current stream
            if (this.writeStream) {
                this.writeStream.end();
            }

            // Rotate existing files
            for (let i = this.maxFiles - 1; i >= 0; i--) {
                const oldPath = i === 0 ? this.filePath : `${this.filePath}.${i}`;
                const newPath = `${this.filePath}.${i + 1}`;

                if (this.fs.existsSync(oldPath)) {
                    if (i === this.maxFiles - 1) {
                        this.fs.unlinkSync(oldPath);
                    } else {
                        this.fs.renameSync(oldPath, newPath);
                    }
                }
            }

            // Reset and create new stream
            this.currentSize = 0;
            this.createWriteStream();
        } catch (error) {
            console.error('Error rotating log files:', error);
        }
    }

    log(entry: LogEntry): void {
        if (this.initializing) {
            this.buffer.push(entry);
            return;
        }

        if (!this.writeStream) return;

        const formatted = this.formatter(entry) + '\n';
        const size = typeof Buffer !== 'undefined' ? Buffer.byteLength(formatted, 'utf8') : formatted.length;

        // Check if rotation is needed
        if (this.currentSize + size > this.maxSize) {
            this.rotateFiles();
        }

        this.writeStream.write(formatted);
        this.currentSize += size;
    }

    async flush(): Promise<void> {
        if (this.initializing || !this.writeStream) return;

        return new Promise<void>((resolve) => {
            this.writeStream.write('', () => resolve());
        });
    }

    async close(): Promise<void> {
        if (this.initializing) return;
        if (!this.writeStream) return;

        return new Promise((resolve) => {
            this.writeStream.end(resolve);
        });
    }
}

/**
 * Sentry transport - sends errors to Sentry
 * Note: This requires @sentry/node or @sentry/browser to be installed
 */
export class SentryTransport implements Transport {
    private sentry: any;
    private minLevel: number;
    private initialized: boolean = false;
    private initializing: boolean = true;
    private buffer: LogEntry[] = [];

    constructor(options: {
        dsn: string;
        environment?: string;
        release?: string;
        sampleRate?: number;
        tracesSampleRate?: number;
        minLevel?: number; // Minimum log level to send to Sentry (default: ERROR)
    }) {
        this.minLevel = options.minLevel ?? 3; // ERROR level by default
        this.initializeSentry(options);
    }

    private async initializeSentry(options: {
        dsn: string;
        environment?: string;
        release?: string;
        sampleRate?: number;
        tracesSampleRate?: number;
    }): Promise<void> {
        try {
            // Try to load Sentry from Node.js or browser
            let Sentry;
            try {
                // Try Node.js Sentry first
                Sentry = await import('@sentry/node');
            } catch {
                // Fall back to browser Sentry
                try {
                    // Optional dependency
                    Sentry = await import('@sentry/browser');
                } catch {
                    console.warn(
                        'Sentry SDK not found. Install @sentry/node or @sentry/browser to use SentryTransport.',
                    );
                    this.initializing = false;
                    return;
                }
            }

            this.sentry = Sentry;

            // Initialize Sentry
            this.sentry.init({
                dsn: options.dsn,
                environment: options.environment || 'production',
                release: options.release,
                sampleRate: options.sampleRate ?? 1.0,
                tracesSampleRate: options.tracesSampleRate ?? 0.1,
            });

            this.initialized = true;
            this.initializing = false;

            // Flush buffer
            if (this.buffer.length > 0) {
                this.buffer.forEach((entry) => this.log(entry));
                this.buffer = [];
            }
        } catch (error) {
            console.error('Error initializing Sentry:', error);
            this.initializing = false;
        }
    }

    log(entry: LogEntry): void {
        if (this.initializing) {
            this.buffer.push(entry);
            return;
        }

        if (!this.initialized || !this.sentry) return;

        // Only send logs at or above the minimum level
        if (entry.level < this.minLevel) return;

        try {
            // Set context
            if (entry.context) {
                this.sentry.setContext('logger', entry.context);
            }

            // Add breadcrumb for non-error logs
            if (entry.level < 3) {
                this.sentry.addBreadcrumb({
                    message: entry.message,
                    level: this.getSentryLevel(entry.level),
                    timestamp: entry.timestamp.getTime() / 1000,
                    data: entry.context,
                });
            } else {
                // Capture exception or message for errors
                if (entry.error) {
                    this.sentry.captureException(entry.error, {
                        level: 'error',
                        contexts: {
                            logger: entry.context || {},
                        },
                        tags: {
                            logger_name: entry.name,
                        },
                    });
                } else {
                    this.sentry.captureMessage(entry.message, {
                        level: this.getSentryLevel(entry.level),
                        contexts: {
                            logger: entry.context || {},
                        },
                        tags: {
                            logger_name: entry.name,
                        },
                    });
                }
            }
        } catch (error) {
            console.error('Error sending log to Sentry:', error);
        }
    }

    private getSentryLevel(level: number): string {
        switch (level) {
            case 0:
                return 'debug';
            case 1:
                return 'info';
            case 2:
                return 'warning';
            case 3:
                return 'error';
            default:
                return 'info';
        }
    }

    async flush(): Promise<void> {
        if (this.initializing) return;
        if (!this.initialized || !this.sentry) return;

        try {
            // Use flush() to send pending events without closing the SDK
            await this.sentry.flush(2000);
        } catch (error) {
            console.error('Error flushing Sentry:', error);
        }
    }

    async close(): Promise<void> {
        if (this.initializing) return;
        if (!this.initialized || !this.sentry) return;

        try {
            // Use close() to shutdown the SDK
            await this.sentry.close(2000);
        } catch (error) {
            console.error('Error closing Sentry:', error);
        }
    }
}
