# @ottabase/logger

Extensible logger for Ottabase with support for multiple transports and formatters.

## Features

- Multiple log levels (debug, info, warn, error)
- Extensible transport system
- Multiple built-in formatters (JSON, pretty, simple)
- Child loggers with inherited context
- TypeScript support with full type definitions
- Works in Node.js, Cloudflare Workers, and browsers
- Zero dependencies

## Installation

```bash
pnpm add @ottabase/logger
```

## Quick Start

```typescript
import { createLogger } from '@ottabase/logger';

const logger = createLogger();

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', new Error('Something went wrong'));
```

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

### Built-in Transports

#### ConsoleTransport

Logs to the console with colored output (default):

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
    return `[${entry.timestamp.toISOString()}] ${entry.levelName.toUpperCase()}: ${entry.message}`;
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

Ensure all logs are written before shutdown:

```typescript
const logger = createLogger();

// Flush all transports
await logger.flush();

// Close all transports (also flushes)
await logger.close();
```

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
