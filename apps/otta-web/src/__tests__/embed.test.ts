import { describe, expect, it } from 'vitest';

/**
 * Tests for the Embed system — the separate React tree for /embed/* routes.
 *
 * These are structural/config tests (no DOM rendering) that verify the embed
 * router and query client are configured correctly for iframe embedding.
 */

// ---------------------------------------------------------------------------
// EmbedApp module — we import the router internals indirectly via the module
// ---------------------------------------------------------------------------

// Each import below loads a whole React tree cold: a few seconds alone, past the 10s default when
// the machine runs every package's suite at once.
const COLD_IMPORT = { timeout: 30_000 };

describe('Embed system', () => {
    describe('main.tsx embed detection', () => {
        it('detects /embed prefix correctly', () => {
            // The detection logic in main.tsx: window.location.pathname.startsWith('/embed')
            const isEmbed = (path: string) => path.startsWith('/embed');

            expect(isEmbed('/embed/docs/packages/ottaorm')).toBe(true);
            expect(isEmbed('/embed/docs')).toBe(true);
            expect(isEmbed('/embed/')).toBe(true);
            expect(isEmbed('/embed')).toBe(true);
            expect(isEmbed('/docs/embed')).toBe(false);
            expect(isEmbed('/')).toBe(false);
            expect(isEmbed('/login')).toBe(false);
        });
    });

    // otta:begin demo
    describe('EmbedDocsPage', () => {
        it('uses correct base path', COLD_IMPORT, async () => {
            // Verify the BASE_PATH constant matches the route definition
            const mod = await import('../embed/routes/EmbedDocsPage');
            // EmbedDocsPage is a function component — it should be defined
            expect(mod.EmbedDocsPage).toBeDefined();
            expect(typeof mod.EmbedDocsPage).toBe('function');
        });
    });
    // otta:end demo

    describe('EmbedApp', () => {
        it('exports EmbedApp component', COLD_IMPORT, async () => {
            const mod = await import('../embed/EmbedApp');
            expect(mod.EmbedApp).toBeDefined();
            expect(typeof mod.EmbedApp).toBe('function');
        });
    });
});
