import { describe, expect, it } from 'vitest';
import { parseShortcut } from '../SpotlightProvider';

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('parseShortcut', () => {
    it('matches Shift plus a symbol by physical key, since Shift changes e.key', () => {
        const check = parseShortcut('shift+/');
        expect(check(key({ key: '?', code: 'Slash', shiftKey: true }))).toBe(true);
        expect(check(key({ key: '/', code: 'Slash' }))).toBe(false);
    });

    it('matches mod shortcuts case-insensitively and with Shift-uppercased letters', () => {
        expect(parseShortcut('mod+k')(key({ key: 'k', code: 'KeyK', metaKey: true }))).toBe(true);
        expect(parseShortcut('mod+shift+k')(key({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true }))).toBe(true);
    });

    it('requires mod and alt to match exactly', () => {
        expect(parseShortcut('/')(key({ key: '/', code: 'Slash' }))).toBe(true);
        expect(parseShortcut('/')(key({ key: '/', code: 'Slash', ctrlKey: true }))).toBe(false);
        expect(parseShortcut('mod+k')(key({ key: 'k', code: 'KeyK' }))).toBe(false);
        expect(parseShortcut('mod+k')(key({ key: 'k', code: 'KeyK', metaKey: true, altKey: true }))).toBe(false);
    });
});
