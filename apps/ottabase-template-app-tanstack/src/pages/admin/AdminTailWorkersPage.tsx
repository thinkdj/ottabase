import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { api } from '@/lib/api';
import { useRBACToast } from '@/hooks/useToast';
import { ArrowLeft, Copy, RefreshCw, Terminal } from 'lucide-react';

interface TailWorkerTarget {
    id: string;
    name: string;
    description: string;
    filterHint: string;
}

interface TailWorkersOverview {
    workerName: string;
    environment: string;
    nodeEnv: string;
    tailCommands: {
        basic: string;
        json: string;
        sampled: string;
    };
    logTargets: TailWorkerTarget[];
}

const FALLBACK_COMMANDS = {
    basic: 'wrangler tail <worker-name>',
    json: 'wrangler tail <worker-name> --format json',
    sampled: 'wrangler tail <worker-name> --format json --sampling 0.1',
};

const FALLBACK_TARGETS: TailWorkerTarget[] = [
    {
        id: 'queue',
        name: 'Queue processors',
        description: 'Background job handlers dispatched via Cloudflare Queues (OBCF_QUEUE).',
        filterHint: 'wrangler tail <worker> --format json --search "queue"',
    },
    {
        id: 'cron',
        name: 'Scheduled tasks',
        description: 'Cron jobs created in the Admin → Scheduled Tasks console.',
        filterHint: 'wrangler tail <worker> --format json --search "cron"',
    },
    {
        id: 'realtime',
        name: 'Realtime events',
        description: 'Durable Object realtime activity (OBCF_REALTIME).',
        filterHint: 'wrangler tail <worker> --format json --search "realtime"',
    },
];

export function AdminTailWorkersPage() {
    const toast = useRBACToast();
    const { data, error, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['admin', 'tail-workers'],
        queryFn: () => api<TailWorkersOverview>('/api/admin/tail-workers'),
    });

    const tailCommands = data?.tailCommands ?? FALLBACK_COMMANDS;
    const logTargets = data?.logTargets ?? FALLBACK_TARGETS;
    const workerName = data?.workerName ?? '<worker-name>';
    const environment = data?.environment ?? 'unknown';
    const nodeEnv = data?.nodeEnv ?? 'unknown';

    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied', `${label} copied to clipboard.`);
        } catch (err) {
            toast.error('Copy failed', 'Unable to access the clipboard.');
            console.error('Copy failed', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tail Workers</h1>
                    <p className="text-muted-foreground mt-2">
                        Stream Cloudflare Worker logs for queue, cron, and realtime debugging.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                        <Link to="/admin">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Admin
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {error && <ApiErrorDisplay error={error} onRetry={() => refetch()} />}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Terminal className="h-5 w-5" />
                        Tail Commands
                    </CardTitle>
                    <CardDescription>
                        Use these commands in a terminal to stream logs for log-processing workers.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Worker: {workerName}</Badge>
                        <Badge variant="outline">Environment: {environment}</Badge>
                        <Badge variant="outline">Node: {nodeEnv}</Badge>
                        {isLoading && <Badge variant="secondary">Fetching status...</Badge>}
                    </div>

                    <div className="space-y-3">
                        {[
                            { label: 'Basic tail', value: tailCommands.basic },
                            { label: 'JSON output', value: tailCommands.json },
                            { label: 'Sampled (10%)', value: tailCommands.sampled },
                        ].map((command) => (
                            <div
                                key={command.label}
                                className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 md:flex-row md:items-center md:justify-between"
                            >
                                <div>
                                    <p className="text-sm font-medium">{command.label}</p>
                                    <p className="font-mono text-sm text-muted-foreground">{command.value}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopy(command.value, command.label)}
                                    className="self-start md:self-auto"
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Log Processing Targets</CardTitle>
                    <CardDescription>Suggested filters for debugging specific worker subsystems.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Target</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Filter Hint</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logTargets.map((target) => (
                                <TableRow key={target.id}>
                                    <TableCell className="font-medium">{target.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {target.description}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {target.filterHint}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
