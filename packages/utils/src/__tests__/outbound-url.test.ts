// ============================================================
// Outbound URL policy: the SSRF boundary for every URL the server fetches.
//
// A webhook endpoint or an alert channel is a typed-in URL that the SERVER fetches. These pin the
// trivial attacks shut; see outbound-url.ts for what this deliberately cannot cover.
// ============================================================

import { describe, expect, it } from 'vitest';
import { OutboundUrlError, assertPublicHttpsUrl } from '../outbound-url';

describe('accepts', () => {
    it.each([
        'https://example.com/hooks',
        'https://api.example.co.uk/v1/hooks?token=abc',
        'https://sub.domain.example.com:8443/hook',
    ])('%s', (url) => {
        expect(assertPublicHttpsUrl(url)).toContain('https://');
    });

    it('trims surrounding whitespace from a pasted URL', () => {
        expect(assertPublicHttpsUrl('  https://example.com/hooks  ')).toBe('https://example.com/hooks');
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
        ['loopback by name with a trailing dot', 'https://localhost./hooks'],
        ['a .internal suffix with a trailing dot', 'https://metadata.google.internal./computeMetadata'],
        ['a relative path', '/hooks'],
        ['nonsense', 'not a url'],
    ])('%s', (_label, url) => {
        expect(() => assertPublicHttpsUrl(url)).toThrow(OutboundUrlError);
    });

    it('explains itself in copy safe to show the customer', () => {
        expect(() => assertPublicHttpsUrl('http://example.com')).toThrow(/https/);
        expect(() => assertPublicHttpsUrl('https://10.0.0.1')).toThrow(/public host/);
    });
});

describe('naming the thing', () => {
    it('puts the caller noun in the message', () => {
        expect(() => assertPublicHttpsUrl('http://example.com', 'Webhook URLs')).toThrow('Webhook URLs must use https');
        expect(() => assertPublicHttpsUrl('https://localhost/x', 'Channel URLs')).toThrow(
            'Channel URLs must point at a public host',
        );
    });

    it('isPrivateHostname answers for a bare host', async () => {
        const { isPrivateHostname } = await import('../outbound-url');
        expect(isPrivateHostname('10.0.0.1')).toBe(true);
        expect(isPrivateHostname('VAULT.INTERNAL')).toBe(true);
        expect(isPrivateHostname('hooks.slack.com')).toBe(false);
    });
});
