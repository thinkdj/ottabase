/**
 * Logger Demo Page
 * Demonstrates @ottabase/logger: levels, context, child loggers, formatters, MemoryTransport.
 * Logs go to browser console (ConsoleTransport) and to the in-page list (MemoryTransport).
 */
import {
    ConsoleTransport,
    createLogger,
    jsonFormatter,
    LogLevelEnum,
    MemoryTransport,
    simpleFormatter,
} from '@ottabase/logger';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

const memoryTransport = new MemoryTransport({ maxSize: 50 });

export function LoggerDemoPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [level, setLevel] = useState<number>(LogLevelEnum.INFO);

    // Log once on mount so the browser console shows something immediately (helps users find the Console tab)
    useEffect(() => {
        console.log(
            '%c[@ottabase/logger] Demo page loaded — logs from this page will appear here (Console transport). Use the buttons on the page to emit more logs.',
            'color: #0ea5e9; font-weight: bold;',
        );
    }, []);

    const logger = useMemo(
        () =>
            createLogger({
                level,
                name: 'demo-page',
                // Use simpleFormatter in browser — prettyFormatter uses ANSI codes that show as garbled text in DevTools
                transports: [new ConsoleTransport({ formatter: simpleFormatter }), memoryTransport],
                context: { page: 'logger-demo' },
            }),
        [level],
    );

    const refreshLogs = useCallback(() => {
        setLogs(
            memoryTransport
                .getLogs()
                .reverse()
                .map((e) => `${e.levelName} ${e.message} ${e.context ? JSON.stringify(e.context) : ''}`),
        );
    }, []);

    const runDemo = useCallback(() => {
        logger.debug('Debug message', { detail: 'only visible when level is DEBUG' });
        logger.info('Info message', { userId: 1, action: 'view' });
        logger.warn('Warning message', { retries: 2 });
        // Log ERROR without passing an Error so the console doesn't show a stack trace (demo stays clear)
        logger.error('Error message (demo)', undefined, { code: 500 });
        refreshLogs();
    }, [logger, refreshLogs]);

    const logError = useCallback(() => {
        logger.error('Error logged (demo)', undefined, { code: 500, action: 'demo' });
        refreshLogs();
    }, [logger, refreshLogs]);

    const runChildDemo = useCallback(() => {
        const child = logger.child({ requestId: 'req-123' });
        child.info('Request started');
        child.info('Request completed', { duration: 42 });
        refreshLogs();
    }, [logger, refreshLogs]);

    const runFormatterDemo = useCallback(() => {
        const jsonLogger = createLogger({
            level: LogLevelEnum.INFO,
            transports: [new ConsoleTransport({ formatter: jsonFormatter })],
        });
        jsonLogger.info('JSON-formatted log', { key: 'value' });
        const simpleLogger = createLogger({
            level: LogLevelEnum.INFO,
            transports: [new ConsoleTransport({ formatter: simpleFormatter })],
        });
        simpleLogger.info('Simple (no ANSI) log');
        // Also send to memory so we see something
        logger.info('Formatter demo: check browser console for JSON and simple output');
        refreshLogs();
    }, [logger, refreshLogs]);

    const clearLogs = useCallback(() => {
        memoryTransport.clear();
        setLogs([]);
    }, []);

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Logger"
                description={
                    <>
                        Extensible logger with multiple transports and formatters. Logs are sent to the{' '}
                        <strong>browser console</strong> (Console transport) and to the in-page list below (Memory
                        transport).
                    </>
                }
                actions={
                    <Badge
                        variant="outline"
                        className="rounded-full border-transparent bg-background text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border"
                    >
                        @ottabase/logger
                    </Badge>
                }
            />

            {/* How to use — client-side console visualization */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">How to use this demo</CardTitle>
                    <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-medium text-foreground">Quick flow:</p>
                        <ol className="list-inside list-decimal space-y-1">
                            <li>
                                Open <strong>DevTools</strong> (F12) → <strong>Console</strong> tab.
                            </li>
                            <li>
                                <strong>Left:</strong> Pick a log level (DEBUG / INFO / WARN / ERROR), then click
                                &quot;Run level demo&quot; to emit all four levels (filtered by your choice).
                            </li>
                            <li>
                                <strong>Right:</strong> Use &quot;Log error&quot;, &quot;Child logger demo&quot;, or
                                &quot;Formatters&quot; for other demos.
                            </li>
                            <li>
                                See logs in the Console and in &quot;In-memory logs&quot; (click{' '}
                                <strong>Refresh log list</strong> to update the list).
                            </li>
                        </ol>
                        <p className="pt-1 text-muted-foreground">
                            Same logger works on <strong>client</strong> (browser) and <strong>server</strong> (Wrangler
                            / CF Workers). Default transport is Console.
                        </p>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Log levels</CardTitle>
                        <CardDescription>
                            <strong>Minimum level</strong> the logger will output. Only messages at or above this level
                            appear. Pick a level, then click &quot;Run level demo&quot; to emit DEBUG, INFO, WARN, ERROR
                            (filtered by this level).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: LogLevelEnum.DEBUG, label: 'DEBUG' },
                                { value: LogLevelEnum.INFO, label: 'INFO' },
                                { value: LogLevelEnum.WARN, label: 'WARN' },
                                { value: LogLevelEnum.ERROR, label: 'ERROR' },
                            ].map(({ value, label }) => (
                                <Button
                                    key={value}
                                    variant={level === value ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setLevel(value)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                        <Button onClick={runDemo} className="w-full sm:w-auto">
                            Run level demo
                        </Button>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Actions</CardTitle>
                        <CardDescription>
                            Other demos. Results go to the browser Console and (after &quot;Refresh log list&quot;) to
                            the in-page list below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={logError}>
                                Log error
                            </Button>
                            <Button variant="outline" onClick={runChildDemo}>
                                Child logger demo
                            </Button>
                            <Button variant="outline" onClick={runFormatterDemo}>
                                Formatters (console)
                            </Button>
                            <Button variant="outline" onClick={refreshLogs}>
                                Refresh log list
                            </Button>
                            <Button variant="outline" onClick={clearLogs}>
                                Clear logs
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            <strong>Log error</strong> — logs one ERROR. <strong>Child logger demo</strong> — two INFO
                            lines with extra context. <strong>Formatters</strong> — JSON + simple lines in Console.{' '}
                            <strong>Refresh log list</strong> — updates the in-page list. <strong>Clear logs</strong> —
                            empties the in-memory list.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">In-memory logs (last 50)</CardTitle>
                    <CardDescription>
                        Logs accumulate across all actions (MemoryTransport keeps the last 50). Click &quot;Refresh log
                        list&quot; to update; &quot;Clear logs&quot; to reset. Same entries go to the browser Console.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground ring-1 ring-border">
                            Run a demo above, then click Refresh log list.
                        </p>
                    ) : (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                            {logs.map((line, i) => (
                                <div key={i}>{line}</div>
                            ))}
                        </pre>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
