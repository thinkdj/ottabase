import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input,
    Progress,
} from "@ottabase/ui-shadcn";

interface RateLimitResult {
    success: boolean;
    message?: string;
    error?: string;
    limit: number;
    remaining: number;
    resetAfter: number;
}

export function CloudflareRateLimitingDemoPage() {
    const [key, setKey] = useState("demo-user-1");
    const [result, setResult] = useState<RateLimitResult | null>(null);
    const [requestCount, setRequestCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTestLimit = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch("/api/cloudflare/rate-limiting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key }),
            });

            const data = (await response.json()) as {
                message?: string;
                error?: string;
                limit: number;
                remaining: number;
                resetAfter: number;
            };

            if (response.status === 429) {
                setResult({
                    success: false,
                    error: data.error,
                    limit: data.limit,
                    remaining: data.remaining,
                    resetAfter: data.resetAfter,
                });
            } else if (!response.ok) {
                setError(data.error || "Failed to test rate limit");
                setResult(null);
            } else {
                setResult({
                    success: true,
                    message: data.message,
                    limit: data.limit,
                    remaining: data.remaining,
                    resetAfter: data.resetAfter,
                });
            }

            setRequestCount((prev) => prev + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const handleRapidTest = async () => {
        setRequestCount(0);
        for (let i = 0; i < 15; i++) {
            // eslint-disable-next-line no-await-in-loop
            await handleTestLimit();
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    };

    const progressValue = result
        ? Math.max(0, Math.min(100, (result.remaining / result.limit) * 100))
        : 0;

    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo/cloudflare">← Back to Cloudflare Features</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">Rate Limiting Demo</h1>
                <p className="text-muted-foreground">Request throttling and protection</p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                    Local dev typically uses a KV-based simulation fallback.
                </p>
            </div>

            {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Test a Key</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Rate Limit Key (user ID, IP, etc.)
                        </label>
                        <Input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="user-123"
                            disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Different keys have separate rate limits
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={handleTestLimit} disabled={loading || !key} className="flex-1">
                            {loading ? "Testing..." : "Test Rate Limit"}
                        </Button>
                        <Button
                            onClick={handleRapidTest}
                            disabled={loading || !key}
                            variant="outline"
                            className="flex-1"
                        >
                            Rapid Test (15)
                        </Button>
                    </div>

                    {result ? (
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {result.success ? "✓ Request Allowed" : "✗ Rate Limit Exceeded"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Request #{requestCount}
                                </span>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Limit:</span>
                                    <span className="font-medium">{result.limit} requests</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Remaining:</span>
                                    <span className="font-medium">{result.remaining} requests</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reset after:</span>
                                    <span className="font-medium">{result.resetAfter} seconds</span>
                                </div>
                            </div>

                            <div className="mt-3 space-y-1">
                                <Progress value={progressValue} />
                                <p className="text-xs text-muted-foreground">
                                    {result.remaining} of {result.limit} requests remaining
                                </p>
                            </div>

                            {!result.success ? (
                                <p className="mt-3 text-sm text-destructive">
                                    {result.error || "Too many requests. Please try again later."}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
