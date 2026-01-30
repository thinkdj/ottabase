import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Textarea,
} from '@ottabase/ui-shadcn';
import { api, isApiError } from '@/lib/api';

interface QueueMessage {
    key: string;
    userId?: string;
    action?: string;
    data?: unknown;
    sentAt: string;
    type: 'single' | 'batch';
}

// Available job types from the registry
const JOB_TYPES = [
    { value: 'send-email', label: 'Send Email', description: 'Dispatch an email job' },
    { value: 'process-order', label: 'Process Order', description: 'Process an order' },
    { value: 'generate-report', label: 'Generate Report', description: 'Generate a report' },
    { value: 'sync-data', label: 'Sync Data', description: 'Synchronize data' },
    { value: 'batch-task', label: 'Batch Task', description: 'Generic batch task' },
] as const;

export function CloudflareQueuesDemoPage() {
    const [jobType, setJobType] = useState<string>('send-email');
    const [payload, setPayload] = useState('{\n  "to": "user@example.com",\n  "subject": "Welcome!"\n}');
    const [delay, setDelay] = useState<number>(0);
    const [batchCount, setBatchCount] = useState(3);
    const [messages, setMessages] = useState<QueueMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadMessages = async () => {
        try {
            const data = await api<{ messages?: QueueMessage[] }>('/api/cloudflare/queues');
            setMessages(data.messages || []);
        } catch {
            // ignore - toast handles errors
        }
    };

    useEffect(() => {
        void loadMessages();
        const interval = setInterval(loadMessages, 5000);
        return () => clearInterval(interval);
    }, []);

    // Update payload template when job type changes
    useEffect(() => {
        const templates: Record<string, string> = {
            'send-email': '{\n  "to": "user@example.com",\n  "subject": "Welcome!",\n  "template": "welcome"\n}',
            'process-order': '{\n  "orderId": "ORD-12345",\n  "userId": "user-123"\n}',
            'generate-report': '{\n  "reportType": "monthly-sales",\n  "params": { "month": 1, "year": 2024 }\n}',
            'sync-data': '{\n  "source": "crm",\n  "target": "analytics",\n  "entityType": "orders"\n}',
            'batch-task': '{\n  "taskNumber": 1,\n  "data": { "key": "value" }\n}',
        };
        setPayload(templates[jobType] || '{}');
    }, [jobType]);

    const handleDispatchJob = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            let parsedPayload: unknown;
            try {
                parsedPayload = JSON.parse(payload);
            } catch {
                setError('Invalid JSON payload');
                return;
            }

            await api('/api/cloudflare/queues', {
                method: 'POST',
                body: {
                    type: jobType,
                    payload: parsedPayload,
                    ...(delay > 0 ? { delay } : {}),
                },
            });

            setSuccess(`Job dispatched: ${jobType}${delay > 0 ? ` (delay: ${delay}s)` : ''}`);
            await loadMessages();
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleDispatchBatch = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const batch = Array.from({ length: batchCount }, (_, i) => ({
                userId: `user-${i + 1}`,
                action: 'batch-task',
                data: { taskNumber: i + 1 },
            }));

            await api('/api/cloudflare/queues', {
                method: 'POST',
                body: { batch },
            });

            setSuccess(`Dispatched ${batchCount} jobs to queue!`);
            await loadMessages();
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo/cloudflare">← Back to Cloudflare Features</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">Queue Demo</h1>
                <p className="text-muted-foreground">Async job dispatching with @ottabase/queue</p>
            </div>

            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">How it works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                        <strong>1. Dispatch:</strong> Jobs are dispatched to a Cloudflare Queue with a type and payload
                    </p>
                    <p>
                        <strong>2. Process:</strong> The queue handler routes jobs to registered handlers
                    </p>
                    <p>
                        <strong>3. Retry:</strong> Failed jobs are automatically retried (up to 3 times by default)
                    </p>
                    <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
                        {`// Dispatch a job from anywhere
import { dispatch } from "@ottabase/queue";

await dispatch(env.OBCF_QUEUE, "send-email", {
  to: "user@example.com",
  subject: "Welcome!",
});`}
                    </pre>
                </CardContent>
            </Card>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            {success && (
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm">{success}</p>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Dispatch Job</CardTitle>
                        <CardDescription>Send a job to the queue with typed payload</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleDispatchJob} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Job Type</label>
                                <select
                                    value={jobType}
                                    onChange={(e) => setJobType(e.target.value)}
                                    disabled={loading}
                                    aria-label="Job type"
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {JOB_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    {JOB_TYPES.find((t) => t.value === jobType)?.description}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Payload (JSON)</label>
                                <Textarea
                                    value={payload}
                                    onChange={(e) => setPayload(e.target.value)}
                                    disabled={loading}
                                    rows={5}
                                    className="font-mono text-xs"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Delay (seconds)</label>
                                <Input
                                    type="number"
                                    value={delay}
                                    onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
                                    min={0}
                                    max={43200}
                                    disabled={loading}
                                    placeholder="0 = immediate"
                                />
                                <p className="text-xs text-muted-foreground">Max delay: 43200 seconds (12 hours)</p>
                            </div>

                            <Button type="submit" disabled={loading} className="w-full">
                                Dispatch Job
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Batch Dispatch</CardTitle>
                        <CardDescription>Send multiple jobs at once</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Number of Jobs</label>
                            <Input
                                type="number"
                                value={batchCount}
                                onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                                min={1}
                                max={100}
                                disabled={loading}
                            />
                        </div>

                        <div className="rounded-lg bg-muted p-4">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">Preview:</p>
                            <pre className="overflow-x-auto text-xs">
                                {`{
  type: "batch-task",
  payload: {
    userId: "user-1",
    data: { taskNumber: 1 }
  }
}`}
                            </pre>
                            <p className="mt-2 text-xs text-muted-foreground">
                                ...and {Math.max(0, batchCount - 1)} more jobs
                            </p>
                        </div>

                        <Button onClick={handleDispatchBatch} disabled={loading || batchCount < 1} className="w-full">
                            Dispatch Batch ({batchCount} jobs)
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Registered Handlers</CardTitle>
                    <CardDescription>Job types that can be processed</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {JOB_TYPES.map((type) => (
                            <div key={type.value} className="rounded-lg border p-3">
                                <p className="font-mono text-sm">{type.value}</p>
                                <p className="text-xs text-muted-foreground">{type.description}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <CardTitle className="text-base">Recent Jobs</CardTitle>
                            <CardDescription>Jobs stored in KV for demo (expires after 1 hour)</CardDescription>
                        </div>
                        <Button onClick={loadMessages} disabled={loading} variant="outline" size="sm">
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No jobs dispatched yet</p>
                    ) : (
                        <div className="space-y-2">
                            {messages.map((msg) => (
                                <div key={msg.key} className="rounded-lg border p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <span className="font-mono text-sm font-medium">
                                                    {msg.action || 'unknown'}
                                                </span>
                                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    {msg.type}
                                                </span>
                                            </div>
                                            {msg.userId && (
                                                <p className="text-xs text-muted-foreground">User: {msg.userId}</p>
                                            )}
                                            {msg.data && (
                                                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                                                    {JSON.stringify(msg.data, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(msg.sentAt).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
