import { describe, expect, it } from 'vitest';
import {
    authCallbackPath,
    emailHookPath,
    findSetupProvider,
    getSetupUrls,
    missingSetupEnv,
    normalizeOrigin,
    SETUP_PROVIDERS,
} from '../setup-urls';

/** label -> value for one provider, for readable assertions. */
function urlsOf(id: string, origin = 'https://app.example.com') {
    const provider = getSetupUrls(origin).providers.find((p) => p.id === id);
    if (!provider) throw new Error(`no provider ${id}`);
    return Object.fromEntries(provider.urls.map((u) => [u.label, u.value]));
}

describe('normalizeOrigin', () => {
    it('reduces a URL to its origin: lowercase host, no trailing slash, no default port', () => {
        expect(normalizeOrigin('https://App.Example.com/')).toBe('https://app.example.com');
        expect(normalizeOrigin('  https://app.example.com  ')).toBe('https://app.example.com');
        expect(normalizeOrigin('https://app.example.com:443')).toBe('https://app.example.com');
        expect(normalizeOrigin('https://app.example.com:8443')).toBe('https://app.example.com:8443');
    });

    it('adds https to a bare host and upgrades http on a public host', () => {
        expect(normalizeOrigin('app.example.com')).toBe('https://app.example.com');
        expect(normalizeOrigin('http://app.example.com')).toBe('https://app.example.com');
        expect(normalizeOrigin('my-app.acme.workers.dev')).toBe('https://my-app.acme.workers.dev');
    });

    it('keeps http for loopback hosts, and defaults a bare loopback host to http', () => {
        expect(normalizeOrigin('http://127.0.0.1:3003')).toBe('http://127.0.0.1:3003');
        expect(normalizeOrigin('http://localhost:5173/')).toBe('http://localhost:5173');
        expect(normalizeOrigin('localhost:3003')).toBe('http://localhost:3003');
        expect(normalizeOrigin('http://app.localhost')).toBe('http://app.localhost');
        expect(normalizeOrigin('http://[::1]:3004')).toBe('http://[::1]:3004');
        expect(normalizeOrigin('https://localhost:3003')).toBe('https://localhost:3003');
    });

    it('rejects anything that is not an http(s) origin', () => {
        expect(() => normalizeOrigin('')).toThrow(/required/);
        expect(() => normalizeOrigin('   ')).toThrow(/required/);
        expect(() => normalizeOrigin('ftp://app.example.com')).toThrow(/https/);
        expect(() => normalizeOrigin('https://app.example.com/app')).toThrow(/origin only/);
        expect(() => normalizeOrigin('https://app.example.com/?x=1')).toThrow(/origin only/);
        expect(() => normalizeOrigin('https://app.example.com/#top')).toThrow(/origin only/);
        expect(() => normalizeOrigin('https://user:pass@app.example.com')).toThrow(/credentials/);
        expect(() => normalizeOrigin('https://exa mple.com')).toThrow(/not a valid URL/);
    });
});

describe('route map paths', () => {
    it('are the paths the auth and postmaster handlers serve', () => {
        expect(authCallbackPath('google')).toBe('/api/auth/callback/google');
        expect(authCallbackPath('email')).toBe('/api/auth/callback/email');
        expect(emailHookPath('resend')).toBe('/api/email/hooks/resend');
        expect(emailHookPath('ses')).toBe('/api/email/hooks/ses');
        expect(emailHookPath('unsubscribe')).toBe('/api/email/hooks/unsubscribe');
    });

    it('gives every provider a unique id, a console URL, env keys and at least one URL', () => {
        const ids = SETUP_PROVIDERS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const provider of SETUP_PROVIDERS) {
            expect(provider.consoleUrl).toMatch(/^https:\/\//);
            expect(provider.env.length).toBeGreaterThan(0);
            expect(provider.urls.length).toBeGreaterThan(0);
        }
    });
});

describe('getSetupUrls', () => {
    it('returns the normalized origin and every provider, grouped', () => {
        const result = getSetupUrls('App.Example.com/');
        expect(result.origin).toBe('https://app.example.com');
        expect(result.providers.map((p) => p.id)).toEqual(SETUP_PROVIDERS.map((p) => p.id));
        expect(result.providers.every((p) => p.group === 'auth' || p.group === 'email')).toBe(true);
    });

    it('Google: authorized JavaScript origin and redirect URI', () => {
        expect(urlsOf('google')).toEqual({
            'Authorized JavaScript origin': 'https://app.example.com',
            'Authorized redirect URI': 'https://app.example.com/api/auth/callback/google',
        });
    });

    it('GitHub: homepage URL and authorization callback URL', () => {
        expect(urlsOf('github')).toEqual({
            'Homepage URL': 'https://app.example.com',
            'Authorization callback URL': 'https://app.example.com/api/auth/callback/github',
        });
    });

    it('Discord, Microsoft and Auth0: the redirect URI', () => {
        expect(urlsOf('discord')).toEqual({ Redirect: 'https://app.example.com/api/auth/callback/discord' });
        expect(urlsOf('azure-ad')).toEqual({
            'Redirect URI (Web)': 'https://app.example.com/api/auth/callback/azure-ad',
        });
        expect(urlsOf('auth0')).toEqual({
            'Allowed Callback URL': 'https://app.example.com/api/auth/callback/auth0',
        });
    });

    it('Resend and SES: the postmaster webhook endpoints, the SES secret as a placeholder only', () => {
        expect(urlsOf('resend')).toEqual({ 'Webhook endpoint': 'https://app.example.com/api/email/hooks/resend' });
        expect(urlsOf('ses')).toEqual({
            'HTTPS subscription endpoint': 'https://app.example.com/api/email/hooks/ses/{EMAIL_SES_WEBHOOK_SECRET}',
        });
    });

    it('works for a local origin', () => {
        expect(urlsOf('google', 'http://127.0.0.1:3003')['Authorized redirect URI']).toBe(
            'http://127.0.0.1:3003/api/auth/callback/google',
        );
    });

    it('drops providers whose package is not installed, keeps core ones', () => {
        const ids = (packages: string[]) =>
            getSetupUrls('https://app.example.com', { packages }).providers.map((p) => p.id);
        expect(ids([])).not.toContain('resend');
        expect(ids([])).toContain('google');
        expect(ids(['postmaster'])).toEqual(expect.arrayContaining(['resend', 'ses', 'google']));
    });

    it('throws on an invalid base URL', () => {
        expect(() => getSetupUrls('https://app.example.com/path')).toThrow();
    });
});

describe('missingSetupEnv', () => {
    const google = findSetupProvider('google')!;

    it('lists unset and blank keys by name, never values', () => {
        expect(missingSetupEnv(google, {})).toEqual(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
        expect(missingSetupEnv(google, { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '  ' })).toEqual([
            'GOOGLE_CLIENT_SECRET',
        ]);
        expect(missingSetupEnv(google, { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).toEqual([]);
    });

    it('finds providers by id', () => {
        expect(findSetupProvider('github')?.name).toBe('GitHub');
        expect(findSetupProvider('nope')).toBeUndefined();
    });
});
