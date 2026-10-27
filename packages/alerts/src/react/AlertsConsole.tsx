'use client';

// ============================================================
// @ottabase/alerts/react: the console
// ============================================================
// TAILWIND SETUP CHECKLIST (this fails with NO ERROR): a consuming app must add
//     @source '../../../../packages/alerts/src';
// to its stylesheet, or these components render structurally correct and completely
// unstyled. otta-web's globals.css already has it.
//
// Three parts: the last day at a glance, the channels (add, change, test, switch off), and
// the feed (every alert, where it went, and a retry for what failed). Targets are never
// shown back: a change leaves a secret field blank to keep what is stored.
// ============================================================

import {
    Button,
    Input,
    Label,
    LiveDot,
    NativeSelect,
    NativeSelectOption,
    Stat,
    StatusChip,
    Switch,
    Tag,
    type Tone,
} from '@ottabase/ui';
import {
    BellRing,
    ExternalLink,
    Hash,
    KeyRound,
    Mail,
    MessageSquare,
    Pencil,
    Plus,
    RotateCcw,
    Send,
    Siren,
    Trash2,
    Webhook,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import type {
    AlertView,
    ChannelInput,
    ChannelMode,
    ChannelType,
    ChannelView,
    DeliveryStatus,
    DeliveryView,
    Severity,
} from '../types';
import { useAlertActions, useAlertChannels, useAlertFeed, useAlertsSummary, type ChannelTypeInfo } from './hooks';

/** "3h ago" for a timestamp. */
export function ago(at: number, now = Date.now()): string {
    const seconds = Math.max(0, Math.round((now - at) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

const TYPE_ICON: Record<ChannelType, LucideIcon> = {
    email: Mail,
    slack: Hash,
    discord: MessageSquare,
    telegram: Send,
    pagerduty: Siren,
    webhook: Webhook,
};

const TYPE_HELP: Record<ChannelType, string> = {
    email: 'Sent through the app mailer. Up to ten addresses.',
    slack: 'Slack → Apps → Incoming Webhooks → Add to a channel, then paste the URL.',
    discord: 'Channel settings → Integrations → Webhooks → New webhook → Copy URL.',
    telegram: 'Create a bot with @BotFather, add it to the chat, and use the chat id (-100… for groups).',
    pagerduty: 'A service → Integrations → Events API v2. Pages at once; never capped or batched.',
    webhook: 'A JSON POST signed with X-Ottabase-Signature, the same scheme as @ottabase/webhooks.',
};

const SEVERITY_TONE: Record<Severity, Tone> = { info: 'blue', warning: 'amber', critical: 'red' };
const DELIVERY_TONE: Record<DeliveryStatus, Tone> = {
    pending: 'neutral',
    sending: 'neutral',
    sent: 'green',
    digested: 'green',
    failed: 'amber',
    dead: 'red',
    held: 'smoke',
    digest: 'smoke',
};
const DELIVERY_WORD: Record<DeliveryStatus, string> = {
    pending: 'sending',
    sending: 'sending',
    sent: 'sent',
    digested: 'in a summary',
    failed: 'retrying',
    dead: 'failed',
    held: 'held (hourly limit)',
    digest: 'in the next digest',
};

const fieldClass = 'space-y-1.5';
const hint = (text: ReactNode) => <p className="text-xs text-muted-foreground">{text}</p>;

function channelHealth(channel: ChannelView): { tone: 'green' | 'amber' | 'red' | 'smoke'; label: string } {
    if (!channel.enabled) return { tone: 'smoke', label: 'Off' };
    if (!channel.readable) return { tone: 'red', label: 'Target unreadable: enter it again' };
    if (channel.fromEnv && channel.lastError) return { tone: 'red', label: channel.lastError };
    if (channel.failures >= 3) return { tone: 'red', label: `Failing: ${channel.lastError ?? 'see the feed'}` };
    if (channel.failures > 0) return { tone: 'amber', label: `Last send failed: ${channel.lastError ?? ''}` };
    return { tone: 'green', label: channel.lastSentAt ? `Last sent ${ago(channel.lastSentAt)}` : 'Nothing sent yet' };
}

// ── The channel form ─────────────────────────────────────────

interface Draft {
    name: string;
    type: ChannelType;
    minSeverity: Severity;
    sources: string;
    mode: ChannelMode;
    digestHour: string;
    maxPerHour: string;
    to: string;
    url: string;
    botToken: string;
    chatId: string;
    routingKey: string;
    signingSecret: string;
    rotateSigningSecret: boolean;
}

const blank = (type: ChannelType = 'slack'): Draft => ({
    name: '',
    type,
    minSeverity: type === 'pagerduty' ? 'critical' : 'info',
    sources: '',
    mode: 'immediate',
    digestHour: '8',
    maxPerHour: '30',
    to: '',
    url: '',
    botToken: '',
    chatId: '',
    routingKey: '',
    signingSecret: '',
    rotateSigningSecret: false,
});

const draftOf = (channel: ChannelView): Draft => ({
    ...blank(channel.type),
    name: channel.name,
    minSeverity: channel.minSeverity,
    sources: (channel.sources ?? []).join(', '),
    mode: channel.mode,
    digestHour: String(channel.digestHour),
    maxPerHour: String(channel.maxPerHour),
    to: (channel.config.to ?? []).join(', '),
    chatId: channel.config.chatId ?? '',
});

/** The input to send: only the target fields the type has, and on a change only the secrets typed in. */
function inputOf(draft: Draft, editing: boolean): ChannelInput {
    const secret = (value: string) => (value.trim() ? value.trim() : editing ? undefined : '');
    const input: ChannelInput = {
        name: draft.name,
        minSeverity: draft.minSeverity,
        sources: draft.sources.trim() ? draft.sources.split(',') : null,
        mode: draft.mode,
        digestHour: Number(draft.digestHour),
        maxPerHour: Number(draft.maxPerHour),
        ...(editing ? {} : { type: draft.type }),
    };
    switch (draft.type) {
        case 'email':
            return { ...input, to: draft.to };
        case 'slack':
        case 'discord':
            return { ...input, url: secret(draft.url) };
        case 'telegram':
            return { ...input, botToken: secret(draft.botToken), chatId: draft.chatId };
        case 'pagerduty':
            return { ...input, routingKey: secret(draft.routingKey) };
        case 'webhook':
            return {
                ...input,
                url: secret(draft.url),
                signingSecret: draft.signingSecret.trim() || undefined,
                ...(draft.rotateSigningSecret ? { rotateSigningSecret: true } : {}),
            };
    }
}

function ChannelForm({
    types,
    sources,
    editing,
    onDone,
}: {
    types: ChannelTypeInfo[];
    sources: string[];
    editing: ChannelView | null;
    onDone: (revealedSecret: string | null) => void;
}) {
    const [draft, setDraft] = useState<Draft>(() => (editing ? draftOf(editing) : blank()));
    const { create, update } = useAlertActions();
    const saving = create.isPending || update.isPending;
    const error = (create.error ?? update.error)?.message ?? null;
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
        setDraft((current) => ({ ...current, [key]: value }));
    const batches = types.find((info) => info.type === draft.type)?.batches ?? true;
    const keep = editing ? `Leave blank to keep ${editing.hint ?? 'the stored value'}` : undefined;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const input = inputOf(draft, !!editing);
        const saved = editing
            ? await update.mutateAsync({ id: editing.id, ...input }).catch(() => null)
            : await create.mutateAsync(input).catch(() => null);
        if (saved) onDone(saved.data.signingSecret ?? null);
    };

    const addSource = (source: string) => {
        const list = draft.sources
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
        if (!list.includes(source)) set('sources', [...list, source].join(', '));
    };

    return (
        <form onSubmit={submit} className="space-y-4 rounded-lg bg-muted/40 p-4 ring-1 ring-border">
            <div className="grid gap-4 md:grid-cols-2">
                <div className={fieldClass}>
                    <Label htmlFor="alert-channel-type">Type</Label>
                    <NativeSelect
                        id="alert-channel-type"
                        wrapperClassName="w-full"
                        value={draft.type}
                        disabled={!!editing}
                        onChange={(event) =>
                            setDraft({ ...blank(event.target.value as ChannelType), name: draft.name })
                        }
                    >
                        {types.map((info) => (
                            <NativeSelectOption key={info.type} value={info.type}>
                                {info.label}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                </div>
                <div className={fieldClass}>
                    <Label htmlFor="alert-channel-name">Name</Label>
                    <Input
                        id="alert-channel-name"
                        value={draft.name}
                        placeholder="#ops, On-call, Founders"
                        onChange={(event) => set('name', event.target.value)}
                        required
                    />
                </div>
            </div>
            {hint(TYPE_HELP[draft.type])}

            <div className="grid gap-4 md:grid-cols-2">
                {draft.type === 'email' ? (
                    <div className={`${fieldClass} md:col-span-2`}>
                        <Label htmlFor="alert-channel-to">Recipients</Label>
                        <Input
                            id="alert-channel-to"
                            value={draft.to}
                            placeholder="ops@example.com, cto@example.com"
                            onChange={(event) => set('to', event.target.value)}
                        />
                    </div>
                ) : null}
                {draft.type === 'slack' || draft.type === 'discord' || draft.type === 'webhook' ? (
                    <div className={`${fieldClass} md:col-span-2`}>
                        <Label htmlFor="alert-channel-url">{draft.type === 'webhook' ? 'URL' : 'Webhook URL'}</Label>
                        <Input
                            id="alert-channel-url"
                            type="url"
                            autoComplete="off"
                            value={draft.url}
                            placeholder={
                                keep ??
                                (draft.type === 'slack'
                                    ? 'https://hooks.slack.com/services/…'
                                    : draft.type === 'discord'
                                      ? 'https://discord.com/api/webhooks/…'
                                      : 'https://example.com/alerts')
                            }
                            onChange={(event) => set('url', event.target.value)}
                        />
                    </div>
                ) : null}
                {draft.type === 'telegram' ? (
                    <>
                        <div className={fieldClass}>
                            <Label htmlFor="alert-channel-token">Bot token</Label>
                            <Input
                                id="alert-channel-token"
                                autoComplete="off"
                                value={draft.botToken}
                                placeholder={keep ?? '123456789:AA…'}
                                onChange={(event) => set('botToken', event.target.value)}
                            />
                        </div>
                        <div className={fieldClass}>
                            <Label htmlFor="alert-channel-chat">Chat id</Label>
                            <Input
                                id="alert-channel-chat"
                                value={draft.chatId}
                                placeholder="-1001234567890 or @channel"
                                onChange={(event) => set('chatId', event.target.value)}
                            />
                        </div>
                    </>
                ) : null}
                {draft.type === 'pagerduty' ? (
                    <div className={`${fieldClass} md:col-span-2`}>
                        <Label htmlFor="alert-channel-key">Integration key</Label>
                        <Input
                            id="alert-channel-key"
                            autoComplete="off"
                            value={draft.routingKey}
                            placeholder={keep ?? 'Events API v2 integration key'}
                            onChange={(event) => set('routingKey', event.target.value)}
                        />
                    </div>
                ) : null}
                {draft.type === 'webhook' ? (
                    <div className={`${fieldClass} md:col-span-2`}>
                        <Label htmlFor="alert-channel-signing">Signing secret</Label>
                        <Input
                            id="alert-channel-signing"
                            autoComplete="off"
                            value={draft.signingSecret}
                            placeholder={
                                editing ? 'Leave blank to keep the current one' : 'Leave blank to generate one'
                            }
                            onChange={(event) => set('signingSecret', event.target.value)}
                        />
                        {editing ? (
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={draft.rotateSigningSecret}
                                    onChange={(event) => set('rotateSigningSecret', event.target.checked)}
                                />
                                Generate a new signing secret
                            </label>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className={fieldClass}>
                    <Label htmlFor="alert-channel-severity">Takes</Label>
                    <NativeSelect
                        id="alert-channel-severity"
                        wrapperClassName="w-full"
                        value={draft.minSeverity}
                        onChange={(event) => set('minSeverity', event.target.value as Severity)}
                    >
                        <NativeSelectOption value="info">Everything</NativeSelectOption>
                        <NativeSelectOption value="warning">Warning and critical</NativeSelectOption>
                        <NativeSelectOption value="critical">Critical only</NativeSelectOption>
                    </NativeSelect>
                </div>
                <div className={fieldClass}>
                    <Label htmlFor="alert-channel-mode">When</Label>
                    <NativeSelect
                        id="alert-channel-mode"
                        wrapperClassName="w-full"
                        value={batches ? draft.mode : 'immediate'}
                        disabled={!batches}
                        onChange={(event) => set('mode', event.target.value as ChannelMode)}
                    >
                        <NativeSelectOption value="immediate">At once</NativeSelectOption>
                        <NativeSelectOption value="digest">Daily digest</NativeSelectOption>
                    </NativeSelect>
                </div>
                {draft.mode === 'digest' && batches ? (
                    <div className={fieldClass}>
                        <Label htmlFor="alert-channel-hour">Digest hour (UTC)</Label>
                        <Input
                            id="alert-channel-hour"
                            type="number"
                            min={0}
                            max={23}
                            value={draft.digestHour}
                            onChange={(event) => set('digestHour', event.target.value)}
                        />
                    </div>
                ) : batches ? (
                    <div className={fieldClass}>
                        <Label htmlFor="alert-channel-cap">At most per hour</Label>
                        <Input
                            id="alert-channel-cap"
                            type="number"
                            min={1}
                            max={1000}
                            value={draft.maxPerHour}
                            onChange={(event) => set('maxPerHour', event.target.value)}
                        />
                    </div>
                ) : null}
            </div>
            {batches
                ? hint('Critical alerts always go at once. Over the hourly limit, the rest wait and go as one summary.')
                : null}

            <div className={fieldClass}>
                <Label htmlFor="alert-channel-sources">Only from</Label>
                <Input
                    id="alert-channel-sources"
                    value={draft.sources}
                    placeholder="Every source. Or: blackbox, tower:app.down, payport"
                    onChange={(event) => set('sources', event.target.value)}
                />
                {sources.length ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs text-muted-foreground">Seen lately:</span>
                        {sources.map((source) => (
                            <button
                                key={source}
                                type="button"
                                onClick={() => addSource(source)}
                                aria-label={`Add ${source}`}
                            >
                                <Tag mono>{source}</Tag>
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                    {editing ? 'Save' : 'Add channel'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => onDone(null)}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

// ── Channels ─────────────────────────────────────────────────

function ChannelRow({ channel, onEdit }: { channel: ChannelView; onEdit: () => void }) {
    const { update, remove, test } = useAlertActions();
    const [confirming, setConfirming] = useState(false);
    const [tested, setTested] = useState<{ ok: boolean; text: string } | null>(null);
    const Icon = TYPE_ICON[channel.type];
    const health = channelHealth(channel);

    const runTest = async () => {
        setTested(null);
        const result = await test.mutateAsync({ id: channel.id }).catch((error: Error) => {
            setTested({ ok: false, text: error.message });
            return null;
        });
        if (result)
            setTested(
                result.data.ok
                    ? { ok: true, text: 'Sent. Check the channel.' }
                    : { ok: false, text: result.data.error ?? 'Not sent' },
            );
    };

    return (
        <div className="space-y-2 rounded-lg bg-background p-3 text-sm ring-1 ring-border">
            <div className="flex flex-wrap items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{channel.name}</span>
                        <LiveDot tone={health.tone} title={health.label} />
                        <Tag>
                            {channel.minSeverity === 'info'
                                ? 'everything'
                                : channel.minSeverity === 'warning'
                                  ? 'warning +'
                                  : 'critical only'}
                        </Tag>
                        {channel.mode === 'digest' ? (
                            <Tag>{`digest ${String(channel.digestHour).padStart(2, '0')}:00 UTC`}</Tag>
                        ) : null}
                        {channel.sources?.map((source) => (
                            <Tag key={source} mono>
                                {source}
                            </Tag>
                        ))}
                        {channel.fromEnv ? <Tag mono>ALERTS_EMAIL_TO</Tag> : null}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{channel.hint ?? ''}</div>
                    <div className={`text-xs ${health.tone === 'red' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {health.label}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={runTest} disabled={test.isPending || !channel.enabled}>
                        <Zap className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Test
                    </Button>
                    {channel.fromEnv ? null : (
                        <>
                            <Switch
                                checked={channel.enabled}
                                aria-label={channel.enabled ? `Turn ${channel.name} off` : `Turn ${channel.name} on`}
                                disabled={update.isPending}
                                onCheckedChange={(enabled: boolean) => update.mutate({ id: channel.id, enabled })}
                            />
                            <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${channel.name}`}>
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            {confirming ? (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={remove.isPending}
                                    onClick={() =>
                                        remove.mutate({ id: channel.id }, { onSettled: () => setConfirming(false) })
                                    }
                                >
                                    Remove
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setConfirming(true)}
                                    aria-label={`Remove ${channel.name}`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
            {tested ? (
                <p className={`text-xs ${tested.ok ? 'text-muted-foreground' : 'text-destructive'}`}>{tested.text}</p>
            ) : null}
        </div>
    );
}

function Channels({ sources }: { sources: string[] }) {
    const { data, isLoading, error } = useAlertChannels();
    const [editing, setEditing] = useState<ChannelView | 'new' | null>(null);
    const [revealed, setRevealed] = useState<string | null>(null);
    const channels = data?.channels ?? [];
    const done = (secret: string | null) => {
        setEditing(null);
        setRevealed(secret);
    };

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">Channels</h2>
                    <p className="text-sm text-muted-foreground">
                        Where alerts go. Each takes a severity and, if you like, only some sources.
                    </p>
                </div>
                {editing === null ? (
                    <Button size="sm" onClick={() => setEditing('new')}>
                        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                        Add channel
                    </Button>
                ) : null}
            </div>

            {revealed ? (
                <div className="space-y-1 rounded-lg p-3 text-sm ring-1 ring-border">
                    <div className="flex items-center gap-2 font-medium">
                        <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        Signing secret: copy it now, it is not shown again
                    </div>
                    <code className="block break-all rounded-md bg-muted p-2 font-mono text-xs">{revealed}</code>
                    {hint(
                        'Your receiver verifies X-Ottabase-Signature with it (verifySignatureHeader from @ottabase/utils/hmac-signature).',
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
                        Done
                    </Button>
                </div>
            ) : null}

            {editing === 'new' ? (
                <ChannelForm types={data?.types ?? []} sources={sources} editing={null} onDone={done} />
            ) : null}
            {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
            {!isLoading && channels.length === 0 && editing === null ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No channels yet: alerts are only written to the log. Add Slack, email or any of the others, or set
                    ALERTS_EMAIL_TO.
                </div>
            ) : null}
            <div className="space-y-2">
                {channels.map((channel) =>
                    editing !== null && editing !== 'new' && editing.id === channel.id ? (
                        <ChannelForm
                            key={channel.id}
                            types={data?.types ?? []}
                            sources={sources}
                            editing={channel}
                            onDone={done}
                        />
                    ) : (
                        <ChannelRow key={channel.id} channel={channel} onEdit={() => setEditing(channel)} />
                    ),
                )}
            </div>
        </section>
    );
}

// ── The feed ─────────────────────────────────────────────────

function DeliveryChip({ delivery }: { delivery: DeliveryView }) {
    const { retry } = useAlertActions();
    const retryable = delivery.status === 'failed' || delivery.status === 'dead';
    return (
        <span className="inline-flex items-center gap-1" title={delivery.lastError ?? undefined}>
            <StatusChip tone={DELIVERY_TONE[delivery.status]}>
                {delivery.channelName}: {DELIVERY_WORD[delivery.status]}
                {delivery.attempts > 1 ? ` (${delivery.attempts} tries)` : ''}
            </StatusChip>
            {retryable ? (
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate({ id: delivery.id })}
                    aria-label={`Send to ${delivery.channelName} again`}
                >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                </Button>
            ) : null}
        </span>
    );
}

function AlertRow({ alert }: { alert: AlertView }) {
    const resolved = alert.status === 'resolved';
    return (
        <details className="group rounded-lg bg-background p-3 text-sm ring-1 ring-border">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                <StatusChip tone={resolved ? 'green' : SEVERITY_TONE[alert.severity]}>
                    {resolved ? 'resolved' : alert.severity}
                </StatusChip>
                <span className="min-w-0 flex-1 truncate font-medium">{alert.title}</span>
                <Tag mono>{`${alert.source} · ${alert.kind}`}</Tag>
                {alert.heldBefore > 0 ? <Tag>{`+${alert.heldBefore} held`}</Tag> : null}
                <span
                    className="text-xs tabular-nums text-muted-foreground"
                    title={new Date(alert.raisedAt).toLocaleString()}
                >
                    {ago(alert.raisedAt)}
                </span>
            </summary>
            <div className="mt-3 space-y-3">
                {alert.body ? (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-xs">
                        {alert.body}
                    </pre>
                ) : null}
                {alert.fields.length ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                        {alert.fields.map((field) => (
                            <div key={field.label} className="contents">
                                <dt className="text-muted-foreground">{field.label}</dt>
                                <dd className="break-all font-mono">{field.value}</dd>
                            </div>
                        ))}
                    </dl>
                ) : null}
                {alert.url ? (
                    <a href={alert.url} className="inline-flex items-center gap-1 text-xs underline underline-offset-2">
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        Open
                    </a>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                    {alert.deliveries.length ? (
                        alert.deliveries.map((delivery) => <DeliveryChip key={delivery.id} delivery={delivery} />)
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            No channel took it: it went to the log only.
                        </span>
                    )}
                </div>
            </div>
        </details>
    );
}

function Feed({ sources }: { sources: string[] }) {
    const [source, setSource] = useState('');
    const [severity, setSeverity] = useState<Severity | ''>('');
    // ponytail: "show more" raises the limit (to the route's ceiling of 200) instead of paging by cursor.
    const [limit, setLimit] = useState(50);
    const feed = useAlertFeed({ source: source || undefined, severity: severity || undefined, limit });
    const rows = feed.data ?? [];

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">Alerts</h2>
                    <p className="text-sm text-muted-foreground">
                        Everything raised in the last 30 days, and where it went.
                    </p>
                </div>
                <div className="flex gap-2">
                    <NativeSelect
                        size="sm"
                        aria-label="Source"
                        value={source}
                        onChange={(event) => setSource(event.target.value)}
                    >
                        <NativeSelectOption value="">All sources</NativeSelectOption>
                        {sources.map((name) => (
                            <NativeSelectOption key={name} value={name}>
                                {name}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        size="sm"
                        aria-label="Severity"
                        value={severity}
                        onChange={(event) => setSeverity(event.target.value as Severity | '')}
                    >
                        <NativeSelectOption value="">Any severity</NativeSelectOption>
                        <NativeSelectOption value="critical">Critical</NativeSelectOption>
                        <NativeSelectOption value="warning">Warning</NativeSelectOption>
                        <NativeSelectOption value="info">Info</NativeSelectOption>
                    </NativeSelect>
                </div>
            </div>
            {feed.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            {feed.error ? <p className="text-sm text-destructive">{feed.error.message}</p> : null}
            {!feed.isLoading && rows.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                    Nothing raised yet. Test a channel to see one here.
                </div>
            ) : null}
            <div className="space-y-2">
                {rows.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} />
                ))}
            </div>
            {rows.length >= limit && limit < 200 ? (
                <Button size="sm" variant="ghost" onClick={() => setLimit((current) => Math.min(current + 50, 200))}>
                    Show more
                </Button>
            ) : null}
        </section>
    );
}

// ── The console ──────────────────────────────────────────────

export function AlertsConsole() {
    const summary = useAlertsSummary();
    const sources = summary.data?.sources ?? [];
    const last = summary.data?.last24h;
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Stat
                    label="Critical"
                    value={last?.critical ?? 0}
                    foot="last 24 hours"
                    tone={last?.critical ? 'red' : undefined}
                />
                <Stat
                    label="Warning"
                    value={last?.warning ?? 0}
                    foot="last 24 hours"
                    tone={last?.warning ? 'amber' : undefined}
                />
                <Stat label="Info" value={last?.info ?? 0} foot="last 24 hours" />
                <Stat label="Waiting" value={summary.data?.waiting ?? 0} foot="for a digest or a limit" />
                <Stat
                    label="Failed"
                    value={summary.data?.dead24h ?? 0}
                    foot="gave up, last 24 hours"
                    tone={summary.data?.dead24h ? 'red' : undefined}
                />
            </div>
            <Channels sources={sources} />
            <Feed sources={sources} />
        </div>
    );
}
