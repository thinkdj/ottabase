import { isApiError } from '@ottabase/api';
import { getProviderDisplayName } from '@ottabase/auth/config';
import { useApiClient, useApiQuery } from '@ottabase/ottaorm/client';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, toast } from '@ottabase/ui-shadcn';
import { useState } from 'react';

export interface LinkedAccountRecord {
    provider: string;
    type: string;
    createdAt: number | null;
}

interface AuthConfig {
    socialProviders?: { id: string; name: string }[];
}

interface SignInMethodsProps {
    linkedAccounts: LinkedAccountRecord[];
    hasPassword: boolean;
    loading: boolean;
    onChanged: (accounts: LinkedAccountRecord[]) => void;
}

/** The ways into this account: password, connected providers, and the providers left to connect. */
export function SignInMethods({ linkedAccounts, hasPassword, loading, onChanged }: SignInMethodsProps) {
    const api = useApiClient();
    const [busy, setBusy] = useState<string | null>(null);
    const config = useApiQuery<AuthConfig>({
        entity: 'auth-config',
        queryKey: ['login'],
        endpoint: '/api/auth/config',
        queryOptions: { meta: { errorPresentation: 'silent' }, staleTime: 300_000 },
    });
    const linked = new Set(linkedAccounts.map((account) => account.provider));
    const available = (config.data?.socialProviders ?? []).filter((provider) => !linked.has(provider.id));
    // One way in must remain: a password, or another connected account
    const canDisconnect = hasPassword || linkedAccounts.length > 1;

    const connect = (provider: string) => {
        window.location.assign(`/api/auth/signin/${provider}?link=1&callbackUrl=/profile`);
    };

    const disconnect = async (provider: string) => {
        setBusy(provider);
        try {
            const result = await api<{ linkedAccounts: LinkedAccountRecord[] }>(`/api/users/me/accounts/${provider}`, {
                method: 'DELETE',
            });
            onChanged(result.linkedAccounts);
            toast.success(`${getProviderDisplayName(provider)} disconnected`);
        } catch (err) {
            toast.error(isApiError(err) ? err.message : 'Could not disconnect that account');
        } finally {
            setBusy(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Sign-in methods</CardTitle>
                <CardDescription>
                    {hasPassword ? 'Your password, plus any connected accounts.' : 'The accounts you can sign in with.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading</p>
                ) : (
                    <ul className="divide-y divide-border/60">
                        {hasPassword && (
                            <li className="flex items-center justify-between gap-3 py-2 text-sm">
                                <span className="font-medium">Email and password</span>
                                <span className="text-xs text-muted-foreground">Always available</span>
                            </li>
                        )}
                        {linkedAccounts.map((account) => (
                            <li key={account.provider} className="flex items-center justify-between gap-3 py-2 text-sm">
                                <span>
                                    <span className="font-medium">{getProviderDisplayName(account.provider)}</span>
                                    {account.createdAt && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            since{' '}
                                            {new Date(account.createdAt).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    )}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!canDisconnect || busy === account.provider}
                                    title={
                                        canDisconnect ? undefined : 'Set a password first so you keep a way to sign in'
                                    }
                                    onClick={() => void disconnect(account.provider)}
                                >
                                    Disconnect
                                </Button>
                            </li>
                        ))}
                        {!hasPassword && linkedAccounts.length === 0 && (
                            <li className="py-2 text-sm text-muted-foreground">
                                You sign in with a link sent to your email.
                            </li>
                        )}
                    </ul>
                )}
                {available.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {available.map((provider) => (
                            <Button key={provider.id} variant="outline" size="sm" onClick={() => connect(provider.id)}>
                                Connect {provider.name}
                            </Button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
