import { api, isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { Building2, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface InvitePreview {
    status: string;
    organizationName: string | null;
    organizationId?: string;
    emailMasked: string;
    expiresAt: number;
    role: string;
}

export function OrgInvitePage() {
    const { token = '' } = useParams({ strict: false }) as { token?: string };
    const decoded = token ? decodeURIComponent(token) : '';
    const { user, isAuthenticated, isLoading: sessionLoading } = useSession({ skipAutoSync: true });
    const [actionError, setActionError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState<'accept' | 'decline' | null>(null);

    const { data, isLoading, error, refetch } = useApiQuery<{ data: InvitePreview }, InvitePreview>({
        queryKey: ['public-org-invite', decoded],
        endpoint: decoded
            ? `/api/public/org-invites/${encodeURIComponent(decoded)}`
            : '/api/public/org-invites/invalid',
        transform: (r) => r.data,
        queryOptions: { enabled: !!decoded },
    });

    const pending = data?.status === 'pending';
    const expired = data?.status === 'expired';

    const runDecline = async () => {
        setActionError(null);
        setSubmitting('decline');
        try {
            await api(`/api/public/org-invites/${encodeURIComponent(decoded)}/decline`, {
                method: 'POST',
                body: {},
            });
            await refetch();
        } catch (e) {
            setActionError(isApiError(e) ? e.message : 'Could not decline');
        } finally {
            setSubmitting(null);
        }
    };

    const runAccept = async () => {
        setActionError(null);
        setSubmitting('accept');
        try {
            await api(`/api/public/org-invites/${encodeURIComponent(decoded)}/accept`, {
                method: 'POST',
                body: {},
            });
            await refetch();
        } catch (e) {
            setActionError(isApiError(e) ? e.message : 'Could not accept');
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col gap-6 p-6">
            <Card className="border-border bg-card dark:bg-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Building2 className="h-6 w-6" />
                        Organization invitation
                    </CardTitle>
                    <CardDescription>
                        {isLoading ? 'Loadingâ€¦' : data?.organizationName || 'Invitation details'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!decoded && <p className="text-sm text-muted-foreground">Invalid invitation link.</p>}

                    {error && (
                        <p className="text-sm text-destructive">
                            {error instanceof Error ? error.message : 'Could not load invitation'}
                        </p>
                    )}

                    {data && (
                        <div className="space-y-2 text-sm">
                            <p>
                                <span className="text-muted-foreground">Organization: </span>
                                <strong>{data.organizationName || 'â€”'}</strong>
                            </p>
                            <p>
                                <span className="text-muted-foreground">Invited email: </span>
                                {data.emailMasked}
                            </p>
                            <p>
                                <span className="text-muted-foreground">Role: </span>
                                <span className="capitalize">{data.role}</span>
                            </p>
                            {pending && (
                                <p className="text-muted-foreground">
                                    Expires: {new Date(data.expiresAt).toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}

                    {data?.status === 'accepted' && (
                        <p className="text-sm text-green-600 dark:text-green-400">You have accepted this invitation.</p>
                    )}
                    {data?.status === 'declined' && (
                        <p className="text-sm text-muted-foreground">This invitation was declined.</p>
                    )}
                    {expired && <p className="text-sm text-destructive">This invitation has expired.</p>}

                    {actionError && <p className="text-sm text-destructive">{actionError}</p>}

                    {pending && !expired && (
                        <div className="flex flex-col gap-3 pt-2">
                            {sessionLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Checking sessionâ€¦
                                </div>
                            ) : !isAuthenticated ? (
                                <p className="text-sm text-muted-foreground">
                                    <Link to="/login" className="font-medium text-primary underline">
                                        Sign in
                                    </Link>{' '}
                                    with the email this invite was sent to, then return here to accept.
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Signed in as {user?.email ?? 'your account'}. Accept only if this matches the
                                    invited email.
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={() => void runAccept()}
                                    disabled={!isAuthenticated || !!submitting}
                                    className="gap-2"
                                >
                                    {submitting === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Accept
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => void runDecline()}
                                    disabled={!!submitting}
                                    className="gap-2"
                                >
                                    {submitting === 'decline' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Decline
                                </Button>
                            </div>
                        </div>
                    )}

                    <Button variant="ghost" asChild className="w-fit">
                        <Link to="/">Home</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
