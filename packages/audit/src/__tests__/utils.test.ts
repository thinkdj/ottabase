import { describe, expect, it } from 'vitest';
import { detectChanges, extractRequestContext, sanitizeData } from '../utils';

describe('extractRequestContext', () => {
    it('extracts url and method from Request', () => {
        const request = new Request('https://api.example.com/posts', { method: 'GET' });
        const ctx = extractRequestContext(request, 'user-1', 'user@example.com');
        expect(ctx.userId).toBe('user-1');
        expect(ctx.userEmail).toBe('user@example.com');
        expect(ctx.url).toBe('https://api.example.com/posts');
        expect(ctx.method).toBe('GET');
    });

    it('uses cf-connecting-ip when present', () => {
        const request = new Request('https://api.example.com', {
            headers: { 'cf-connecting-ip': '1.2.3.4' },
        });
        const ctx = extractRequestContext(request);
        expect(ctx.ipAddress).toBe('1.2.3.4');
    });

    it('falls back to x-forwarded-for', () => {
        const request = new Request('https://api.example.com', {
            headers: { 'x-forwarded-for': '10.0.0.1' },
        });
        const ctx = extractRequestContext(request);
        expect(ctx.ipAddress).toBe('10.0.0.1');
    });

    it('extracts user-agent', () => {
        const request = new Request('https://api.example.com', {
            headers: { 'user-agent': 'Mozilla/5.0' },
        });
        const ctx = extractRequestContext(request);
        expect(ctx.userAgent).toBe('Mozilla/5.0');
    });

    it('handles missing optional params', () => {
        const request = new Request('https://api.example.com');
        const ctx = extractRequestContext(request);
        expect(ctx.userId).toBeUndefined();
        expect(ctx.userEmail).toBeUndefined();
        expect(ctx.url).toMatch(/^https:\/\/api\.example\.com\/?$/);
    });
});

describe('detectChanges', () => {
    it('detects changed fields', () => {
        const oldData = { title: 'Old', count: 1 };
        const newData = { title: 'New', count: 1 };
        const changes = detectChanges(oldData, newData);
        expect(changes).toEqual({
            title: { from: 'Old', to: 'New' },
        });
    });

    it('detects new fields', () => {
        const oldData = { a: 1 };
        const newData = { a: 1, b: 2 };
        const changes = detectChanges(oldData, newData);
        expect(changes).toEqual({
            b: { from: undefined, to: 2 },
        });
    });

    it('detects removed fields', () => {
        const oldData = { a: 1, b: 2 };
        const newData = { a: 1 };
        const changes = detectChanges(oldData, newData);
        expect(changes).toEqual({
            b: { from: 2, to: undefined },
        });
    });

    it('returns empty object when no changes', () => {
        const data = { a: 1, b: 2 };
        expect(detectChanges(data, { ...data })).toEqual({});
    });

    it('handles multiple changes', () => {
        const oldData = { a: 1, b: 2, c: 3 };
        const newData = { a: 10, b: 2, d: 4 };
        const changes = detectChanges(oldData, newData);
        expect(changes.a).toEqual({ from: 1, to: 10 });
        expect(changes.c).toEqual({ from: 3, to: undefined });
        expect(changes.d).toEqual({ from: undefined, to: 4 });
    });
});

describe('sanitizeData', () => {
    it('redacts default sensitive fields', () => {
        const data = { name: 'John', password: 'secret123', email: 'j@x.com' };
        const out = sanitizeData(data);
        expect(out.name).toBe('John');
        expect(out.email).toBe('j@x.com');
        expect(out.password).toBe('[REDACTED]');
    });

    it('redacts token and secret', () => {
        const data = { token: 'abc', secret: 'xyz' };
        const out = sanitizeData(data);
        expect(out.token).toBe('[REDACTED]');
        expect(out.secret).toBe('[REDACTED]');
    });

    it('accepts custom sensitive fields', () => {
        const data = { name: 'John', ssn: '123-45-6789' };
        const out = sanitizeData(data, ['ssn']);
        expect(out.name).toBe('John');
        expect(out.ssn).toBe('[REDACTED]');
    });

    it('does not mutate original object', () => {
        const data = { password: 'secret' };
        const out = sanitizeData(data);
        expect(data.password).toBe('secret');
        expect(out.password).toBe('[REDACTED]');
    });
});
