import { describe, expect, it } from 'vitest';
import { generateReferralUsername, suggestReferralUsernames } from '../src/username';
import { validateReferralUsername } from '../src/validation';

const take = (seed: Parameters<typeof suggestReferralUsernames>[0], n: number) => {
    const out: string[] = [];
    for (const s of suggestReferralUsernames(seed)) {
        out.push(s);
        if (out.length === n) break;
    }
    return out;
};

describe('suggestReferralUsernames', () => {
    it('reads like the person first: first name, full name, email', () => {
        expect(take({ id: 'u1', name: 'Zoë O’Brien', email: 'zo.b+news@x.com' }, 3)).toEqual([
            'zoe',
            'zoeobrien',
            'zob',
        ]);
    });

    it('then a team flair, then a mascot', () => {
        // jane@ repeats the first name, so it is skipped: jane, janedoe, jane_x, jane_y, mascot
        const [, , flair, , mascot] = take({ id: 'u1', name: 'Jane Doe', email: 'jane@x.com' }, 5);
        expect(flair).toMatch(/^jane_[a-z]+$/);
        expect(mascot).toMatch(/^[a-z]+_[a-z]+$/);
    });

    it('falls straight to a mascot when nothing usable is known', () => {
        expect(take({ id: 'u1', name: '李', email: null }, 1)[0]).toMatch(/^[a-z]+_[a-z]+$/);
    });

    it('is deterministic per user and differs across users', () => {
        const seed = { name: '', email: '' };
        expect(take({ id: 'a', ...seed }, 5)).toEqual(take({ id: 'a', ...seed }, 5));
        expect(take({ id: 'a', ...seed }, 5)).not.toEqual(take({ id: 'b', ...seed }, 5));
    });

    it('only ever suggests valid, unique usernames', () => {
        const all = take({ id: 'u9', name: 'Maximiliana Wolfeschlegelstein', email: 'x@y.z' }, 40);
        expect(new Set(all).size).toBe(all.length);
        for (const s of all) expect(validateReferralUsername(s)).toEqual({ valid: true });
    });
});

describe('generateReferralUsername', () => {
    it('returns the first free suggestion', async () => {
        const taken = new Set(['jane', 'janedoe']);
        const name = await generateReferralUsername({ id: 'u1', name: 'Jane Doe' }, async (c) => taken.has(c));
        expect(name).toMatch(/^jane_[a-z]+$/);
    });

    it('gives up after maxAttempts', async () => {
        await expect(generateReferralUsername({ id: 'u1', name: 'Jane' }, async () => true, 3)).rejects.toThrow();
    });
});
