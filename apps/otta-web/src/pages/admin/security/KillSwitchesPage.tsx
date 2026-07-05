import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Lock, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const CODE_CLASS = 'rounded bg-muted px-1 py-0.5 font-mono text-xs';

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

/** Armed switches get a warning-tinted surface; disarmed ones rest on the quiet tint. */
function SwitchCard({
    armed,
    loading,
    icon,
    title,
    description,
    children,
}: {
    armed: boolean;
    loading: boolean;
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <Card
            className={`rounded-xl shadow-none ${
                armed ? 'border-warning/30 bg-warning/10' : 'border-transparent bg-muted/40'
            }`}
        >
            <CardHeader className="gap-2">
                <div className="flex items-center justify-between">
                    <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg bg-background ring-1 ${
                            armed ? 'text-warning ring-warning/30' : 'text-muted-foreground ring-border'
                        }`}
                    >
                        {icon}
                    </span>
                    {loading ? (
                        <span aria-busy="true">
                            <span className="sr-only">Checking status…</span>
                            <span className="block h-5 w-20 animate-pulse rounded-full bg-background/60" />
                        </span>
                    ) : (
                        <Badge
                            variant="outline"
                            className={`gap-1.5 rounded-full border-transparent bg-background text-[0.6875rem] font-medium uppercase tracking-wide ring-1 ${
                                armed ? 'text-warning ring-warning/30' : 'text-muted-foreground ring-border'
                            }`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${armed ? 'bg-warning' : 'bg-muted-foreground/40'}`}
                                aria-hidden="true"
                            />
                            {armed ? 'Enabled' : 'Disabled'}
                        </Badge>
                    )}
                </div>
                <CardTitle className="text-[0.9375rem] font-semibold">{title}</CardTitle>
                <CardDescription className="leading-relaxed">{description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">{children}</CardContent>
        </Card>
    );
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
        <div className="space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Platform Kill Switches</h1>
                <p className="max-w-3xl text-muted-foreground">
                    Environment-driven global overrides. Set variables in Cloudflare env:
                    <code className={`mx-1 ${CODE_CLASS}`}>KILLSWITCH_READONLY_MODE</code> and
                    <code className={`mx-1 ${CODE_CLASS}`}>KILLSWITCH_LOCKDOWN</code>.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <SwitchCard
                    armed={!!status?.readonly}
                    loading={loading}
                    icon={<Lock className="h-4 w-4" />}
                    title="Read-only mode"
                    description="Blocks POST/PUT/PATCH/DELETE; reads remain available."
                >
                    Set <code className={CODE_CLASS}>KILLSWITCH_READONLY_MODE=true</code> to enable. Default is false.
                </SwitchCard>

                <SwitchCard
                    armed={!!status?.lockdown}
                    loading={loading}
                    icon={<ShieldAlert className="h-4 w-4" />}
                    title="Lockdown"
                    description="Returns “LOCKDOWN ENFORCED” for every route (API + assets)."
                >
                    Set <code className={CODE_CLASS}>KILLSWITCH_LOCKDOWN=true</code> to enable. Default is false.
                </SwitchCard>
            </div>

            <div className="space-y-3 rounded-xl bg-muted/40 p-6">
                <div className="space-y-1.5">
                    <h2 className="text-[0.9375rem] font-semibold">How to toggle</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Set environment variables and redeploy / restart Worker.
                    </p>
                </div>
                <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                    <p>
                        <strong className="font-medium text-foreground">Read-only</strong>: blocks write HTTP verbs at
                        the edge; responses return 503 with code
                        <code className={`mx-1 ${CODE_CLASS}`}>READONLY_MODE</code>.
                    </p>
                    <p>
                        <strong className="font-medium text-foreground">Lockdown</strong>: short-circuits all routes and
                        assets with a static HTML payload “LOCKDOWN ENFORCED”.
                    </p>
                    <p>
                        Both switches are evaluated on every request, before platform readiness, so they protect API and
                        static content consistently.
                    </p>
                </div>
            </div>
        </div>
    );
}
