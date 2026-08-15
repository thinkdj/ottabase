'use client';

// ============================================================
// @ottabase/ottaai/react — the drop-in settings surface
// ============================================================
// Built on the house primitives: quiet `bg-muted/40` cards, semantic tokens only
// (no `dark:` variants needed — every colour utility is `hsl(var(--x))`), motion
// via `duration-normal ease-theme`, and `ConfirmDialog` from
// `@ottabase/ui-components` for the destructive path.
//
// WHAT THIS DOES NOT SHIP, on purpose: education/spotlight, illustrations,
// benefit copy, feature marketing. Those are app product surface. It DOES ship
// the gate-class data the marketing copy keys off, so the blocking check and the
// copy read the same declaration.
// ============================================================

import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    NativeSelect,
    Separator,
} from '@ottabase/ui-shadcn';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildCustodyDisclosure } from '../disclosure';
import { verifyFormState } from '../resolver/verify';
import type { CredentialView } from '../types';
import { useAiCredentials, useAiProviders, useAiStatus, type ProviderOption, type SaveCredentialInput } from './hooks';

const MICRO_LABEL = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const QUIET_CARD = 'rounded-xl border-transparent bg-muted/40 shadow-none';
const SECTION_TITLE = 'text-[0.9375rem] font-semibold';

export interface AiProviderSettingsProps {
    /** Show the "organization key" scope option. Only meaningful under an org strategy. */
    allowOrgScope?: boolean;
    /** Copy overrides. */
    title?: string;
    description?: string;
    /** Names the proxy in the custody disclosure; pass `null` for direct-to-provider. */
    proxyName?: string | null;
    className?: string;
}

interface DraftState {
    id: string | null;
    scope: 'user' | 'organization';
    label: string;
    provider: string;
    model: string;
    secret: string;
    /** The provider the row had when the form opened — drives the switch guard. */
    originalProvider: string | null;
}

const EMPTY_DRAFT: DraftState = {
    id: null,
    scope: 'user',
    label: '',
    provider: '',
    model: '',
    secret: '',
    originalProvider: null,
};

export function AiProviderSettings({
    allowOrgScope = false,
    title = 'AI providers',
    description = 'Connect your own provider key. Your key pays for your usage, and unlocks the premium models.',
    proxyName,
    className,
}: AiProviderSettingsProps) {
    const providersQuery = useAiProviders();
    const statusQuery = useAiStatus();
    const credentials = useAiCredentials();

    const [draft, setDraft] = useState<DraftState | null>(null);
    const [pendingDelete, setPendingDelete] = useState<CredentialView | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const providers = providersQuery.data ?? [];
    const providerEntry: ProviderOption | undefined = useMemo(
        () => providers.find((entry) => entry.id === draft?.provider),
        [providers, draft?.provider],
    );

    const custody = useMemo(() => buildCustodyDisclosure({ proxyName }), [proxyName]);

    // A DORMANT DEPLOYMENT still mounts this component: the consuming app gates on a
    // BUILD-TIME client flag, which cannot see whether the server has a keyring. The routes
    // answer 501 NOT_CONFIGURED, and a card whose only button leads to a guaranteed failure
    // is worse than no card. Rendering nothing is also what the toggle's docs promise —
    // "dormant until the secret is set" — so this is the last hop of that contract.
    const dormant = [providersQuery.error, statusQuery.error, credentials.error].some(
        (error) => (error as { status?: number } | null)?.status === 501,
    );
    if (dormant) return null;

    // AND-ed with SERVER TRUTH: under a user-first strategy the management filter keys on
    // userId, so an org-scoped row would vanish from this very list the moment it is
    // saved. The server refuses the write too — this only hides an option that cannot work.
    const orgScopeAvailable = allowOrgScope && statusQuery.data?.orgScopeManageable === true;

    const form = verifyFormState({
        editing: Boolean(draft?.id),
        providerChanged: Boolean(draft?.id) && draft?.provider !== draft?.originalProvider,
        providerRequiresKey: providerEntry?.requiresKey !== false,
        keyTyped: (draft?.secret ?? '').trim().length > 0,
    });

    function openCreate() {
        setFormError(null);
        credentials.test.reset();
        setDraft({ ...EMPTY_DRAFT, provider: providers[0]?.id ?? '' });
    }

    function openEdit(row: CredentialView) {
        setFormError(null);
        credentials.test.reset();
        setDraft({
            id: row.id,
            scope: row.organizationId ? 'organization' : 'user',
            label: row.label ?? '',
            provider: row.provider,
            model: row.model ?? '',
            // NEVER PREFILLED. That is exactly why the Test button has two modes.
            secret: '',
            originalProvider: row.provider,
        });
    }

    async function handleSave() {
        if (!draft) return;
        setFormError(null);

        const payload: SaveCredentialInput = {
            label: draft.label.trim() || null,
            provider: draft.provider,
            model: draft.model.trim() || null,
            // Blank means KEEP — send the field only when the user typed something.
            ...(draft.secret.trim() ? { secret: draft.secret.trim() } : {}),
        };

        try {
            if (draft.id) {
                await credentials.update.mutateAsync({ id: draft.id, data: payload });
            } else {
                await credentials.create.mutateAsync({ ...payload, scope: draft.scope });
            }
            setDraft(null);
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Could not save the provider connection.');
        }
    }

    async function handleTest() {
        if (!draft) return;
        setFormError(null);
        if (form.testMode === 'saved' && draft.id) {
            await credentials.test.mutateAsync({ credentialId: draft.id });
        } else {
            await credentials.test.mutateAsync({
                provider: draft.provider,
                model: draft.model.trim() || null,
                secret: draft.secret.trim(),
            });
        }
    }

    const status = statusQuery.data;
    const rows = credentials.data ?? [];
    const busy = credentials.create.isPending || credentials.update.isPending;

    return (
        <div className={`space-y-6 ${className ?? ''}`}>
            <div className="space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                <p className="max-w-3xl text-muted-foreground">{description}</p>
            </div>

            {/* WHAT IS ACTUALLY IN USE — the only honest answer, and the reason the row
                badge below says "Active" and never "In use". */}
            <Card className={QUIET_CARD}>
                <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${SECTION_TITLE}`}>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        Currently in use
                    </CardTitle>
                    <CardDescription>What the server resolves for you right now.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {statusQuery.isLoading ? (
                        <div aria-busy="true">
                            <span className="sr-only">Loading AI status…</span>
                            <div className="h-5 w-56 animate-pulse rounded-full bg-background/60" />
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge
                                variant="outline"
                                className={`gap-1.5 rounded-full border-transparent bg-background text-[0.6875rem] font-medium uppercase tracking-wide ring-1 ${
                                    status?.source === 'byok'
                                        ? 'text-success ring-success/30'
                                        : status?.source === 'platform'
                                          ? 'text-muted-foreground ring-border'
                                          : 'text-warning ring-warning/30'
                                }`}
                            >
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                        status?.source === 'byok'
                                            ? 'bg-success'
                                            : status?.source === 'platform'
                                              ? 'bg-muted-foreground/40'
                                              : 'bg-warning'
                                    }`}
                                    aria-hidden="true"
                                />
                                {status?.source === 'byok'
                                    ? 'Your key'
                                    : status?.source === 'platform'
                                      ? 'Included model'
                                      : 'Not configured'}
                            </Badge>
                            <span className="text-muted-foreground">
                                {status?.provider ?? '—'}
                                {status?.model ? ` · ${status.model}` : ''}
                            </span>
                        </div>
                    )}
                    {/* THE SECOND REASON IS WHY THIS QUESTION IS ANSWERABLE AT ALL: without
                        `tenantReason`, `auto` flattens every distinct cause into
                        PLATFORM_FALLBACK and "why am I not on my own key?" is unanswerable. */}
                    {status?.source !== 'byok' && status?.tenantReason ? (
                        <p className="text-muted-foreground">{explainTenantReason(status.tenantReason)}</p>
                    ) : null}
                </CardContent>
            </Card>

            {/* Saved connections */}
            <Card className={QUIET_CARD}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1.5">
                        <CardTitle className={`flex items-center gap-2 ${SECTION_TITLE}`}>
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                            Saved connections
                        </CardTitle>
                        <CardDescription>{custody.short}</CardDescription>
                    </div>
                    {!draft ? (
                        <Button size="sm" onClick={openCreate} disabled={providersQuery.isLoading}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Connect a provider
                        </Button>
                    ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                    {credentials.isLoading ? (
                        <div aria-busy="true" className="space-y-2">
                            <span className="sr-only">Loading saved connections…</span>
                            <div className="h-12 animate-pulse rounded-lg bg-background/60" />
                            <div className="h-12 animate-pulse rounded-lg bg-background/60" />
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No provider connected. Add one to run on your own key and model.
                        </p>
                    ) : (
                        rows.map((row) => (
                            <div
                                key={row.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3 ring-1 ring-border transition-colors duration-normal ease-theme"
                            >
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">{row.label || row.provider}</span>
                                        {/* "Active", never "In use" — `isActive` is a
                                            tie-break among siblings at the SAME specificity
                                            rung, not what the resolver obeys. */}
                                        {row.isActive ? (
                                            <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                                Active
                                            </Badge>
                                        ) : null}
                                        {!row.enabled ? (
                                            <Badge
                                                variant="outline"
                                                className="rounded-full border-transparent text-[0.6875rem] text-warning ring-1 ring-warning/30"
                                            >
                                                Paused
                                            </Badge>
                                        ) : null}
                                        {row.scope !== 'user' ? (
                                            <Badge variant="outline" className="rounded-full text-[0.6875rem]">
                                                Organization
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <p className="truncate text-sm text-muted-foreground">
                                        {row.provider}
                                        {row.model ? ` · ${row.model}` : ''}
                                        {row.keyHint ? ` · ${row.keyHint}` : ' · no key'}
                                    </p>
                                    {row.lastErrorCode ? (
                                        <p className="text-sm text-destructive">
                                            Last call failed ({row.lastErrorCode}) · {row.consecutiveFailures} in a row
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {!row.isActive ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => credentials.activate.mutate(row.id)}
                                            disabled={credentials.activate.isPending}
                                        >
                                            Make active
                                        </Button>
                                    ) : null}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            credentials.update.mutate({
                                                id: row.id,
                                                data: { enabled: !row.enabled },
                                            })
                                        }
                                        disabled={credentials.update.isPending}
                                    >
                                        {row.enabled ? 'Pause' : 'Resume'}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                                        Edit
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => setPendingDelete(row)}
                                        aria-label={`Delete ${row.label || row.provider}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Draft form */}
            {draft ? (
                <Card className={QUIET_CARD}>
                    <CardHeader>
                        <CardTitle className={SECTION_TITLE}>
                            {draft.id ? 'Edit connection' : 'Connect a provider'}
                        </CardTitle>
                        <CardDescription>{custody.paragraphs[0]}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {orgScopeAvailable && !draft.id ? (
                            <div className="space-y-2">
                                <Label htmlFor="ottaai-scope">Who can use this key</Label>
                                <NativeSelect
                                    id="ottaai-scope"
                                    value={draft.scope}
                                    onChange={(event) =>
                                        setDraft({ ...draft, scope: event.target.value as 'user' | 'organization' })
                                    }
                                >
                                    <option value="user">Just me</option>
                                    <option value="organization">Everyone in this workspace</option>
                                </NativeSelect>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <Label htmlFor="ottaai-label">Name</Label>
                            <Input
                                id="ottaai-label"
                                value={draft.label}
                                placeholder="My OpenAI key"
                                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ottaai-provider">Provider</Label>
                            <NativeSelect
                                id="ottaai-provider"
                                value={draft.provider}
                                onChange={(event) => setDraft({ ...draft, provider: event.target.value, secret: '' })}
                            >
                                {providers.map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                        {entry.displayName}
                                    </option>
                                ))}
                            </NativeSelect>
                            {providerEntry?.docsUrl ? (
                                <p className="text-sm text-muted-foreground">
                                    <a
                                        className="underline underline-offset-2"
                                        href={providerEntry.docsUrl}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                    >
                                        Where do I get a key?
                                    </a>
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ottaai-model">Model</Label>
                            <Input
                                id="ottaai-model"
                                value={draft.model}
                                placeholder={providerEntry?.models[0]?.id ?? 'Leave blank for the default'}
                                onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                                list={providerEntry?.models.length ? 'ottaai-model-options' : undefined}
                            />
                            {providerEntry?.models.length ? (
                                <datalist id="ottaai-model-options">
                                    {providerEntry.models.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.label}
                                        </option>
                                    ))}
                                </datalist>
                            ) : null}
                        </div>

                        {providerEntry?.requiresKey !== false ? (
                            <div className="space-y-2">
                                <Label htmlFor="ottaai-secret">API key</Label>
                                <Input
                                    id="ottaai-secret"
                                    type="password"
                                    // WITHOUT THIS, browser password managers offer to save the
                                    // provider key and later autofill it — which both corrupts
                                    // "leave blank to keep" and stores the key somewhere new.
                                    autoComplete="off"
                                    value={draft.secret}
                                    placeholder={
                                        draft.id
                                            ? 'Leave blank to keep the existing key'
                                            : (providerEntry?.keyFormatHint ?? 'sk-…')
                                    }
                                    onChange={(event) => setDraft({ ...draft, secret: event.target.value })}
                                />
                                <p className="text-sm text-muted-foreground">
                                    {draft.id
                                        ? 'Leave blank to keep the existing key. Keys are never shown again once saved.'
                                        : 'Stored encrypted. It is never shown again, not even to you.'}
                                </p>
                            </div>
                        ) : null}

                        {credentials.test.data ? (
                            <div
                                className={
                                    credentials.test.data.ok
                                        ? 'rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success'
                                        : 'rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'
                                }
                            >
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                    {credentials.test.data.ok ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4" />
                                    )}
                                    {credentials.test.data.message}
                                </span>
                            </div>
                        ) : null}

                        {formError ? (
                            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                {formError}
                            </div>
                        ) : null}

                        <Separator className="bg-border/60" />

                        <div className="flex flex-wrap items-center gap-2">
                            <Button onClick={handleSave} disabled={busy || !form.canSave || !draft.provider}>
                                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {draft.id ? 'Save changes' : 'Connect'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleTest}
                                disabled={credentials.test.isPending || !form.canTest || !draft.provider}
                            >
                                {credentials.test.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Test key
                            </Button>
                            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
                                Cancel
                            </Button>
                            {form.needsKey ? (
                                <span className={MICRO_LABEL}>An API key is required for this provider</span>
                            ) : null}
                        </div>

                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {custody.paragraphs.slice(1).join(' ')}
                        </p>
                    </CardContent>
                </Card>
            ) : null}

            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title="Delete this provider connection?"
                description={
                    <>
                        The encrypted key for <strong>{pendingDelete?.label || pendingDelete?.provider}</strong> is
                        deleted permanently and cannot be recovered. You will need a new key from your provider to
                        reconnect.
                    </>
                }
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete permanently"
                onConfirm={() => {
                    if (pendingDelete) credentials.remove.mutate(pendingDelete.id);
                    setPendingDelete(null);
                }}
            />
        </div>
    );
}

/** Human copy for the tenant-path reason. Keeps "why am I not on my own key?" answerable. */
function explainTenantReason(reason: string): string {
    switch (reason) {
        case 'NO_CREDENTIAL':
            return 'You have not connected a provider yet.';
        case 'ALL_DISABLED':
            return 'Your saved connection is paused. Resume it to use your own key.';
        case 'CAPABILITY_UNMET':
            return 'Your model cannot do what this feature needs. Pick a different model.';
        case 'PROVIDER_UNREGISTERED':
            return 'That provider is no longer available on this deployment.';
        case 'APP_MISMATCH':
            return 'Your key was connected in a different app and does not apply here.';
        case 'NOT_IN_SCOPE':
            return 'Your key was connected in a different workspace and does not apply here.';
        case 'CREDENTIAL_UNREADABLE':
            return 'Your saved key could not be read. Please re-enter it.';
        case 'SKIPPED_KEYLESS_MISMATCH':
            return 'Your connection has no API key, so it cannot be used with this provider.';
        case 'NO_TENANT_SECRET':
            return 'This feature needs your own API key. Add one to your connection.';
        case 'MERGE_INCOMPLETE':
            return 'Your connection is missing something the provider needs.';
        case 'IMPERSONATED_ACTOR':
            return 'Support sessions never spend your provider key.';
        case 'MODE_PLATFORM_ONLY':
            return 'This feature always runs on the included model.';
        default:
            return 'Running on the included model.';
    }
}
