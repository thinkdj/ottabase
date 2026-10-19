// ============================================================
// Destination URL policy — the SSRF boundary.
//
// A webhook endpoint is a customer-controlled URL that the SERVER fetches. These pin the
// trivial attacks shut; see url-policy.ts for what this deliberately cannot cover.
// ============================================================

import { describe, expect, it } from 'vitest';
import { WebhookUrlError, assertDeliverableUrl } from '../url-policy';

describe('accepts', () => {
    it.each([
        'https://example.com/hooks',
        'https://api.example.co.uk/v1/hooks?token=abc',
        'https://sub.domain.example.com:8443/hook',
    ])('%s', (url) => {
        expect(assertDeliverableUrl(url)).toContain('https://');
    });

    it('trims surrounding whitespace from a pasted URL', () => {
        expect(assertDeliverableUrl('  https://example.com/hooks  ')).toBe('https://example.com/hooks');
    });
});

describe('refuses', () => {
    it.each([
        ['plaintext http', 'http://example.com/hooks'],
        ['a non-http scheme', 'file:///etc/passwd'],
        ['a data URL', 'data:text/plain,hello'],
        ['embedded credentials', 'https://user:pass@example.com/hooks'],
        ['loopback by name', 'https://localhost/hooks'],
        ['loopback by address', 'https://127.0.0.1/hooks'],
        ['IPv6 loopback', 'https://[::1]/hooks'],
        ['IPv6 unspecified address', 'https://[::]/hooks'],
        ['IPv4-compatible IPv6 loopback', 'https://[::127.0.0.1]/hooks'],
        ['IPv4-mapped IPv6 loopback', 'https://[::ffff:127.0.0.1]/hooks'],
        ['IPv6 unique-local address', 'https://[fd12:3456::1]/hooks'],
        ['IPv6 link-local address', 'https://[fe90::1]/hooks'],
        ['a private class A address', 'https://10.1.2.3/hooks'],
        ['a private class B address', 'https://172.16.0.1/hooks'],
        ['a private class C address', 'https://192.168.1.1/hooks'],
        ['link-local (cloud metadata)', 'https://169.254.169.254/latest/meta-data'],
        ['carrier-grade NAT', 'https://100.64.0.1/hooks'],
        ['a .internal suffix', 'https://vault.internal/hooks'],
        ['a .local suffix', 'https://printer.local/hooks'],
        ['a relative path', '/hooks'],
        ['nonsense', 'not a url'],
    ])('%s', (_label, url) => {
        expect(() => assertDeliverableUrl(url)).toThrow(WebhookUrlError);
    });

    it('explains itself in copy safe to show the customer', () => {
        expect(() => assertDeliverableUrl('http://example.com')).toThrow(/https/);
        expect(() => assertDeliverableUrl('https://10.0.0.1')).toThrow(/public host/);
    });
});
