# @ottabase/logger

Extensible logger for Ottabase with support for multiple transports and formatters.

## Features

- **Multiple log levels** (debug, info, warn, error, silent)
- **Extensible transport system** with built-in transports:
    - Console (with colors)
    - File (with rotation)
    - HTTP (buffered)
    - Sentry (error tracking)
    - Memory (testing)
    - Multi, Filter, Buffered
- **Configuration-based setup** for easy environment management
- **Multiple built-in formatters** (JSON, pretty, simple, custom)
- **Child loggers** with inherited context
- **TypeScript support** with full type definitions
- **Multi-environment** - Works in Node.js, Cloudflare Workers, and browsers
- **Zero runtime dependencies** (peer dependencies for Sentry integration)

## Installation

```bash
pnpm add @ottabase/logger
```

## Quick Start

By default, `createLogger()` uses **Console transport**: logs go to `console.debug`, `console.info`, `console.warn`, and
`console.error`. This works in the **browser**, **Node.js**, and **Cloudflare Workers** (Wrangler), so the same code
runs on client and server.

```typescript
import { createLogger } from '@ottabase/logger';

const logger = createLogger();

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', new Error('Something went wrong'));
```

Open DevTools → Console (browser) or your terminal/worker logs to see output.

## Usage

### Basic Logging

```typescript
import { createLogger, LogLevelEnum } from '@ottabase/logger';

const logger = createLogger({
    level: LogLevelEnum.INFO,
    name: 'my-app',
});

logger.info('Application started');
logger.warn('This is a warning');
logger.error('An error occurred', new Error('Error details'));
```

### Logging with Context

Add contextual information to your logs:

```typescript
logger.info('User logged in', { userId: 123, email: 'user@example.com' });
```

### Child Loggers

Create child loggers that inherit and extend parent context:

```typescript
const logger = createLogger({
    context: { service: 'api' },
});

const requestLogger = logger.child({ requestId: 'abc-123' });
requestLogger.info('Processing request'); // Includes both service and requestId
```

### Custom Transports

Create custom transports to send logs anywhere:

```typescript
import { createLogger, type Transport, type LogEntry } from '@ottabase/logger';

const customTransport: Transport = {
    log: (entry: LogEntry) => {
        // Send to external service
        fetch('https://logs.example.com', {
            method: 'POST',
            body: JSON.stringify(entry),
        });
    },
};

const logger = createLogger({
    transports: [customTransport],
});
```

## Configuration-Based Setup

For applications, use configuration-based logging to easily manage different environments:

```typescript
import { createAutoLogger, type LogConfig, LogLevelEnum } from '@ottabase/logger';

const logConfig: LogConfig = {
    level: LogLevelEnum.INFO,
    context: { app: 'my-app', version: '1.0.0' },

    // Server-side configuration
    server: {
        console: { enabled: true },
        file: {
            enabled: true,
            options: {
                path: './logs/app.log',
                maxSize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
            },
        },
        sentry: {
            enabled: true,
            options: {
                dsn: 'your-sentry-dsn',
                environment: 'production',
            },
        },
    },

    // Client-side configuration
    client: {
        console: { enabled: true },
        http: {
            enabled: true,
            options: {
                url: '/api/logs',
                bufferSize: 50,
            },
        },
    },
};

// Automatically detects environment and creates appropriate logger
const logger = createAutoLogger(logConfig, {
    file: (opts) => new FileTransport({ path: opts?.path as string }),
    sentry: (opts) => new SentryTransport({ dsn: opts?.dsn as string }),
});
```

### Environment-Specific Loggers

Create loggers for specific environments:

```typescript
import { createLoggerFromConfig } from '@ottabase/logger';

// Explicitly create a server logger
const serverLogger = createLoggerFromConfig(logConfig, 'server');

// Explicitly create a client logger
const clientLogger = createLoggerFromConfig(logConfig, 'client');

// Explicitly create a worker logger
const workerLogger = createLoggerFromConfig(logConfig, 'worker');
```

### Built-in Transports

#### ConsoleTransport

Logs to the console with colored output. This is the **default transport** when you call `createLogger()` with no
options. Uses `console.debug` / `console.info` / `console.warn` / `console.error` so logs appear in browser DevTools,
Node.js stdout, and Cloudflare Workers logs.

```typescript
import { createLogger, ConsoleTransport } from '@ottabase/logger';

const logger = createLogger({
    transports: [new ConsoleTransport()],
});
```

#### MemoryTransport

Stores logs in memory (useful for testing):

```typescript
import { MemoryTransport } from '@ottabase/logger/transports';

const memoryTransport = new MemoryTransport({ maxSize: 1000 });
const logger = createLogger({
    transports: [memoryTransport],
});

logger.info('test');
const logs = memoryTransport.getLogs();
```

#### BufferedTransport

Buffers logs and flushes them in batches:

```typescript
import { BufferedTransport } from '@ottabase/logger/transports';

const buffered = new BufferedTransport({
    bufferSize: 100,
    flushInterval: 5000,
    onFlush: async (entries) => {
        // Send batch of entries
        await sendToExternalService(entries);
    },
});
```

#### HttpTransport

Sends logs to an HTTP endpoint:

```typescript
import { HttpTransport } from '@ottabase/logger/transports';

const httpTransport = new HttpTransport({
    url: 'https://logs.example.com/ingest',
    bufferSize: 50,
    flushInterval: 3000,
});
```

#### MultiTransport

Send logs to multiple transports:

```typescript
import { MultiTransport, ConsoleTransport, HttpTransport } from '@ottabase/logger/transports';

const multi = new MultiTransport([new ConsoleTransport(), new HttpTransport({ url: 'https://logs.example.com' })]);
```

#### FileTransport

Write logs to a file with automatic rotation (Node.js only):

```typescript
import { FileTransport } from '@ottabase/logger';

const fileTransport = new FileTransport({
    path: './logs/app.log',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5, // Keep up to 5 rotated files
});

const logger = createLogger({
    transports: [fileTransport],
});
```

#### SentryTransport

Send errors to Sentry for monitoring (requires @sentry/node or @sentry/browser):

```typescript
import { SentryTransport } from '@ottabase/logger';

const sentryTransport = new SentryTransport({
    dsn: 'your-sentry-dsn',
    environment: 'production',
    release: '1.0.0',
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
    minLevel: 3, // Only send ERROR and above (default)
});

const logger = createLogger({
    transports: [new ConsoleTransport(), sentryTransport],
});

// Errors are automatically sent to Sentry
logger.error('Payment failed', new Error('Insufficient funds'), {
    userId: 123,
    amount: 50.0,
});
```

**Note:** Install Sentry SDK. Use a single `SentryTransport` instance per app to avoid multiple `Sentry.init()` calls.

```bash
# For Node.js
pnpm add @sentry/node

# For browser
pnpm add @sentry/browser
```

#### FilterTransport

Filter logs before sending to another transport:

```typescript
import { FilterTransport, ConsoleTransport } from '@ottabase/logger/transports';

const filtered = new FilterTransport(new ConsoleTransport(), (entry) => entry.level >= 2); // Only WARN and ERROR
```

### Formatters

#### JSON Formatter

Outputs logs as JSON strings:

```typescript
import { ConsoleTransport, jsonFormatter } from '@ottabase/logger';

const logger = createLogger({
    transports: [new ConsoleTransport({ formatter: jsonFormatter })],
});
```

#### Pretty Formatter

Outputs human-readable colored logs (default):

```typescript
import { ConsoleTransport, prettyFormatter } from '@ottabase/logger';

const logger = createLogger({
    transports: [new ConsoleTransport({ formatter: prettyFormatter })],
});
```

#### Simple Formatter

Outputs logs without colors (suitable for production/files):

```typescript
import { ConsoleTransport, simpleFormatter } from '@ottabase/logger';

const logger = createLogger({
    transports: [new ConsoleTransport({ formatter: simpleFormatter })],
});
```

#### Custom Formatter

Create your own formatter:

```typescript
import { createFormatter } from '@ottabase/logger/formatters';

const customFormatter = createFormatter((entry) => {
    return `[${new Date(entry.timestamp).toUTCString()}] ${entry.levelName.toUpperCase()}: ${entry.message}`;
});
```

### Log Levels

Control which logs are output:

```typescript
import { createLogger, LogLevelEnum } from '@ottabase/logger';

const logger = createLogger({
    level: LogLevelEnum.WARN, // Only WARN and ERROR
});

logger.debug('Not logged');
logger.info('Not logged');
logger.warn('Logged');
logger.error('Logged');

// Change level at runtime
logger.setLevel(LogLevelEnum.DEBUG);
```

Available log levels:

- `LogLevelEnum.DEBUG` (0)
- `LogLevelEnum.INFO` (1)
- `LogLevelEnum.WARN` (2)
- `LogLevelEnum.ERROR` (3)
- `LogLevelEnum.SILENT` (4)

### Flushing and Cleanup

Ensure all logs are written before shutdown (e.g. in serverless or before process exit):

```typescript
const logger = createLogger();

// Flush all transports (waits for buffered/async transports)
await logger.flush();

// Close all transports (also flushes)
await logger.close();
```

**Production tip:** Call `await logger.flush()` before process exit so buffered transports (HTTP, file) have time to
write.

## Advanced Examples

### Multiple Environments

```typescript
import { createLogger, ConsoleTransport, HttpTransport, LogLevelEnum } from '@ottabase/logger';
import { prettyFormatter, jsonFormatter } from '@ottabase/logger/formatters';

const isDev = process.env.NODE_ENV === 'development';

const logger = createLogger({
    level: isDev ? LogLevelEnum.DEBUG : LogLevelEnum.INFO,
    transports: isDev
        ? [new ConsoleTransport({ formatter: prettyFormatter })]
        : [new ConsoleTransport({ formatter: jsonFormatter }), new HttpTransport({ url: 'https://logs.example.com' })],
});
```

### Structured Logging

```typescript
const logger = createLogger({
    context: {
        service: 'api',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
    },
});

logger.info('Request received', {
    method: 'GET',
    path: '/api/users',
    responseTime: 123,
    statusCode: 200,
});
```

### Error Logging

```typescript
try {
    throw new Error('Something went wrong');
} catch (error) {
    logger.error('Failed to process request', error as Error, {
        userId: 123,
        action: 'checkout',
    });
}
```

## API Reference

### `createLogger(options?): ILogger`

Creates a new logger instance.

**Options:**

- `level?: LogLevel` - Minimum log level (default: `INFO`)
- `name?: string` - Logger name/identifier
- `transports?: Transport[]` - Transports to use (default: `[ConsoleTransport]`)
- `context?: Record<string, unknown>` - Additional context for all logs
- `includeTimestamp?: boolean` - Include timestamps (default: `true`)

### `ILogger`

**Methods:**

- `debug(message: string, context?: Record<string, unknown>): void`
- `info(message: string, context?: Record<string, unknown>): void`
- `warn(message: string, context?: Record<string, unknown>): void`
- `error(message: string, error?: Error, context?: Record<string, unknown>): void`
- `child(context: Record<string, unknown>): ILogger`
- `setLevel(level: LogLevel): void`
- `getLevel(): LogLevel`
- `addTransport(transport: Transport): void`
- `removeTransport(transport: Transport): void`
- `flush(): Promise<void>`
- `close(): Promise<void>`

## License

MIT
