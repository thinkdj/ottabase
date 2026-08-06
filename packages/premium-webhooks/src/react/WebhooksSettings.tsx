'use client';

// ============================================================
// @ottabase/premium-webhooks/react — the drop-in settings surface
// ============================================================
// TAILWIND SETUP CHECKLIST (this fails with NO ERROR): a consuming app must add
//     '../../packages/premium-webhooks/src/**/*.{js,ts,jsx,tsx}'
// to its Tailwind `content` array, or these components render structurally correct and
// completely unstyled.
// ============================================================

import { PremiumGate, usePremiumLimit } from '@ottabase/premium/react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { CheckCircle2, Plus, Send, Trash2, TriangleAlert, Webhook } from 'lucide-react';
import { useState } from 'react';
import { WEBHOOKS_FEATURE_DELIVERY_LOG, WEBHOOKS_LIMIT_ENDPOINTS, WEBHOOKS_PACKAGE_KEY } from '../constants';
import { useWebhookDeliveries, useWebhookEndpoints } from './hooks';
import type { WebhookEndpointView } from '../ottaorm-models/WebhookEndpoint';

const QUIET_CARD = 'rounded-xl border-transparent bg-muted/40 shadow-none dark:bg-muted/20';
const MICRO_LABEL = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

function EndpointRow({
    endpoint,
    onDelete,
    onTest,
    busy,
}: {
    endpoint: WebhookEndpointView;
    onDelete: () => void;
    onTest: () => void;
    busy: boolean;
}) {
    const healthy = endpoint.lastStatus === 'success';
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3 text-sm ring-1 ring-border">
            <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                    {endpoint.lastStatus ? (
                        healthy ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                        ) : (
                            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-warning" />
                        )
                    ) : null}
                    <span className="truncate font-mono text-xs">{endpoint.url}</span>
                    {!endpoint.enabled ? (
                        <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                            paused
                        </Badge>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                    {endpoint.events.map((event) => (
                        <Badge key={event} variant="outline" className="rounded-full font-mono text-[0.6875rem]">
                            {event}
                        </Badge>
                    ))}
                    {endpoint.lastStatus ? (
                        <span className="text-xs">
                            last {endpoint.lastStatus}
                            {endpoint.lastStatusCode ? ` (${endpoint.lastStatusCode})` : ''}
                            {endpoint.consecutiveFailures > 0 ? ` · ${endpoint.consecutiveFailures} failing` : ''}
                        </span>
                    ) : (
                        <span className="text-xs">no deliveries yet</span>
                    )}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={onTest} disabled={busy}>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Test
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy} aria-label="Delete endpoint">
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

function DeliveryLog() {
    const { data, isLoading } = useWebhookDeliveries();

    if (isLoading) return <div className="h-20 animate-pulse rounded-lg bg-background/60" aria-busy="true" />;
    if (!data || data.length === 0) {
        return <p className="text-sm text-muted-foreground">No deliveries recorded yet.</p>;
    }

    return (
        <div className="space-y-1.5">
            {data.map((delivery) => (
                <div
                    key={delivery.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-xs ring-1 ring-border"
                >
                    <span className="font-mono">{delivery.event}</span>
                    <span className="text-muted-foreground">
                        {new Date(delivery.createdAt).toLocaleString()}
                        {delivery.durationMs !== null ? ` · ${delivery.durationMs}ms` : ''}
                    </span>
                    <Badge
                        variant={delivery.status === 'success' ? 'default' : 'destructive'}
                        className="rounded-full text-[0.6875rem]"
                    >
                        {delivery.statusCode ?? delivery.error ?? delivery.status}
                    </Badge>
                </div>
            ))}
        </div>
    );
}

export interface WebhooksSettingsProps {
    /** Event names offered in the create form. Defaults to the server's catalog. */
    events?: string[];
}

/**
 * Endpoint management, plus the paid delivery log behind its own gate.
 *
 * The create form is disabled by the SAME limit the server enforces, read from the
 * server-resolved status — so the button and the 402 can never disagree about what the
 * plan allows.
 */
export function WebhooksSettings({ events }: WebhooksSettingsProps) {
    const { data, isLoading, create, remove, test, catalog } = useWebhookEndpoints();
    const [url, setUrl] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [secret, setSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const endpoints = data ?? [];
    const limitGate = usePremiumLimit(WEBHOOKS_PACKAGE_KEY, WEBHOOKS_LIMIT_ENDPOINTS, endpoints.length);
    const options = events ?? catalog.data ?? ['*'];

    const onCreate = async () => {
        setError(null);
        setSecret(null);
        try {
            const created = await create.mutateAsync({ url, events: selected.length > 0 ? selected : ['*'] });
            // Shown once, and only here: the server never returns it again.
            setSecret(created.secret ?? null);
            setUrl('');
            setSelected([]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create the endpoint');
        }
    };

    return (
        <div className="space-y-6">
            <Card className={QUIET_CARD}>
                <CardHeader className="gap-1.5">
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Webhook className="h-4 w-4 text-muted-foreground" />
                        Endpoints
                        <span className="text-xs font-normal text-muted-foreground">
                            {endpoints.length}
                            {limitGate.limit !== undefined && limitGate.limit >= 0 ? ` / ${limitGate.limit}` : ''}
                        </span>
                    </CardTitle>
                    <CardDescription>
                        Every delivery is signed with the endpoint&apos;s secret. Verify it before you trust the body.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="h-16 animate-pulse rounded-lg bg-background/60" aria-busy="true" />
                    ) : endpoints.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No endpoints yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {endpoints.map((endpoint) => (
                                <EndpointRow
                                    key={endpoint.id}
                                    endpoint={endpoint}
                                    busy={remove.isPending || test.isPending}
                                    onDelete={() => void remove.mutateAsync(endpoint.id)}
                                    onTest={() => void test.mutateAsync(endpoint.id)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className={MICRO_LABEL} htmlFor="webhook-url">
                            Add an endpoint
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                id="webhook-url"
                                value={url}
                                onChange={(event) => setUrl(event.target.value)}
                                placeholder="https://example.com/hooks/ottabase"
                                className="font-mono text-xs"
                                spellCheck={false}
                                disabled={!limitGate.allowed}
                            />
                            <Button
                                size="sm"
                                className="shrink-0"
                                onClick={onCreate}
                                disabled={!url.trim() || create.isPending || !limitGate.allowed}
                            >
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                {create.isPending ? 'Adding…' : 'Add'}
                            </Button>
                        </div>

                        {options.length > 1 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {options.map((event) => {
                                    const active = selected.includes(event);
                                    return (
                                        <button
                                            key={event}
                                            type="button"
                                            onClick={() =>
                                                setSelected((current) =>
                                                    active
                                                        ? current.filter((value) => value !== event)
                                                        : [...current, event],
                                                )
                                            }
                                            className={`rounded-full px-2 py-0.5 font-mono text-[0.6875rem] ring-1 transition-colors ${
                                                active
                                                    ? 'bg-primary text-primary-foreground ring-primary'
                                                    : 'bg-background text-muted-foreground ring-border hover:text-foreground'
                                            }`}
                                        >
                                            {event}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}

                        {!limitGate.allowed && !limitGate.isLoading ? (
                            <p className="text-xs text-muted-foreground">
                                Your plan includes {limitGate.limit ?? 0} endpoint
                                {(limitGate.limit ?? 0) === 1 ? '' : 's'}. Upgrade to add more.
                            </p>
                        ) : null}
                        {error ? <p className="text-xs text-destructive">{error}</p> : null}
                    </div>

                    {secret ? (
                        <div className="space-y-1 rounded-lg bg-background p-3 ring-1 ring-border">
                            <p className={MICRO_LABEL}>Signing secret — shown once</p>
                            <code className="block break-all font-mono text-xs">{secret}</code>
                            <p className="text-xs text-muted-foreground">
                                Store it now. It is not retrievable later; delete and recreate the endpoint if you lose
                                it.
                            </p>
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <Card className={QUIET_CARD}>
                <CardHeader className="gap-1.5">
                    <CardTitle className="text-[0.9375rem] font-semibold">Delivery log</CardTitle>
                    <CardDescription>Every attempt, with status and duration.</CardDescription>
                </CardHeader>
                <CardContent>
                    <PremiumGate
                        packageKey={WEBHOOKS_PACKAGE_KEY}
                        feature={WEBHOOKS_FEATURE_DELIVERY_LOG}
                        title="Delivery history"
                        description="Retained delivery history is part of the paid plan. Endpoint health above stays available on every plan."
                    >
                        <DeliveryLog />
                    </PremiumGate>
                </CardContent>
            </Card>
        </div>
    );
}
