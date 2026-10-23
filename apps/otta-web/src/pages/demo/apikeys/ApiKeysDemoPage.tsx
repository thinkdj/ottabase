import { isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
// Types only: the root entry also carries the Worker side.
import type { ApiKeyView, IssuedKey } from '@ottabase/apikeys';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Input,
    Label,
    NativeSelect,
    NativeSelectOption,
    StatusChip,
    Tag,
} from '@ottabase/ui';
import { Link } from '@tanstack/react-router';
import { Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

// Mirrors `allowedScopes` in ottabase/packages/apikeys.ts; the server refuses anything else.
const SCOPES = ['read', 'write', 'events:ingest'];
const DAY = 86_400_000;
const KEYS_QUERY = ['demo', 'apikeys'];

const PROTECT_EXAMPLE = `import { apiKeys } from '../ottabase/packages/apikeys';

router.post('/api/ingest', async (c) => {
    const auth = await apiKeys.authenticate(c.req, c.env, { scopes: ['events:ingest'] });
    if (auth instanceof Response) return auth; // 401 or 403
    // auth.subject = { appId, organizationId, userId }: stamp tenancy from it, never from the body.
    return ingest(auth.subject, await c.req.json());
});`;

const CURL_EXAMPLE = `curl -X POST https://your-app.com/api/ingest \\
  -H "Authorization: Bearer ok_live_…" \\
  -d '{"event":"signup"}'`;

function stateOf(key: ApiKeyView): { tone: 'green' | 'red' | 'smoke'; label: string } {
    if (key.revokedAt) return { tone: 'smoke', label: 'Revoked' };
    if (key.expiresAt && key.expiresAt <= Date.now()) return { tone: 'red', label: 'Expired' };
    return { tone: 'green', label: 'Active' };
}

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : '—');

export function ApiKeysDemoPage() {
    const { isAuthenticated, isInitialized, isLoading } = useSession();
    const signedIn = isInitialized && !isLoading && isAuthenticated;

    const [name, setName] = useState('My integration');
    const [scopes, setScopes] = useState<string[]>(['read']);
    const [expiresInDays, setExpiresInDays] = useState('30');
    const [issued, setIssued] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const keys = useApiQuery<{ data: ApiKeyView[] }>({
        queryKey: KEYS_QUERY,
        endpoint: '/api/keys',
        queryOptions: { enabled: signedIn },
    });

    const create = useApiMutation<{ data: IssuedKey }, { name: string; scopes: string[]; expiresAt: number | null }>({
        endpoint: '/api/keys',
        invalidateKeys: [KEYS_QUERY],
        mutationOptions: {
            onSuccess: (response) => {
                setIssued(response.data.key);
                setCopied(false);
            },
        },
    });

    const revoke = useApiMutation<unknown, string>({
        endpoint: (id) => `/api/keys/${id}`,
        method: 'DELETE',
        invalidateKeys: [KEYS_QUERY],
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const days = Number(expiresInDays);
        create.mutate({ name: name.trim(), scopes, expiresAt: days ? Date.now() + days * DAY : null });
    };

    const copy = async () => {
        if (!issued) return;
        await navigator.clipboard.writeText(issued);
        setCopied(true);
    };

    const toggleScope = (scope: string, on: boolean) =>
        setScopes((prev) => (on ? [...prev, scope] : prev.filter((s) => s !== scope)));

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="API Keys"
                description="@ottabase/apikeys: the keys your customers create to call your API from their own code, CI or widget embed."
            />

            <Card>
                <CardHeader>
                    <CardTitle>What it is</CardTitle>
                    <CardDescription>
                        Not your provider keys (that is OttaAI). These belong to your app's users.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="grid gap-x-8 gap-y-2 text-sm text-subtle-foreground sm:grid-cols-2">
                        <li>Only a SHA-256 hash is stored; the key is shown once, at creation.</li>
                        <li>A recognisable prefix (ok_live_) so secret scanners catch leaks.</li>
                        <li>Scopes from your own vocabulary, plus optional expiry.</li>
                        <li>Revocable any time; last use is recorded (at most once a minute).</li>
                        <li>Personal keys, or organization keys for org managers.</li>
                        <li>A per-key rate limit through the app's own limiter.</li>
                    </ul>
                </CardContent>
            </Card>

            {isInitialized && !isLoading && !isAuthenticated ? (
                <Card className="border-dashed">
                    <CardContent className="flex items-center gap-3 p-4 text-sm text-subtle-foreground">
                        <KeyRound className="size-4 shrink-0" />
                        <p>
                            <Link to="/login" className="font-medium text-primary">
                                Sign in
                            </Link>{' '}
                            to create and revoke your own keys here. Keys belong to the signed-in user.
                        </p>
                    </CardContent>
                </Card>
            ) : null}

            {signedIn ? (
                <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create a key</CardTitle>
                            <CardDescription>POST /api/keys</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="key-name">Name</Label>
                                    <Input
                                        id="key-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <fieldset className="space-y-2">
                                    <legend className="text-sm font-medium">Scopes</legend>
                                    {SCOPES.map((scope) => (
                                        <div key={scope} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`scope-${scope}`}
                                                checked={scopes.includes(scope)}
                                                onCheckedChange={(on) => toggleScope(scope, on === true)}
                                            />
                                            <Label htmlFor={`scope-${scope}`} className="font-mono text-xs font-normal">
                                                {scope}
                                            </Label>
                                        </div>
                                    ))}
                                </fieldset>
                                <div className="space-y-1.5">
                                    <Label htmlFor="key-expiry">Expires</Label>
                                    <NativeSelect
                                        id="key-expiry"
                                        value={expiresInDays}
                                        onChange={(e) => setExpiresInDays(e.target.value)}
                                    >
                                        <NativeSelectOption value="1">In 1 day</NativeSelectOption>
                                        <NativeSelectOption value="30">In 30 days</NativeSelectOption>
                                        <NativeSelectOption value="0">Never</NativeSelectOption>
                                    </NativeSelect>
                                </div>
                                <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
                                    Create key
                                </Button>
                                {create.error ? (
                                    <p className="text-sm text-destructive">
                                        {isApiError(create.error) ? create.error.message : 'Could not create the key.'}
                                    </p>
                                ) : null}
                            </form>
                        </CardContent>
                    </Card>

                    <div className="min-w-0 space-y-6">
                        {issued ? (
                            <Card className="border-warning/40">
                                <CardHeader>
                                    <CardTitle>Copy your key now</CardTitle>
                                    <CardDescription>
                                        This is the only time it is shown. Only its hash is stored.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex items-center gap-2">
                                    <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">
                                        {issued}
                                    </code>
                                    <Button variant="outline" size="sm" onClick={copy}>
                                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                                        {copied ? 'Copied' : 'Copy'}
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : null}

                        <Card>
                            <CardHeader>
                                <CardTitle>Your keys</CardTitle>
                                <CardDescription>GET /api/keys · DELETE /api/keys/:id</CardDescription>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                {keys.isLoading ? (
                                    <p className="text-sm text-muted-foreground">Loading…</p>
                                ) : keys.error ? (
                                    <p className="text-sm text-destructive">
                                        {isApiError(keys.error) ? keys.error.message : 'Could not load keys.'}
                                    </p>
                                ) : !keys.data?.data.length ? (
                                    <p className="text-sm text-muted-foreground">No keys yet.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="text-left text-xs text-muted-foreground">
                                            <tr>
                                                <th className="py-2 pr-3 font-semibold">Name</th>
                                                <th className="py-2 pr-3 font-semibold">Key</th>
                                                <th className="py-2 pr-3 font-semibold">Scopes</th>
                                                <th className="py-2 pr-3 font-semibold">Last used</th>
                                                <th className="py-2 pr-3 font-semibold">Expires</th>
                                                <th className="py-2 pr-3 font-semibold">State</th>
                                                <th className="py-2" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {keys.data.data.map((key) => {
                                                const state = stateOf(key);
                                                return (
                                                    <tr key={key.id} className="border-t border-border align-middle">
                                                        <td className="py-2 pr-3 font-medium">{key.name}</td>
                                                        <td className="py-2 pr-3">
                                                            <Tag mono>{key.prefix}…</Tag>
                                                        </td>
                                                        <td className="py-2 pr-3 font-mono text-xs">
                                                            {key.scopes.join(', ') || '—'}
                                                        </td>
                                                        <td className="py-2 pr-3 text-xs">{when(key.lastUsedAt)}</td>
                                                        <td className="py-2 pr-3 text-xs">{when(key.expiresAt)}</td>
                                                        <td className="py-2 pr-3">
                                                            <StatusChip tone={state.tone}>{state.label}</StatusChip>
                                                        </td>
                                                        <td className="py-2 text-right">
                                                            {!key.revokedAt ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    disabled={revoke.isPending}
                                                                    onClick={() => revoke.mutate(key.id)}
                                                                >
                                                                    Revoke
                                                                </Button>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>Protect a route</CardTitle>
                    <CardDescription>
                        Keys are read from Authorization: Bearer or X-Api-Key. Missing, revoked or expired keys get a
                        401; a missing scope gets a 403.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                        <code>{PROTECT_EXAMPLE}</code>
                    </pre>
                    <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                        <code>{CURL_EXAMPLE}</code>
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
}
