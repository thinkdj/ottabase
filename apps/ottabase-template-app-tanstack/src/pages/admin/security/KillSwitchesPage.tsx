import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@ottabase/ui-shadcn';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface KillSwitchStatus {
    readonly: boolean;
    lockdown: boolean;
}

async function fetchStatus(): Promise<KillSwitchStatus> {
    try {
        const res = await api<{ readonly: boolean; lockdown: boolean }>('/api/system/kill-switches');
        return { readonly: !!res.readonly, lockdown: !!res.lockdown };
    } catch {
        return { readonly: false, lockdown: false };
    }
}

export default function KillSwitchesPage() {
    const [status, setStatus] = useState<KillSwitchStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStatus()
            .then(setStatus)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Platform Kill Switches</h1>
                <p className="text-muted-foreground mt-2">
                    Environment-driven global overrides. Set variables in Cloudflare env:
                    <code className="mx-1">KILLSWITCH_READONLY_MODE</code> and
                    <code className="mx-1">KILLSWITCH_LOCKDOWN</code>.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Read-only mode</CardTitle>
                        <CardDescription>Blocks POST/PUT/PATCH/DELETE; reads remain available.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-3">
                        {loading ? (
                            <span className="text-muted-foreground text-sm">Checking…</span>
                        ) : (
                            <Badge variant={status?.readonly ? 'destructive' : 'secondary'}>
                                {status?.readonly ? 'Enabled' : 'Disabled'}
                            </Badge>
                        )}
                        <div className="text-sm text-muted-foreground">
                            Set <code>KILLSWITCH_READONLY_MODE=true</code> to enable. Default is false.
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Lockdown</CardTitle>
                        <CardDescription>Returns “LOCKDOWN ENFORCED” for every route (API + assets).</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-3">
                        {loading ? (
                            <span className="text-muted-foreground text-sm">Checking…</span>
                        ) : (
                            <Badge variant={status?.lockdown ? 'destructive' : 'secondary'}>
                                {status?.lockdown ? 'Enabled' : 'Disabled'}
                            </Badge>
                        )}
                        <div className="text-sm text-muted-foreground">
                            Set <code>KILLSWITCH_LOCKDOWN=true</code> to enable. Default is false.
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>How to toggle</CardTitle>
                    <CardDescription>Set environment variables and redeploy / restart Worker.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                        <strong>Read-only</strong>: blocks write HTTP verbs at the edge; responses return 503 with code
                        <code className="mx-1">READONLY_MODE</code>.
                    </p>
                    <p>
                        <strong>Lockdown</strong>: short-circuits all routes and assets with a static HTML payload
                        “LOCKDOWN ENFORCED”.
                    </p>
                    <p>
                        Both switches are evaluated on every request, before platform readiness, so they protect API and
                        static content consistently.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
