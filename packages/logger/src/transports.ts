import type { Transport, LogEntry, Formatter } from './types.js';
import { prettyFormatter, simpleFormatter, jsonFormatter } from './formatters.js';

/**
 * Console transport - outputs logs to console
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
    private flushInterval: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private onFlush: (entries: LogEntry[]) => void | Promise<void>;

    constructor(options: {
        bufferSize?: number;
        flushInterval?: number;
        onFlush: (entries: LogEntry[]) => void | Promise<void>;
    }) {
        this.bufferSize = options.bufferSize || 100;
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
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
    }

    async flush(): Promise<void> {
        if (this.buffer.length === 0) {
            return;
        }

        const entries = [...this.buffer];
        this.buffer = [];

        try {
            await this.onFlush(entries);
        } catch (error) {
            console.error('Error flushing logs:', error);
        }

        this.startTimer();
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
