import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@ottabase/ui-shadcn";
import { api, isApiError } from "@/lib/api";

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
                setResult(`Error ${err.status}: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">API Client Demo</h1>
                <p className="text-muted-foreground">@ottabase/api fetch wrapper</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Test Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => runRequest(() => api<DemoResponse>("/api/demo"))}
                            disabled={loading}
                        >
                            GET
                        </Button>
                        <Button
                            onClick={() => runRequest(() => api<DemoResponse>("/api/demo", {
                                method: "POST",
                                body: { name: "Ottabase" },
                            }))}
                            disabled={loading}
                            variant="secondary"
                        >
                            POST
                        </Button>
                        <Button
                            onClick={() => runRequest(() => api<DemoResponse>("/api/demo", "DELETE"))}
                            disabled={loading}
                            variant="outline"
                        >
                            DELETE (shorthand)
                        </Button>
                        <Button
                            onClick={() => runRequest(() => api<DemoResponse>("/api/demo/error"))}
                            disabled={loading}
                            variant="destructive"
                        >
                            Trigger Error
                        </Button>
                    </div>

                    {result && (
                        <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto">
                            {result}
                        </pre>
                    )}
                </CardContent>
            </Card>

            <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                <p className="font-medium mb-2">Usage:</p>
                <pre className="text-xs">
{`await api("/api/demo");              // GET
await api("/api/demo", "DELETE");    // shorthand
await api("/api/demo", { method: "POST", body: {...} });`}
                </pre>
            </div>
        </div>
    );
}
