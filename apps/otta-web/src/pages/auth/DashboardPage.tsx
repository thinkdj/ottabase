/**
 * Signed-in home: a greeting, an email-verification nudge when needed, and the
 * places a signed-in person actually goes next (filtered by what is enabled and
 * what they may open). Sign-in lands here unless it had somewhere to return to.
 */

import { isAdminUser, useSession } from '@/lib/auth';
import { requestEmailVerification } from '@/lib/auth-api';
import { MEDIA_LIBRARY_ENABLED, PACKAGES_ENABLED } from '@/ottabase/config';
import { Button } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { BookOpen, ChevronRight, FlaskConical, Gift, Images, Shield, UserRound } from 'lucide-react';
import { useState, type ComponentType } from 'react';

interface Destination {
    to: string;
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
}

function getDestinations(isAdmin: boolean): Destination[] {
    return [
        {
            to: '/profile',
            title: 'Your account',
            description: 'Name, photo, timezone and password',
            icon: UserRound,
        },
        ...(MEDIA_LIBRARY_ENABLED
            ? [{ to: '/media-library', title: 'Your uploads', description: 'Files and images you added', icon: Images }]
            : []),
        ...(PACKAGES_ENABLED.referrals
            ? [{ to: '/referrals', title: 'Referrals', description: 'Invite people and see who joined', icon: Gift }]
            : []),
        ...(isAdmin
            ? [{ to: '/admin', title: 'Admin', description: 'Users, content and settings', icon: Shield }]
            : []),
        { to: '/docs', title: 'Docs', description: 'Guides and package reference', icon: BookOpen },
        { to: '/demo', title: 'Demos', description: 'Try every package hands-on', icon: FlaskConical },
    ];
}

function VerifyEmailNudge({ email }: { email: string }) {
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    const send = async () => {
        setStatus('sending');
        const result = await requestEmailVerification(email).catch(() => null);
        setStatus(result?.success ? 'sent' : 'error');
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p role="status">
                {status === 'sent' ? (
                    <>
                        Verification link sent to <strong>{email}</strong>. Open it to finish.
                    </>
                ) : status === 'error' ? (
                    'Could not send the email. Try again in a moment.'
                ) : (
                    <>
                        Please verify <strong>{email}</strong> to unlock everything.
                    </>
                )}
            </p>
            {status !== 'sent' && (
                <Button size="sm" variant="outline" onClick={send} disabled={status === 'sending'} className="shrink-0">
                    {status === 'sending' ? 'Sending…' : 'Send link'}
                </Button>
            )}
        </div>
    );
}

export function DashboardPage() {
    const { user } = useSession();
    if (!user) return null; // the protected route redirects

    const firstName = user.name?.trim().split(/\s+/)[0];
    const destinations = getDestinations(isAdminUser(user));

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                    {firstName ? `Hi, ${firstName}` : 'Welcome'}
                </h1>
                <p className="text-muted-foreground">Where to next?</p>
            </div>

            {!user.emailVerified && user.email && <VerifyEmailNudge email={user.email} />}

            <nav aria-label="Destinations" className="grid gap-3 sm:grid-cols-2">
                {destinations.map(({ to, title, description, icon: Icon }) => (
                    <Link
                        key={to}
                        to={to as never}
                        className="group flex items-center gap-3 rounded-xl bg-muted/40 p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block font-medium">{title}</span>
                            <span className="block truncate text-sm text-muted-foreground">{description}</span>
                        </span>
                        <ChevronRight
                            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                        />
                    </Link>
                ))}
            </nav>
        </div>
    );
}
