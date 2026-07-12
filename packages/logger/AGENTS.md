# @ottabase/logger — agent notes

Leveled, multi-transport/multi-formatter logger for Node, browsers, and Workers. Full docs: ./README.md

## Use when

- Any structured/leveled logging: console, file rotation, HTTP batching, Sentry, audit-DB, child loggers, env-based config.
- NOT for querying/reading audit logs — use @ottabase/ottaorm's AuditLog model directly.

## Imports

```ts
import { createLogger, Logger, LogLevelEnum, ConsoleTransport, MemoryTransport, FileTransport, SentryTransport, AuditDbTransport, prettyFormatter, jsonFormatter, simpleFormatter, createFormatter, createLoggerFromConfig, createAutoLogger, createTransportsFromConfig, detectEnvironment, defaultLogConfig } from '@ottabase/logger';
import type { ILogger, LogEntry, LogLevel, LogLevelName, LoggerOptions, Transport, Formatter, LogConfig, EnvironmentLogConfig, TransportConfig, LogEnvironment } from '@ottabase/logger';
import defaultLogger from '@ottabase/logger';
// Subpaths (same symbols, leaner): '@ottabase/logger/transports' (adds BufferedTransport, MultiTransport, FilterTransport, HttpTransport), '/formatters', '/config', '/audit-transport'
```

## Canonical usage

```ts
const logger = createLogger({ level: LogLevelEnum.INFO, name: 'my-app', context: { service: 'api' } });
logger.info('User logged in', { userId: 123 });
logger.error('An error occurred', new Error('details'));
const requestLogger = logger.child({ requestId: 'abc-123' }); // inherits parent context
```

```ts
// Env-aware setup: detects server/client/worker and picks that section of LogConfig
const logger = createAutoLogger(logConfig, {
    file: (options) => new FileTransport({ path: './logs/app.log', ...options }),
});
```

```ts
// Audit trail -> ottaorm AuditLog table (entries need action/resourceType in context)
const logger = createLogger({
    transports: [new ConsoleTransport(), new AuditDbTransport({ getUserContext: () => ({ userId, userEmail }) })],
});
logger.info('User updated', { action: 'update', resourceType: 'user', resourceId: 'user-123' });
```

## Gotchas

- FileTransport is Node-only; file/http/sentry transports are only created from config when you pass a factory to createLoggerFromConfig/createAutoLogger — otherwise silently skipped (console falls back automatically).
- Call `await logger.flush()` before exit or buffered/HTTP/audit logs are lost; AuditDbTransport also runs a setInterval flush timer — `close()` it in short-lived processes.
- One SentryTransport instance per app (it calls Sentry.init); @sentry/node|browser are optional peer deps.
- AuditDbTransport dynamically imports @ottabase/ottaorm and requires its global connection registry to be initialized.
