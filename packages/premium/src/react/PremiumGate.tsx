'use client';

// ============================================================
// @ottabase/premium/react — the UI gate
// ============================================================
// Wrap any paid surface. Closed gates render an upsell instead of the children, and
// never render a half-working version of the feature — a disabled button that 402s on
// click is a worse experience than an honest "this needs a license".
// ============================================================

import { Button } from '@ottabase/ui-shadcn';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePremiumEnabled, usePremiumFeature } from './hooks';
import type { PremiumGateAnswer } from '../types';

export interface PremiumGateProps {
    /** Which paid package this surface belongs to. */
    packageKey: string;
    /** Optional feature id. Omit to gate on the package's license alone. */
    feature?: string;
    children: ReactNode;
    /**
     * What to render when the gate is closed. Defaults to the built-in upsell card.
     * Pass `null` to render nothing (right for a nav item; wrong for a whole page).
     */
    fallback?: ReactNode | ((answer: PremiumGateAnswer) => ReactNode);
    /** Skeleton while entitlements load. Defaults to a quiet pulse. */
    loading?: ReactNode;
    /** Heading for the default upsell card. */
    title?: string;
    /** Body copy for the default upsell card. */
    description?: string;
}

const REASON_COPY: Partial<Record<PremiumGateAnswer['reason'], string>> = {
    LICENSE_MISSING: 'No license key is installed for this package yet.',
    LICENSE_EXPIRED: 'The license for this package has expired.',
    LICENSE_SIGNATURE_INVALID: 'The installed license key is not valid for this package.',
    LICENSE_APP_MISMATCH: 'The installed license key was issued for a different application.',
    LICENSE_MALFORMED: 'The installed license key could not be read.',
    FEATURE_NOT_IN_PLAN: 'This feature is not included in the current plan.',
    LIMIT_REACHED: 'You have reached the limit included in the current plan.',
    PACKAGE_DISABLED: 'This package is switched off for this deployment.',
    PACKAGE_UNKNOWN: 'This package is not installed.',
};

/** The default closed-gate surface. Exported so a host can reuse it in a custom fallback. */
export function PremiumUpsell({
    answer,
    title = 'Premium feature',
    description,
}: {
    answer: PremiumGateAnswer;
    title?: string;
    description?: string;
}) {
    return (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-6 dark:bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Lock className="h-4 w-4 text-muted-foreground" />
                {title}
            </div>
            <p className="text-sm text-muted-foreground">
                {description ?? REASON_COPY[answer.reason] ?? 'This feature requires an active license.'}
            </p>
            {answer.purchaseUrl ? (
                <Button asChild size="sm" variant="default">
                    <a href={answer.purchaseUrl} target="_blank" rel="noreferrer noopener">
                        View plans
                    </a>
                </Button>
            ) : null}
        </div>
    );
}

export function PremiumGate({
    packageKey,
    feature,
    children,
    fallback,
    loading,
    title,
    description,
}: PremiumGateProps) {
    // Both hooks run unconditionally — `feature` picks which ANSWER is used, never which
    // hook is called, so the hook order stays stable across renders.
    const packageAnswer = usePremiumEnabled(packageKey);
    const featureAnswer = usePremiumFeature(packageKey, feature ?? '');
    const answer = feature ? featureAnswer : packageAnswer;

    if (answer.isLoading) {
        return <>{loading ?? <div className="h-24 animate-pulse rounded-xl bg-muted/60" aria-busy="true" />}</>;
    }

    if (answer.allowed) {
        return <>{children}</>;
    }

    if (fallback !== undefined) {
        return <>{typeof fallback === 'function' ? fallback(answer) : fallback}</>;
    }

    return <PremiumUpsell answer={answer} title={title} description={description} />;
}

/** Small inline marker for nav entries and list rows. Renders nothing when active. */
export function PremiumBadge({ packageKey }: { packageKey: string }) {
    const answer = usePremiumEnabled(packageKey);
    if (answer.isLoading || answer.allowed) return null;
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
            <Lock className="h-3 w-3" />
            Premium
        </span>
    );
}
