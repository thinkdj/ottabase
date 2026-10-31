import { describe, expect, it } from 'vitest';
import { parseMenuImage } from '../handlers/menu-crud-api';

describe('parseMenuImage', () => {
    it('keeps a stored file, a safe address or nothing, and refuses the rest', () => {
        const stored = { key: 'app/media/0123456789abcdef0123456789abcdef.png', width: 800, variants: ['thumb'] };
        expect(parseMenuImage(stored)).toEqual(stored);
        expect(parseMenuImage(' https://cdn.example.com/icon.png ')).toBe('https://cdn.example.com/icon.png');
        expect(parseMenuImage('/icons/home.svg')).toBe('/icons/home.svg');
        expect(parseMenuImage(null)).toBeNull();
        expect(parseMenuImage('')).toBeNull();
        expect(parseMenuImage('javascript:alert(1)')).toBeUndefined();
        expect(parseMenuImage({ key: 'https://evil.example/x.png' })).toBeUndefined();
        expect(parseMenuImage(42)).toBeUndefined();
    });
});
