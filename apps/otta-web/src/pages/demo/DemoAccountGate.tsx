import { RouteLoadingFallback } from '@/components/RouteLoadingFallback';
import { useSession } from '@/lib/auth';
import { signInWithProvider } from '@/lib/auth-api';
import { rememberReturnPath } from '@/lib/auth-redirect';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button } from '@ottabase/ui';
import { Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DEMO_SCREENSHOT_BASE, type DemoAccountGate as DemoAccountGateConfig } from './demoAccountGates';

interface AuthConfig {
    socialProviders: { id: string; name: string }[];
}

/**
 * Renders a demo that needs an account: the page itself when signed in, otherwise a teaser with
 * one-click social sign-in (when configured), sign-up and sign-in, each returning here afterwards.
 * A UX affordance only: the worker routes behind these demos require a session on their own.
 */
export function DemoAccountGate({ gate, children }: { gate: DemoAccountGateConfig; children: ReactNode }) {
    const { isAuthenticated, isInitialized } = useSession();
    if (!isInitialized) return <RouteLoadingFallback />;
    if (isAuthenticated) return <>{children}</>;
    return <DemoAccountTeaser gate={gate} />;
}

function DemoAccountTeaser({ gate }: { gate: DemoAccountGateConfig }) {
    const [pending, setPending] = useState<string | null>(null);
    const { data: authConfig } = useApiQuery<AuthConfig>({
        queryKey: ['auth-config'],
        endpoint: '/api/auth/config',
        queryOptions: { staleTime: Infinity, meta: { errorPresentation: 'silent' } },
    });
    const providers = authConfig?.socialProviders ?? [];

    const continueWith = async (providerId: string) => {
        setPending(providerId);
        const result = await signInWithProvider(providerId, {
            redirectTo: window.location.pathname + window.location.search,
        });
        if (!result.success) setPending(null);
    };

    return (
        <div className="mx-auto max-w-3xl space-y-8 py-6">
            <div className="space-y-3 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
                    <Lock className="h-4 w-4" />
                </span>
                <h1 className="text-2xl font-semibold tracking-tight">{gate.feature} needs a free account</h1>
                <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground">
                    It runs live on {gate.runsOn}, so it sits behind a free sign-up. Your account comes with a workspace
                    of its own, and you land back here once you are in.
                </p>
            </div>

            <div className="mx-auto flex max-w-sm flex-col gap-2">
                {providers.map((provider) => (
                    <Button
                        key={provider.id}
                        variant="outline"
                        disabled={pending !== null}
                        onClick={() => void continueWith(provider.id)}
                    >
                        {pending === provider.id ? 'Redirecting…' : `Continue with ${provider.name}`}
                    </Button>
                ))}
                <Button asChild>
                    <Link to="/register" onClick={() => rememberReturnPath()}>
                        Create a free account
                    </Link>
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                    Already have one?{' '}
                    <Link
                        to="/login"
                        onClick={() => rememberReturnPath()}
                        className="font-medium text-foreground hover:underline"
                    >
                        Sign in
                    </Link>
                </p>
            </div>

            {gate.preview ? (
                <div className="relative overflow-hidden rounded-xl ring-1 ring-border">
                    <img
                        src={`${DEMO_SCREENSHOT_BASE}/${gate.preview}.webp`}
                        alt={`${gate.feature}, as it looks once you are signed in`}
                        loading="lazy"
                        className="block w-full dark:hidden"
                    />
                    <img
                        src={`${DEMO_SCREENSHOT_BASE}/${gate.preview}.dark.webp`}
                        alt={`${gate.feature}, as it looks once you are signed in`}
                        loading="lazy"
                        className="hidden w-full dark:block"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-background to-transparent" />
                </div>
            ) : null}
        </div>
    );
}
