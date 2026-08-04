/**
 * Webhooks (admin) — the paid-package example, end to end.
 *
 * Two things worth noticing about how this page is built:
 *
 *  1. The route is ALWAYS registered. A paid page that vanishes from the router when the
 *     license lapses gives a bookmarked link a 404 and no explanation; this one renders
 *     the upsell instead and tells the operator exactly which key is missing.
 *
 *  2. There is no license check written here. `<WebhooksSettings />` gates its own paid
 *     surface from the same server-resolved entitlements the API enforces, so the button
 *     state and the 402 can never disagree.
 */

import { premiumRequest } from '@/lib/premium';
import { PremiumProvider } from '@ottabase/premium/react';
import { WebhooksSettings } from '@ottabase/premium-webhooks/react';
import { Webhook } from 'lucide-react';

export function WebhooksPage() {
    return (
        <PremiumProvider basePath="/api/premium" request={premiumRequest}>
            <div className="max-w-3xl space-y-8">
                <div className="space-y-1.5">
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                        <Webhook className="h-6 w-6 text-muted-foreground" />
                        Webhooks
                    </h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Send signed events to your own systems. Every delivery carries an HMAC signature over its
                        timestamp and body — verify it before you trust the payload.
                    </p>
                </div>

                <WebhooksSettings />
            </div>
        </PremiumProvider>
    );
}
