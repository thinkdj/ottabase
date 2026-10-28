/**
 * Webhooks (admin): signed outbound event delivery, per tenant.
 *
 * `<WebhooksSettings />` reads and writes through the app's API client, so the endpoints
 * listed are the ones of the organization the request is scoped to.
 */

import { WebhooksSettings } from '@ottabase/webhooks/react';
import { Webhook } from 'lucide-react';

export function WebhooksPage() {
    return (
        <div className="max-w-3xl space-y-8">
            <div className="space-y-1.5">
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.015em]">
                    <Webhook className="h-6 w-6 text-muted-foreground" />
                    Webhooks
                </h1>
                <p className="max-w-3xl text-muted-foreground">
                    Send signed events to your own systems. Every delivery carries an HMAC signature over its timestamp
                    and body — verify it before you trust the payload.
                </p>
            </div>

            <WebhooksSettings />
        </div>
    );
}
