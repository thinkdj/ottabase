import { isApiError } from '@ottabase/api';
import { describeUserAgent } from '@ottabase/auth/config';
import { useApiClient, useApiQuery } from '@ottabase/ottaorm/client';
import { LoadingState } from '@ottabase/ui-components';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    toast,
} from '@ottabase/ui-shadcn';
import { useState } from 'react';

interface SessionRow {
    id: string;
    createdAt: number;
    userAgent: string | null;
    current: boolean;
}

/** Every browser with an open session, with a way to sign each one out from here. */
export function ActiveSessions() {
    const api = useApiClient();
    const [busy, setBusy] = useState<string | null>(null);
    const sessions = useApiQuery<{ data: SessionRow[] }>({
        entity: 'sessions',
        queryKey: ['mine'],
        endpoint: '/api/users/me/sessions',
        queryOptions: { meta: { errorPresentation: 'local' } },
    });
    const rows = sessions.data?.data ?? [];
    const others = rows.filter((row) => !row.current);

    const signOut = async (key: string, path: string, done: string) => {
        setBusy(key);
        try {
            await api(path, { method: 'DELETE' });
            toast.success(done);
            await sessions.refetch();
        } catch (err) {
            toast.error(isApiError(err) ? err.message : 'Could not sign out that device');
        } finally {
            setBusy(null);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="space-y-1.5">
                    <CardTitle className="text-[0.9375rem] font-semibold">Where you are signed in</CardTitle>
                    <CardDescription>Every browser with an open session.</CardDescription>
                </div>
                {others.length > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === 'all'}
                        onClick={() => void signOut('all', '/api/users/me/sessions', 'Signed out everywhere else')}
                    >
                        Sign out other devices
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {sessions.isLoading ? (
                    <LoadingState kind="text" count={2} label="Loading sessions" />
                ) : sessions.error ? (
                    <Alert variant="destructive">{sessions.error.message}</Alert>
                ) : (
                    <ul className="divide-y divide-border/60">
                        {rows.map((row) => (
                            <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                                <span>
                                    <span className="font-medium">{describeUserAgent(row.userAgent)}</span>
                                    {row.current && (
                                        <Badge variant="secondary" className="ml-2 rounded-full font-normal">
                                            This device
                                        </Badge>
                                    )}
                                    <span className="block text-xs text-muted-foreground">
                                        Signed in{' '}
                                        {new Date(row.createdAt).toLocaleString(undefined, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short',
                                        })}
                                    </span>
                                </span>
                                {!row.current && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy === row.id}
                                        onClick={() =>
                                            void signOut(row.id, `/api/users/me/sessions/${row.id}`, 'Signed out')
                                        }
                                    >
                                        Sign out
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
