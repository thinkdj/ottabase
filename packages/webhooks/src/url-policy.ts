// ============================================================
// @ottabase/webhooks — destination URL policy
// ============================================================
// An outbound webhook is a customer-controlled URL that the SERVER fetches. That is the
// textbook SSRF shape, so the destination is validated on write and the fetch never
// follows redirects.
//
// The policy itself lives in `@ottabase/utils/outbound-url`, shared with the webhook
// channels of `@ottabase/alerts`; read that module for what it deliberately cannot cover
// (a hostname that RESOLVES to a private address). This file keeps the webhook wording and
// the names this package has always exported.
// ============================================================

import { OutboundUrlError, assertPublicHttpsUrl } from '@ottabase/utils/outbound-url';

/** Thrown for a destination the server must not fetch. The message is safe to show the customer. */
export { OutboundUrlError as WebhookUrlError };

/** Validate a destination URL, returning the normalized href. Throws {@link WebhookUrlError}. */
export function assertDeliverableUrl(rawUrl: string): string {
    return assertPublicHttpsUrl(rawUrl, 'Webhook URLs');
}
