import { describe, expect, it } from 'vitest';
import { AlertsSecretError, open, seal } from '../secret';

const SECRET = 'a-secret-of-at-least-sixteen-chars';

describe('channel secrets at rest', () => {
    it('round-trips, with a fresh IV every time', async () => {
        const a = await seal(SECRET, '{"url":"https://hooks.slack.com/services/x"}');
        const b = await seal(SECRET, '{"url":"https://hooks.slack.com/services/x"}');
        expect(a).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
        expect(a).not.toBe(b);
        expect(a).not.toContain('hooks.slack.com');
        await expect(open(SECRET, a)).resolves.toBe('{"url":"https://hooks.slack.com/services/x"}');
    });

    it('trims the secret: a pasted trailing newline is the same key', async () => {
        await expect(open(`${SECRET}\n`, await seal(SECRET, 'x'))).resolves.toBe('x');
    });

    it('answers null for another secret, a tampered value or something else entirely', async () => {
        const sealed = await seal(SECRET, 'x');
        await expect(open('another-secret-sixteen-plus', sealed)).resolves.toBeNull();
        await expect(open(SECRET, `${sealed.slice(0, -2)}AA`)).resolves.toBeNull();
        await expect(open(SECRET, 'plain text')).resolves.toBeNull();
        await expect(open(SECRET, null)).resolves.toBeNull();
    });

    it('refuses to seal without a usable secret', async () => {
        await expect(seal(undefined, 'x')).rejects.toThrow(AlertsSecretError);
        await expect(seal('short', 'x')).rejects.toThrow(AlertsSecretError);
    });
});
