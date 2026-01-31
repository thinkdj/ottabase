/**
 * Logger Demo Page
 * Demonstrates @ottabase/logger: levels, context, child loggers, formatters, MemoryTransport.
 * Logs go to browser console (ConsoleTransport) and to the in-page list (MemoryTransport).
 */
import {
    createLogger,
    LogLevelEnum,
    MemoryTransport,
    ConsoleTransport,
    jsonFormatter,
    prettyFormatter,
    simpleFormatter,
} from '@ottabase/logger';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
                transports: [new ConsoleTransport({ formatter: prettyFormatter }), memoryTransport],
                context: { page: 'logger-demo' },
            }),
        [level],
    );

    const refreshLogs = useCallback(() => {
        setLogs(
            memoryTransport
                .getLogs()
                .map((e) => `${e.levelName} ${e.message} ${e.context ? JSON.stringify(e.context) : ''}`),
        );
    }, []);

    const runDemo = useCallback(() => {
        memoryTransport.clear();
        logger.debug('Debug message', { detail: 'only visible when level is DEBUG' });
        logger.info('Info message', { userId: 1, action: 'view' });
        logger.warn('Warning message', { retries: 2 });
        logger.error('Error message', new Error('Demo error'), { code: 500 });
        refreshLogs();
    }, [logger, refreshLogs]);

    const runChildDemo = useCallback(() => {
        memoryTransport.clear();
        const child = logger.child({ requestId: 'req-123' });
        child.info('Request started');
        child.info('Request completed', { duration: 42 });
        refreshLogs();
    }, [logger, refreshLogs]);

    const runFormatterDemo = useCallback(() => {
        memoryTransport.clear();
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

    return (
        <div className="mx-auto w-full max-w-5xl space-y-8 pb-16">
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/logger
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight dark:text-foreground">Logger Demo</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Extensible logger with multiple transports and formatters. Logs are sent to the{' '}
                    <strong>browser console</strong> (Console transport) and to the in-page list below (Memory
                    transport).
                </p>
            </div>

            {/* How to use — client-side console visualization */}
            <Card className="border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg">How to use this demo</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        <ol className="list-inside list-decimal space-y-1.5">
                            <li>
                                Open <strong>DevTools</strong> (F12 or right‑click → Inspect).
                            </li>
                            <li>
                                Go to the <strong>Console</strong> tab.
                            </li>
                            <li>
                                Use the buttons below: set a log level, then run &quot;Run level demo&quot;, &quot;Child
                                logger demo&quot;, or &quot;Formatters&quot;.
                            </li>
                            <li>
                                Logs appear in the Console (debug/info/warn/error) and in the &quot;In-memory logs&quot;
                                list after you click &quot;Refresh log list&quot;.
                            </li>
                        </ol>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Same logger works on <strong>client</strong> (browser) and <strong>server</strong> (Wrangler /
                        CF Workers). Default transport is <strong>Console</strong> (console.debug / console.info /
                        console.warn / console.error).
                    </p>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="dark:border-border dark:bg-card">
                    <CardHeader>
                        <CardTitle>Log levels</CardTitle>
                        <CardDescription>
                            Minimum level controls what is emitted. Change level and run demo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
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
                    </CardContent>
                </Card>

                <Card className="dark:border-border dark:bg-card">
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                        <CardDescription>Emit logs and refresh the in-memory list.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button onClick={runDemo}>Run level demo</Button>
                        <Button variant="outline" onClick={runChildDemo}>
                            Child logger demo
                        </Button>
                        <Button variant="outline" onClick={runFormatterDemo}>
                            Formatters (console)
                        </Button>
                        <Button variant="outline" onClick={refreshLogs}>
                            Refresh log list
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="dark:border-border dark:bg-card">
                <CardHeader>
                    <CardTitle>In-memory logs (last 50)</CardTitle>
                    <CardDescription>
                        Logs captured by MemoryTransport. The same entries are also sent to the browser Console
                        (ConsoleTransport) — check DevTools → Console to see them there.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Run a demo above, then click Refresh log list.</p>
                    ) : (
                        <pre className="max-h-64 overflow-auto rounded-md border bg-muted/50 p-3 text-xs dark:border-border dark:bg-muted/20">
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
