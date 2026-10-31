import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE } from '../defaults';
import { parseLenient } from '../fields';
import { SITE_FIELDS, SiteSettingsSchema } from '../site';
import { SHARE_CARD_SIZE } from '../share-card';
import { drawShareCard, wrapLines, type ShareCardScene } from '../share-card-draw';

/** A recording 2D context: text is "measured" at half the font size per character. */
function fakeCtx() {
    const calls: { text: string; x: number; y: number; font: string; fill: unknown; alpha: number }[] = [];
    const ctx = {
        fillStyle: '' as unknown,
        font: '16px x',
        globalAlpha: 1,
        textBaseline: 'alphabetic',
        textAlign: 'left',
        rects: [] as unknown[][],
        images: 0,
        measureText(text: string) {
            const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 16);
            return { width: text.length * size * 0.5 } as TextMetrics;
        },
        fillText(text: string, x: number, y: number) {
            calls.push({ text, x, y, font: this.font, fill: this.fillStyle, alpha: this.globalAlpha });
        },
        fillRect(...args: unknown[]) {
            this.rects.push([this.fillStyle, ...args]);
        },
        drawImage() {
            this.images++;
        },
        createLinearGradient: () => ({ addColorStop() {} }),
        beginPath() {},
        arc() {},
        fill() {},
        save() {},
        restore() {},
    };
    return { ctx, calls };
}

const scene = (over: Partial<ShareCardScene> = {}): ShareCardScene => ({
    heading: 'Ship the product, not the plumbing',
    subtext: 'Auth, an ORM over D1 and uploads, already wired together.',
    color: '#1e3a8a',
    siteName: 'Ottabase',
    domain: 'ottabase.dev',
    fonts: { heading: 'Outfit', body: 'Inter' },
    ...over,
});

describe('wrapLines', () => {
    const { ctx } = fakeCtx(); // 16px → 8 units per character
    it('wraps on words within the width', () => {
        expect(wrapLines(ctx, 'one two three four', 80, 5)).toEqual(['one two', 'three four']);
    });
    it('cuts the overflow of the last allowed line with an ellipsis', () => {
        const lines = wrapLines(ctx, 'one two three four five six', 80, 2);
        expect(lines).toHaveLength(2);
        expect(lines[1].endsWith('…')).toBe(true);
        expect(ctx.measureText(lines[1]).width).toBeLessThanOrEqual(80);
    });
    it('keeps an over-long word whole and handles empty text', () => {
        expect(wrapLines(ctx, 'supercalifragilistic', 40, 2)).toEqual(['supercalifragilistic']);
        expect(wrapLines(ctx, '   ', 40, 2)).toEqual([]);
    });
});

describe('drawShareCard', () => {
    it('fills the whole card and writes name, domain, heading and supporting text', () => {
        const { ctx, calls } = fakeCtx();
        drawShareCard(ctx as never, scene());
        expect(ctx.rects[0]).toEqual(['#1e3a8a', 0, 0, SHARE_CARD_SIZE.width, SHARE_CARD_SIZE.height]);
        const texts = calls.map((c) => c.text);
        expect(texts[0]).toBe('Ottabase');
        expect(texts[1]).toBe('ottabase.dev');
        expect(texts.join(' ')).toContain('Ship the product, not the plumbing');
        expect(texts.join(' ')).toContain('already wired together.');
        // Heading at the largest size that fits, in the theme's heading font; text stays on the card.
        expect(calls.find((c) => c.text.startsWith('Ship'))!.font).toBe('700 76px "Outfit", system-ui, sans-serif');
        for (const c of calls) expect(c.y).toBeLessThanOrEqual(SHARE_CARD_SIZE.height - 40);
    });

    it('names the site once: no brand-row name when the heading already is the name', () => {
        const { ctx, calls } = fakeCtx();
        drawShareCard(ctx as never, scene({ heading: 'Ottabase' }));
        expect(calls.filter((c) => c.text === 'Ottabase')).toHaveLength(1);
    });

    it('picks readable ink for the color: white on dark, near-black on light', () => {
        for (const [color, ink] of [
            ['#1e3a8a', '#ffffff'],
            ['#facc15', '#111111'],
        ]) {
            const { ctx, calls } = fakeCtx();
            drawShareCard(ctx as never, scene({ color }));
            expect(calls.every((c) => c.fill === ink)).toBe(true);
        }
    });

    it('shrinks a long heading to fit three lines, then ellipsizes rather than overflowing', () => {
        const { ctx, calls } = fakeCtx();
        drawShareCard(ctx as never, scene({ heading: 'word '.repeat(80), subtext: '' }));
        const heading = calls.filter((c) => c.font.startsWith('700'));
        expect(heading).toHaveLength(3);
        expect(heading[0].font).toContain('48px');
        expect(heading[2].text.endsWith('…')).toBe(true);
    });

    it('draws a background photo under a shade with white text, and the logo when given', () => {
        const { ctx, calls } = fakeCtx();
        const img = { width: 1600, height: 900 } as never;
        drawShareCard(
            ctx as never,
            scene({ color: '#facc15', background: img, logo: { width: 96, height: 96 } as never }),
        );
        expect(ctx.images).toBe(2);
        expect(calls.every((c) => c.fill === '#ffffff')).toBe(true);
    });
});

describe('social image settings', () => {
    it('validates the card like any other content', () => {
        const ok = {
            ...DEFAULT_SITE,
            share: { heading: 'Hi', color: '#112233', imageUrl: '/api/files/public/x.png?v=1' },
        };
        expect(SiteSettingsSchema.safeParse(ok).success).toBe(true);
        expect(SiteSettingsSchema.safeParse({ ...ok, share: { color: 'red' } }).success).toBe(false);
        expect(SiteSettingsSchema.safeParse({ ...ok, share: { backgroundUrl: 'javascript:x' } }).success).toBe(false);
    });

    it('reads a stored card field by field, so one stale value keeps its siblings', () => {
        const stored = { ...DEFAULT_SITE, share: { heading: 'Kept', color: 'not-a-color', imageUrl: '/i.png' } };
        expect(parseLenient(SITE_FIELDS, stored, DEFAULT_SITE).share).toEqual({ heading: 'Kept', imageUrl: '/i.png' });
        expect(parseLenient(SITE_FIELDS, { ...DEFAULT_SITE, share: 'junk' }, DEFAULT_SITE).share).toBeUndefined();
    });
});
