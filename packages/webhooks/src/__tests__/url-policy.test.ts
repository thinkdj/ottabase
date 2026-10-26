// ============================================================
// Destination URL policy: the webhook face of the shared SSRF boundary.
//
// The policy and its full table of refused addresses are tested where they live
// (`@ottabase/utils/outbound-url`). These pin what this package promises its callers: the
// names it exports, the customer-facing wording, and that the trivial attacks still fail.
// ============================================================

import { describe, expect, it } from 'vitest';
import { WebhookUrlError, assertDeliverableUrl } from '../url-policy';

describe('assertDeliverableUrl', () => {
    it('accepts and normalizes a public https URL', () => {
        expect(assertDeliverableUrl('  https://example.com/hooks  ')).toBe('https://example.com/hooks');
    });

    it.each([
        ['plaintext http', 'http://example.com/hooks'],
        ['embedded credentials', 'https://user:pass@example.com/hooks'],
        ['loopback', 'https://127.0.0.1/hooks'],
        ['cloud metadata', 'https://169.254.169.254/latest/meta-data'],
        ['IPv4-mapped IPv6 loopback', 'https://[::ffff:127.0.0.1]/hooks'],
        ['nonsense', 'not a url'],
    ])('refuses %s with a WebhookUrlError', (_label, url) => {
        expect(() => assertDeliverableUrl(url)).toThrow(WebhookUrlError);
    });

    it('explains itself in copy safe to show the customer', () => {
        expect(() => assertDeliverableUrl('http://example.com')).toThrow('Webhook URLs must use https');
        expect(() => assertDeliverableUrl('https://10.0.0.1')).toThrow('Webhook URLs must point at a public host');
    });
});
