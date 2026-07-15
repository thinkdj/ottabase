import { describe, expect, it } from 'vitest';
import { INITIAL_CONFIG_ELEMENT_ID, buildInitialConfigScriptTag } from '../css-critical';

describe('buildInitialConfigScriptTag', () => {
    it('wraps the config as JSON inside a script tag with the expected id', () => {
        const tag = buildInitialConfigScriptTag({ brandName: 'Acme' });
        expect(tag).toBe(
            `<script type="application/json" id="${INITIAL_CONFIG_ELEMENT_ID}">{"brandName":"Acme"}</script>`,
        );
    });

    it('escapes "</script>" sequences inside string values so they cannot close the tag early', () => {
        const tag = buildInitialConfigScriptTag({ tagline: '</script><script>alert(1)</script>' });
        expect(tag).not.toContain('</script><script>alert(1)</script>');
        expect(tag).toContain('\\u003c/script\\u003e');
        // The wrapping tag itself must still close normally.
        expect(tag.endsWith('</script>')).toBe(true);
    });

    it('escapes ampersands and angle brackets', () => {
        const tag = buildInitialConfigScriptTag({ tagline: 'Fish & Chips <3' });
        expect(tag).toContain('Fish \\u0026 Chips \\u003c3');
    });

    it('escapes U+2028 and U+2029 line terminators', () => {
        const tagline = `line one${String.fromCharCode(0x2028)}line two${String.fromCharCode(0x2029)}line three`;
        const tag = buildInitialConfigScriptTag({ tagline });
        expect(tag).toContain('line one\\u2028line two\\u2029line three');
        expect(tag).not.toContain(String.fromCharCode(0x2028));
        expect(tag).not.toContain(String.fromCharCode(0x2029));
    });

    it('round-trips through JSON.parse back to the original value', () => {
        const config = { brandName: 'A & B <Co>', nested: { tagline: '</script>' } };
        const tag = buildInitialConfigScriptTag(config);
        const inner = tag.slice(tag.indexOf('>') + 1, tag.lastIndexOf('<'));
        expect(JSON.parse(inner)).toEqual(config);
    });
});
