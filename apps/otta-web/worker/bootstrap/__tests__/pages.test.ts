import { describe, expect, it } from 'vitest';
import { renderPromoteOwnerPage, renderReseedPage } from '../pages';

// Minimal platform state; renderReseedPage only reads `state.state`.
const readyState = { state: 'READY' } as any;
const notReadyState = { state: 'UNINITIALIZED' } as any;

describe('renderReseedPage — /__bootstrap__/seed', () => {
    it('renders a full, self-contained HTML page with the reconcile action', () => {
        const html = renderReseedPage(readyState);
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html).toContain('id="btn-reseed"');
        expect(html).toContain('id="reseed-secret"');
        // The button posts to the existing seed endpoint with the secret header.
        expect(html).toContain("fetch('/__bootstrap__/api/seed'");
        expect(html).toContain("'X-Bootstrap-Secret': secret");
        // No unresolved template-literal artifacts leaked into the output.
        expect(html).not.toContain('${');
    });

    it('points a not-yet-set-up platform at the full wizard, but not when READY', () => {
        expect(renderReseedPage(notReadyState)).toContain('/__bootstrap__');
        expect(renderReseedPage(notReadyState)).toContain('setup wizard');
        expect(renderReseedPage(readyState)).not.toContain('setup wizard');
    });
});

describe('renderPromoteOwnerPage — /__bootstrap__/promote-owner', () => {
    it('renders a secret + email form that posts to the promote endpoint', () => {
        const html = renderPromoteOwnerPage(readyState);
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html).toContain('id="btn-promote"');
        expect(html).toContain('id="promote-secret"');
        expect(html).toContain('id="promote-email"');
        expect(html).toContain("fetch('/api/admin/platform-owner/promote'");
        expect(html).toContain("'X-Bootstrap-Secret': secret");
        expect(html).not.toContain('${');
    });
});
