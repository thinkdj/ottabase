import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AUTH_REDIRECT, rememberReturnPath, resolveAuthRedirect } from '../auth-redirect';

// Where login and registration send the person: the page they were stopped at, once, else their profile.
const visit = (path: string) => window.history.replaceState(null, '', path);

describe('the post-auth redirect', () => {
    afterEach(() => {
        sessionStorage.clear();
        visit('/');
    });

    it('lands on the profile when nothing was remembered', () => {
        expect(DEFAULT_AUTH_REDIRECT).toBe('/profile');
        expect(resolveAuthRedirect()).toBe('/profile');
    });

    it('returns to the page a guard stopped, query and hash included, exactly once', () => {
        visit('/billing?plan=team#invoices');
        rememberReturnPath();
        visit('/login');

        expect(resolveAuthRedirect()).toBe('/billing?plan=team#invoices');
        expect(resolveAuthRedirect()).toBe('/profile');
    });

    it('never returns to an auth page', () => {
        visit('/login?next=1');
        rememberReturnPath();
        expect(resolveAuthRedirect()).toBe('/profile');
    });

    it('refuses a stored target that leaves the site', () => {
        for (const target of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil.example']) {
            sessionStorage.setItem('ottabase.auth.returnTo', target);
            expect(resolveAuthRedirect(), target).toBe('/profile');
        }
    });
});
