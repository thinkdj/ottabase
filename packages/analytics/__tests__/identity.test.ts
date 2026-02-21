import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    defaultVisitorIdResolver,
    fastVisitorHash,
    resetVisitorIdResolver,
    resolveVisitorId,
    setVisitorIdResolver,
} from '../src/identity';

/** Create a minimal mock Request with custom headers. */
function mockRequest(headers: Record<string, string> = {}): Request {
    return {
        headers: {
            get: (name: string) => headers[name.toLowerCase()] ?? null,
        },
    } as unknown as Request;
}

describe('defaultVisitorIdResolver', () => {
    it('returns a 16-char hex string', async () => {
        const req = mockRequest({
            'cf-connecting-ip': '1.2.3.4',
            'user-agent': 'TestAgent/1.0',
        });

        const id = await defaultVisitorIdResolver(req);
        expect(id).toMatch(/^[a-f0-9]{16}$/);
    });

    it('produces deterministic output for the same request', async () => {
        const req = mockRequest({
            'cf-connecting-ip': '1.2.3.4',
            'user-agent': 'TestAgent/1.0',
        });

        const id1 = await defaultVisitorIdResolver(req);
        const id2 = await defaultVisitorIdResolver(req);
        expect(id1).toBe(id2);
    });

    it('produces different hashes for different IPs', async () => {
        const req1 = mockRequest({ 'cf-connecting-ip': '1.1.1.1', 'user-agent': 'UA' });
        const req2 = mockRequest({ 'cf-connecting-ip': '2.2.2.2', 'user-agent': 'UA' });

        const id1 = await defaultVisitorIdResolver(req1);
        const id2 = await defaultVisitorIdResolver(req2);
        expect(id1).not.toBe(id2);
    });

    it('falls back to x-forwarded-for when cf-connecting-ip is missing', async () => {
        const req = mockRequest({ 'x-forwarded-for': '9.9.9.9', 'user-agent': 'UA' });
        const id = await defaultVisitorIdResolver(req);
        expect(id).toMatch(/^[a-f0-9]{16}$/);
    });

    it('handles missing headers gracefully', async () => {
        const req = mockRequest({});
        const id = await defaultVisitorIdResolver(req);
        // Should still produce a valid hash (uses "unknown" + empty UA)
        expect(id).toMatch(/^[a-f0-9]{16}$/);
    });

    it('produces the same hash on different days within the same ISO week', async () => {
        const req = mockRequest({ 'cf-connecting-ip': '1.2.3.4', 'user-agent': 'UA' });

        // Monday and Wednesday of the same week → same hash
        const monday = new Date('2026-02-16T12:00:00Z'); // Mon W08
        const wednesday = new Date('2026-02-18T12:00:00Z'); // Wed W08

        vi.useFakeTimers();

        vi.setSystemTime(monday);
        const idMon = await defaultVisitorIdResolver(req);

        vi.setSystemTime(wednesday);
        const idWed = await defaultVisitorIdResolver(req);

        expect(idMon).toBe(idWed);

        vi.useRealTimers();
    });

    it('produces a different hash in a different ISO week', async () => {
        const req = mockRequest({ 'cf-connecting-ip': '1.2.3.4', 'user-agent': 'UA' });

        const week8 = new Date('2026-02-16T12:00:00Z'); // W08
        const week9 = new Date('2026-02-23T12:00:00Z'); // W09

        vi.useFakeTimers();

        vi.setSystemTime(week8);
        const id1 = await defaultVisitorIdResolver(req);

        vi.setSystemTime(week9);
        const id2 = await defaultVisitorIdResolver(req);

        expect(id1).not.toBe(id2);

        vi.useRealTimers();
    });
});

describe('fastVisitorHash', () => {
    it('returns an 8-char hex string (FNV-1a 32-bit)', () => {
        const req = mockRequest({
            'cf-connecting-ip': '1.2.3.4',
            'user-agent': 'TestAgent/1.0',
        });

        const hash = fastVisitorHash(req);
        expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });

    it('is deterministic', () => {
        const req = mockRequest({ 'cf-connecting-ip': '1.1.1.1' });
        expect(fastVisitorHash(req)).toBe(fastVisitorHash(req));
    });
});

describe('setVisitorIdResolver / resolveVisitorId', () => {
    afterEach(() => {
        resetVisitorIdResolver();
    });

    it('uses the default resolver initially', async () => {
        const req = mockRequest({ 'cf-connecting-ip': '1.2.3.4', 'user-agent': 'UA' });
        const id = await resolveVisitorId(req);
        expect(id).toMatch(/^[a-f0-9]{16}$/);
    });

    it('uses a custom resolver after setVisitorIdResolver', async () => {
        setVisitorIdResolver(() => 'custom-id-42');

        const req = mockRequest({});
        const id = await resolveVisitorId(req);
        expect(id).toBe('custom-id-42');
    });

    it('supports async custom resolvers', async () => {
        setVisitorIdResolver(async () => {
            return 'async-id';
        });

        const req = mockRequest({});
        const id = await resolveVisitorId(req);
        expect(id).toBe('async-id');
    });

    it('resets to default resolver', async () => {
        setVisitorIdResolver(() => 'custom');
        resetVisitorIdResolver();

        const req = mockRequest({ 'cf-connecting-ip': '1.2.3.4', 'user-agent': 'UA' });
        const id = await resolveVisitorId(req);
        // Should be a hex hash again, not "custom"
        expect(id).toMatch(/^[a-f0-9]{16}$/);
    });
});
