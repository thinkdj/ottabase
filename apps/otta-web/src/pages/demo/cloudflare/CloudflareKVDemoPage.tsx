import { api, isApiError } from '@/lib/api';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@ottabase/ui-shadcn';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

export function CloudflareKVDemoPage() {
    const [key, setKey] = useState('');
    const [value, setValue] = useState('');
    const [ttl, setTtl] = useState('');
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!key || !value) return;

        try {
            setLoading(true);
            setError(null);

            await api('/api/cloudflare/kv', {
                method: 'POST',
                body: {
                    key,
                    value,
                    ttl: ttl ? parseInt(ttl) : undefined,
                },
            });

            setResult('Value set successfully!');
            setValue('');
            setTtl('');
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleGet = async () => {
        if (!key) return;

        try {
            setLoading(true);
            setError(null);

            const data = await api<{ value?: string | null }>('/api/cloudflare/kv', {
                params: { key },
            });

            setResult(data.value ? `Value: ${data.value}` : 'Key not found');
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!key) return;

        try {
            setLoading(true);
            setError(null);

            await api('/api/cloudflare/kv', {
                method: 'DELETE',
                params: { key },
            });

            setResult('Value deleted successfully!');
            setKey('');
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="KV Storage"
                description="Key-value storage with optional TTL (Time To Live)"
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare"
            />

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {result ? (
                <div className="rounded-xl bg-muted/40 p-4">
                    <p className="text-sm">{result}</p>
                </div>
            ) : null}

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Operations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Key</label>
                        <Input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="my-key"
                            disabled={loading}
                        />
                    </div>

                    <form onSubmit={handleSet} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Value</label>
                            <Textarea
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="my-value"
                                disabled={loading}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">TTL (seconds, optional)</label>
                            <Input
                                type="number"
                                value={ttl}
                                onChange={(e) => setTtl(e.target.value)}
                                placeholder="3600"
                                disabled={loading}
                                min={1}
                            />
                        </div>

                        <Button type="submit" disabled={loading || !key || !value} className="w-full">
                            Set Value
                        </Button>
                    </form>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleGet} disabled={loading || !key} className="flex-1">
                            Get Value
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={loading || !key}
                            className="flex-1"
                        >
                            Delete
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
