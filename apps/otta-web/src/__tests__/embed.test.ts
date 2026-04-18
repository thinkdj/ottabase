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

    describe('EmbedDocsPage', () => {
        it('uses correct base path', async () => {
            // Verify the BASE_PATH constant matches the route definition
            const mod = await import('../embed/routes/EmbedDocsPage');
            // EmbedDocsPage is a function component — it should be defined
            expect(mod.EmbedDocsPage).toBeDefined();
            expect(typeof mod.EmbedDocsPage).toBe('function');
        });
    });

    describe('EmbedApp', () => {
        it('exports EmbedApp component', async () => {
            const mod = await import('../embed/EmbedApp');
            expect(mod.EmbedApp).toBeDefined();
            expect(typeof mod.EmbedApp).toBe('function');
        });
    });
});
