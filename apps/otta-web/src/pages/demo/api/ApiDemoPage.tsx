import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { api, isApiError } from '@/lib/api';
import { DemoPageHeader } from '../DemoPageHeader';

interface DemoResponse {
    message: string;
    timestamp: number;
}

export function ApiDemoPage() {
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const runRequest = async (fn: () => Promise<DemoResponse>) => {
        setLoading(true);
        setResult(null);
        try {
            const data = await fn();
            setResult(JSON.stringify(data, null, 2));
        } catch (err) {
            if (isApiError(err)) {
                // Show a formatted error with the full API response details
                const errorDetails = {
                    status: err.status,
                    message: err.message,
                    code: err.code,
                    details: err.details,
                    hint: err.hint,
                    messages: err.messages,
                    fieldErrors: err.fieldErrors,
                };
                setResult(
                    `Error ${err.status}: ${err.message}\n\nAPI Response:\n${JSON.stringify(errorDetails, null, 2)}`,
                );
            } else {
                setResult(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader title="API Client" description="@ottabase/api fetch wrapper" />

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Test Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => runRequest(() => api<DemoResponse>('/api/demo'))} disabled={loading}>
                            GET
                        </Button>
                        <Button
                            onClick={() =>
                                runRequest(() =>
                                    api<DemoResponse>('/api/demo', {
                                        method: 'POST',
                                        body: { name: 'Ottabase' },
                                    }),
                                )
                            }
                            disabled={loading}
                            variant="secondary"
                        >
                            POST
                        </Button>
                        <Button
                            onClick={() => runRequest(() => api<DemoResponse>('/api/demo', 'DELETE'))}
                            disabled={loading}
                            variant="outline"
                        >
                            DELETE (shorthand)
                        </Button>
                        <Button
                            onClick={() => runRequest(() => api<DemoResponse>('/api/demo/error'))}
                            disabled={loading}
                            variant="destructive"
                        >
                            Trigger Error
                        </Button>
                    </div>

                    {result && (
                        <pre className="overflow-auto rounded-lg bg-background p-4 text-sm ring-1 ring-border">
                            {result}
                        </pre>
                    )}
                </CardContent>
            </Card>

            <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Usage</p>
                <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                    {`await api("/api/demo");              // GET
await api("/api/demo", "DELETE");    // shorthand
await api("/api/demo", { method: "POST", body: {...} });`}
                </pre>
            </div>
        </div>
    );
}
