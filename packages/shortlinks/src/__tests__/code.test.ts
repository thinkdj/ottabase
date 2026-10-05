import { describe, expect, it } from 'vitest';
import { generateShortCode } from '../code';

describe('generateShortCode', () => {
    it('makes six readable characters by default', () => {
        const code = generateShortCode();
        expect(code).toMatch(/^[a-hj-km-np-z2-9]{6}$/);
        expect(generateShortCode(8)).toHaveLength(8);
    });

    it('does not repeat itself in practice', () => {
        const codes = new Set(Array.from({ length: 200 }, () => generateShortCode()));
        expect(codes.size).toBe(200);
    });
});
