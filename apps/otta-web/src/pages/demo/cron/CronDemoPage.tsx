/**
 * Cron Demo Page
 * Demonstrates @ottabase/cron: cron expression parsing, schedule presets, and next-run calculation.
 */
import { CronPresets, getNextRun, matchesCron, parseCron, type ParsedCron } from '@ottabase/cron';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Calendar, CheckCircle, Clock, XCircle, Zap } from 'lucide-react';
import { useState } from 'react';

export function CronDemoPage() {
    const [expression, setExpression] = useState('*/15 * * * *');
    const [parsed, setParsed] = useState<ParsedCron | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [matchResult, setMatchResult] = useState<boolean | null>(null);
    const [nextRuns, setNextRuns] = useState<Date[]>([]);

    const handleParse = () => {
        try {
            const result = parseCron(expression);
            setParsed(result);
            setParseError(null);

            // Check if expression matches current time
            const now = new Date();
            setMatchResult(matchesCron(expression, now));

            // Get the next 5 runs
            const runs: Date[] = [];
            let from = now;
            for (let i = 0; i < 5; i++) {
                const next = getNextRun(expression, from);
                if (next) {
                    runs.push(next);
                    from = new Date(next.getTime() + 60000); // Advance 1 minute past
                }
            }
            setNextRuns(runs);
        } catch (err) {
            setParsed(null);
            setParseError(err instanceof Error ? err.message : 'Invalid cron expression');
            setMatchResult(null);
            setNextRuns([]);
        }
    };

    // Build preset entries from CronPresets
    const presetEntries = Object.entries(CronPresets) as [string, string][];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/cron
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight dark:text-foreground">Cron Demo</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Laravel-style cron job scheduler with two modes: static (code-defined) and DB-driven (dynamic
                    scheduler). This demo showcases the cron expression parser and schedule utilities.
                </p>
            </div>

            {/* Overview card */}
            <Card className="border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg">Package Overview</CardTitle>
                    <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-medium text-foreground">Two scheduling modes:</p>
                        <ol className="list-inside list-decimal space-y-1">
                            <li>
                                <strong>Static CronHandler</strong> — define cron jobs in code with{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">createCronHandler()</code>.
                            </li>
                            <li>
                                <strong>DB Scheduler</strong> — Laravel-style scheduler with tasks stored in D1 via{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">createScheduler()</code>.
                            </li>
                        </ol>
                        <p className="pt-1">
                            All schedules run in <strong>UTC</strong>. Manage DB tasks via{' '}
                            <Link to="/admin/cron" className="text-primary underline">
                                Admin → Scheduled Tasks
                            </Link>
                            .
                        </p>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Cron expression parser */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Cron Expression Parser
                        </CardTitle>
                        <CardDescription>
                            Parse and validate cron expressions. Enter a 5-field expression (minute hour day month
                            weekday).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                value={expression}
                                onChange={(e) => setExpression(e.target.value)}
                                placeholder="*/15 * * * *"
                                className="font-mono"
                            />
                            <Button onClick={handleParse}>Parse</Button>
                        </div>

                        {parseError && (
                            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-900/20 dark:text-red-400">
                                <XCircle className="h-4 w-4 flex-shrink-0" />
                                {parseError}
                            </div>
                        )}

                        {parsed && (
                            <div className="space-y-3">
                                <div className="rounded-lg bg-muted p-3">
                                    <h4 className="mb-2 text-sm font-medium">Parsed Fields</h4>
                                    <div className="grid grid-cols-5 gap-2 text-center text-xs">
                                        {(
                                            [
                                                ['Minute', parsed.minutes],
                                                ['Hour', parsed.hours],
                                                ['Day', parsed.days],
                                                ['Month', parsed.months],
                                                ['Weekday', parsed.weekdays],
                                            ] as const
                                        ).map(([label, values]) => (
                                            <div key={label}>
                                                <div className="font-medium text-muted-foreground">{label}</div>
                                                <code className="text-foreground">{values.join(', ')}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium">Matches now:</span>
                                    {matchResult ? (
                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                            <CheckCircle className="mr-1 h-3 w-3" /> Yes
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary">
                                            <XCircle className="mr-1 h-3 w-3" /> No
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Next runs */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Next Scheduled Runs
                        </CardTitle>
                        <CardDescription>Upcoming execution times for the parsed expression (UTC).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {nextRuns.length > 0 ? (
                            <div className="space-y-2">
                                {nextRuns.map((run, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                                        <span className="text-sm font-medium">Run #{i + 1}</span>
                                        <code className="text-sm text-muted-foreground">
                                            {run
                                                .toISOString()
                                                .replace('T', ' ')
                                                .replace(/\.\d+Z$/, ' UTC')}
                                        </code>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Parse an expression to see upcoming runs.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Presets */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        CronPresets
                    </CardTitle>
                    <CardDescription>
                        Built-in schedule presets available via <code>CronPresets</code>. Click to load into the parser.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {presetEntries.map(([name, value]) => (
                            <button
                                key={name}
                                onClick={() => {
                                    setExpression(value);
                                    // Auto-parse after selecting preset
                                    try {
                                        const result = parseCron(value);
                                        setParsed(result);
                                        setParseError(null);
                                        setMatchResult(matchesCron(value, new Date()));
                                        const runs: Date[] = [];
                                        let from = new Date();
                                        for (let i = 0; i < 5; i++) {
                                            const next = getNextRun(value, from);
                                            if (next) {
                                                runs.push(next);
                                                from = new Date(next.getTime() + 60000);
                                            }
                                        }
                                        setNextRuns(runs);
                                    } catch {
                                        // Ignore parse errors for presets
                                    }
                                }}
                                className="flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                            >
                                <span className="text-sm font-medium">{name}</span>
                                <code className="text-xs text-muted-foreground">{value}</code>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Usage examples */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Usage Examples</CardTitle>
                    <CardDescription>How to use @ottabase/cron in your app.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Static CronHandler (code-defined jobs)</h4>
                        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                            <code>{`import { createCronHandler } from '@ottabase/cron';

const handler = createCronHandler({
    jobs: [
        {
            name: 'cleanup-sessions',
            schedule: '0 */6 * * *', // Every 6 hours
            handler: async (ctx) => {
                // Clean up expired sessions
            },
        },
    ],
});

// In your Cloudflare Worker:
export default { scheduled: handler };`}</code>
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">DB Scheduler (dynamic, Laravel-style)</h4>
                        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                            <code>{`import { createScheduler, createTaskRepository } from '@ottabase/cron';

const repo = createTaskRepository(db);
const scheduler = createScheduler({
    repository: repo,
    handlers: {
        'send-digest': async (task, ctx) => {
            // Send daily digest email
        },
    },
});

// Run pending tasks (called from Cloudflare scheduled event)
await scheduler.runPending();`}</code>
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
