import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input,
    Textarea,
} from "@ottabase/ui-shadcn";
import { api, isApiError } from "@/lib/api";

interface QueueMessage {
    key: string;
    userId?: string;
    action?: string;
    data?: unknown;
    sentAt: string;
    type: "single" | "batch";
}

export function CloudflareQueuesDemoPage() {
    const [userId, setUserId] = useState("");
    const [action, setAction] = useState("send-email");
    const [customData, setCustomData] = useState("");
    const [batchCount, setBatchCount] = useState(3);
    const [messages, setMessages] = useState<QueueMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadMessages = async () => {
        try {
            const data = await api<{ messages?: QueueMessage[] }>("/api/cloudflare/queues");
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

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const message: Record<string, unknown> = { action };
            if (userId) message.userId = userId;

            if (customData) {
                try {
                    message.data = JSON.parse(customData);
                } catch {
                    message.data = customData;
                }
            }

            await api("/api/cloudflare/queues", {
                method: "POST",
                body: { message },
            });

            setSuccess("Message sent to queue successfully!");
            setUserId("");
            setCustomData("");
            await loadMessages();
        } catch (err) {
            setError(isApiError(err) ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const handleSendBatch = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const batch = Array.from({ length: batchCount }, (_, i) => ({
                userId: `user-${i + 1}`,
                action: "batch-task",
                data: { taskNumber: i + 1 },
            }));

            await api("/api/cloudflare/queues", {
                method: "POST",
                body: { batch },
            });

            setSuccess(`Sent ${batchCount} messages to queue successfully!`);
            await loadMessages();
        } catch (err) {
            setError(isApiError(err) ? err.message : "Unknown error");
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
                <h1 className="mb-2 text-3xl font-semibold">Queues Demo</h1>
                <p className="text-muted-foreground">Async message queue processing</p>
            </div>

            {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            ) : null}

            {success ? (
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm">{success}</p>
                </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Send Single Message</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSendMessage} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">User ID (optional)</label>
                                <Input
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    placeholder="user-123"
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Action</label>
                                <select
                                    value={action}
                                    onChange={(e) => setAction(e.target.value)}
                                    disabled={loading}
                                    aria-label="Queue action"
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="send-email">send-email</option>
                                    <option value="process-order">process-order</option>
                                    <option value="generate-report">generate-report</option>
                                    <option value="sync-data">sync-data</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Custom Data (JSON, optional)</label>
                                <Textarea
                                    value={customData}
                                    onChange={(e) => setCustomData(e.target.value)}
                                    placeholder='{"key": "value"}'
                                    disabled={loading}
                                    rows={3}
                                    className="font-mono"
                                />
                            </div>

                            <Button type="submit" disabled={loading || !action} className="w-full">
                                Send Message
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Send Batch</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Number of Messages</label>
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
                                {JSON.stringify(
                                    {
                                        userId: "user-1",
                                        action: "batch-task",
                                        data: { taskNumber: 1 },
                                    },
                                    null,
                                    2,
                                )}
                            </pre>
                            <p className="mt-2 text-xs text-muted-foreground">
                                ...and {Math.max(0, batchCount - 1)} more messages
                            </p>
                        </div>

                        <Button onClick={handleSendBatch} disabled={loading || batchCount < 1} className="w-full">
                            Send Batch ({batchCount} messages)
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Recent Messages</CardTitle>
                        <Button onClick={loadMessages} disabled={loading} variant="outline" size="sm">
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        Messages are stored in KV for demo purposes and expire after 1 hour
                    </p>

                    {messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No messages sent yet</p>
                    ) : (
                        <div className="space-y-2">
                            {messages.map((msg) => (
                                <div key={msg.key} className="rounded-lg border p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <span className="text-sm font-medium">
                                                    {msg.action || "No action"}
                                                </span>
                                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    {msg.type}
                                                </span>
                                            </div>
                                            {msg.userId ? (
                                                <p className="text-xs text-muted-foreground">User: {msg.userId}</p>
                                            ) : null}
                                            {msg.data ? (
                                                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                                                    {JSON.stringify(msg.data, null, 2)}
                                                </pre>
                                            ) : null}
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
