import { describe, expect, it } from 'vitest';
import {
    renderBindingsErrorPage,
    renderLockedPage,
    renderMaintenancePage,
    renderPromoteOwnerPage,
    renderReseedPage,
    renderUnauthorizedPage,
    renderWizardPage,
} from '../pages';
import type { BindingProbe, PlatformStateResult } from '../types';

const bindings = (over: Partial<BindingProbe> = {}): BindingProbe => ({
    d1: true,
    kv: true,
    r2: true,
    queue: true,
    assets: true,
    ...over,
});

const stateOf = (over: Partial<PlatformStateResult> = {}): PlatformStateResult => ({
    state: 'UNINITIALIZED',
    source: 'probe',
    panic: false,
    reason: 'No _ottabase_meta table found — fresh installation',
    bindings: bindings(),
    ...over,
});

const readyState = stateOf({ state: 'READY', source: 'db', reason: 'Platform state resolved from database: READY' });
const notReadyState = stateOf();

/** Every page is served straight from the worker, so each must stand alone. */
const ALL_PAGES: Array<[string, string]> = [
    ['wizard (fresh)', renderWizardPage(notReadyState)],
    ['wizard (ready)', renderWizardPage(readyState)],
    ['reseed', renderReseedPage(readyState)],
    ['promote-owner', renderPromoteOwnerPage(readyState)],
    ['maintenance', renderMaintenancePage(readyState)],
    ['locked', renderLockedPage(readyState)],
    ['bindings-error', renderBindingsErrorPage(stateOf({ bindings: bindings({ d1: false, kv: false }) }))],
    ['unauthorized', renderUnauthorizedPage()],
];

describe('bootstrap pages — shared contract', () => {
    it.each(ALL_PAGES)('%s is a complete, self-contained document', (_name, html) => {
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html).toContain('<title>');
        expect(html).toContain('<main>');
        expect(html).toContain('<h1>');
        // No unresolved template-literal artifacts leaked into the output.
        expect(html).not.toContain('${');
    });

    it.each(ALL_PAGES)('%s uses no em-dashes anywhere in the shipped page', (_name, html) => {
        // House style. Covers rendered copy plus the CSS/JS comments that ride
        // along inside the inline <style> and <script>.
        expect(html).not.toContain('—');
        expect(html).not.toContain('&mdash;');
    });

    it.each(ALL_PAGES)('%s shows the wordmark without an icon', (_name, html) => {
        expect(html).toContain('<span class="brand">Ottabase</span>');
        expect(html).not.toContain('LOGO_SVG');
    });

    it.each(ALL_PAGES)('%s makes no outbound request for styles, scripts or fonts', (_name, html) => {
        // The platform has no asset pipeline during bootstrap: everything is inline.
        expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
        expect(html).not.toMatch(/<script[^>]+src=/i);
        expect(html).not.toMatch(/@import\s+url/i);
        expect(html).not.toMatch(/https:\/\/fonts\./i);
    });

    it.each(ALL_PAGES)('%s carries both colour schemes', (_name, html) => {
        expect(html).toContain('color-scheme: light dark');
        expect(html).toContain('@media (prefers-color-scheme: dark)');
        expect(html).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it.each(ALL_PAGES)('%s offers a theme toggle that defaults to the system', (_name, html) => {
        expect(html).toContain('id="theme-toggle"');
        expect(html).toContain('Switch to the ');
        // Nothing is pre-selected in the served markup, so every load — including a
        // reload after toggling — starts from prefers-color-scheme.
        expect(html).not.toMatch(/<html[^>]*data-theme/);
    });

    it.each(ALL_PAGES)('%s never persists the chosen theme', (_name, html) => {
        // The wizard asks the operator to clear this browser's saved state; writing
        // our own key back would contradict that, so the choice lasts one page view.
        // Scope to the theme script only: the wizard's own script legitimately
        // clears ottabase.* keys, and it is emitted earlier in the document.
        const start = html.indexOf("var toggle = document.getElementById('theme-toggle');");
        expect(start).toBeGreaterThan(-1);
        const script = html.slice(start);
        expect(script).not.toContain('localStorage');
        expect(script).not.toContain('sessionStorage');
        expect(script).not.toContain('document.cookie');
    });

    it.each(ALL_PAGES)('%s applies dark tokens to the media query and the override alike', (_name, html) => {
        // Both blocks are interpolated from one DARK_TOKENS constant — if this count
        // ever drops to 1, the toggle and the system default have drifted apart.
        const occurrences = html.split('--background: 222.2 84% 4.9%;').length - 1;
        expect(occurrences).toBe(2);
        expect(html).toContain(":root:not([data-theme='light'])");
        expect(html).toContain(":root[data-theme='dark']");
    });
});

describe('renderWizardPage — /__bootstrap__', () => {
    it('renders four action steps with the token field shared across them', () => {
        const html = renderWizardPage(notReadyState);
        expect(html).toContain('id="bootstrap-secret"');
        for (const id of ['btn-init', 'btn-seed', 'btn-owner', 'btn-finalize']) {
            expect(html).toContain(`id="${id}"`);
        }
        for (const step of ['Database', 'Roles', 'Owner', 'Launch']) {
            expect(html).toContain(step);
        }
        // The rail is the only progress indicator — the old tab strip + progress bar are gone.
        expect(html).not.toContain('progress-fill');
        expect(html).not.toContain('step-tab');
    });

    it('does not move the page under the reader on a timer', () => {
        const html = renderWizardPage(notReadyState);
        expect(html).not.toContain('startAutoAdvance');
        expect(html).not.toContain('setInterval');
        expect(html).not.toContain('Auto-advancing');
    });

    it('checks res.ok before treating a response as success', () => {
        // A 401 body is JSON too: without this the wrong token surfaced as a parse-shaped error.
        expect(renderWizardPage(notReadyState)).toContain('if (!res.ok');
    });

    it('binds behaviour with listeners rather than inline event handlers', () => {
        const html = renderWizardPage(notReadyState);
        expect(html).not.toMatch(/\son(click|change|submit|load)=/i);
    });

    it('disables the schema action and explains why when D1 is missing', () => {
        const html = renderWizardPage(stateOf({ bindings: bindings({ d1: false }) }));
        expect(html).toContain('A D1 database binding is required');
        expect(html).toContain('wrangler d1 create ottabase-db');
        expect(html).toMatch(/id="btn-init"\s+disabled/);
    });

    it('separates a required binding from an optional one', () => {
        const html = renderWizardPage(stateOf({ bindings: bindings({ d1: false, r2: false }) }));
        expect(html).toContain('binding-missing');
        expect(html).toContain('binding-optional');
        // Status is spelled out, never colour alone.
        expect(html).toContain('>Required<');
        expect(html).toContain('>Not set<');
    });

    it('lands on the completion panel when the platform is already READY', () => {
        const html = renderWizardPage(readyState);
        expect(html).toContain('finish(null)');
        expect(html).not.toContain('resume();');
    });
});

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

describe('renderBindingsErrorPage — missing configuration', () => {
    it('lists only D1 as blocking and demotes the rest to recommended', () => {
        const html = renderBindingsErrorPage(stateOf({ bindings: bindings({ d1: false, kv: false, r2: false }) }));
        expect(html).toContain('Required');
        expect(html).toContain('Recommended');
        // D1 blocks startup; KV and R2 only degrade it.
        expect(html).toMatch(/Required[\s\S]*OBCF_D1/);
        expect(html).toMatch(/Recommended[\s\S]*OBCF_KV/);
    });
});

describe('destructive-action safety', () => {
    it('seals the flow once setup completes', () => {
        // Every rail step becomes "reachable" when all steps are done, which would
        // otherwise put a live KV-wiping init button one click away on a running
        // platform. See handleInit -> clearKvNamespace.
        const html = renderWizardPage(readyState);
        expect(html).toContain('if (finished) return;');
        expect(html).toContain('finished = true;');
        expect(html).toContain('railButtons[r].disabled = true;');
    });
});

describe('renderMaintenancePage — degraded platform', () => {
    it('lets the reader stop the automatic reload', () => {
        // WCAG 2.2.1: an auto-refreshing page must offer a way to turn it off.
        const html = renderMaintenancePage(readyState);
        expect(html).toContain('id="btn-stop"');
        expect(html).toContain('clearInterval');
        // The per-second countdown must not be announced.
        expect(html).toContain('id="countdown" aria-hidden="true"');
    });
});

describe('renderUnauthorizedPage — no valid token', () => {
    it('asks for the token without disclosing platform internals', () => {
        const html = renderUnauthorizedPage();
        expect(html).toContain('This page needs a setup token');
        // An anonymous visitor must not learn the binding inventory or env names.
        expect(html).not.toContain('OBCF_D1');
        expect(html).not.toContain('AUTH_SECRET');
        expect(html).not.toContain('MIGRATION_SECRET');
    });
});

describe('semantics', () => {
    it('marks up environment reference material as a description list', () => {
        const html = renderWizardPage(notReadyState);
        expect(html).toContain('<dl class="deflist">');
        expect(html).toContain('<dt class="defterm">');
        expect(html).toContain('<dd class="defdesc">');
    });

    it('makes the scrollable log regions keyboard reachable', () => {
        // WCAG 2.1.1: a scroll container with no focusable child needs a tab stop.
        const html = renderWizardPage(notReadyState);
        expect(html).not.toMatch(/<div class="console"(?! tabindex="0")/);
        expect(html).toContain('<div class="console" tabindex="0"');
    });
});

describe('escaping', () => {
    it('escapes the state reason rather than injecting it as markup', () => {
        const hostile = stateOf({ reason: '<img src=x onerror="alert(1)">' });
        const html = renderMaintenancePage(hostile);
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    });
});
