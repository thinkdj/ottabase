/**
 * Setup URLs: the one route map for every URL a third-party console asks for (OAuth redirect URIs,
 * webhook endpoints), and `getSetupUrls(origin)` to render it for one deployment.
 *
 * Handlers read their paths from here: `@ottabase/auth` builds its OAuth `redirect_uri` with
 * `authCallbackPath`, `@ottabase/postmaster` mounts `EMAIL_HOOKS_BASE_PATH` + `EMAIL_HOOK_PATHS`.
 * So what `otta setup-urls` and the admin Setup URLs page show cannot drift from what the code
 * serves. Adding a provider is one entry in `SETUP_PROVIDERS`.
 *
 * Pure and edge-safe: no I/O, no Node APIs. It never reads or returns a secret's value.
 */

/** Where `@ottabase/auth` is mounted. */
export const AUTH_BASE_PATH = '/api/auth';

/** Where `@ottabase/postmaster` mounts its provider hooks (its default `basePath`). */
export const EMAIL_HOOKS_BASE_PATH = '/api/email/hooks';

/** Postmaster hook routes, relative to `EMAIL_HOOKS_BASE_PATH`. */
export const EMAIL_HOOK_PATHS = {
    resend: '/resend',
    ses: '/ses',
    unsubscribe: '/unsubscribe',
} as const;

/** `/api/auth/callback/<provider>`: the OAuth redirect URI path, and the magic-link landing (`email`). */
export function authCallbackPath(provider: string): string {
    return `${AUTH_BASE_PATH}/callback/${provider}`;
}

/** Absolute path of a postmaster hook, e.g. `/api/email/hooks/resend`. */
export function emailHookPath(hook: keyof typeof EMAIL_HOOK_PATHS): string {
    return `${EMAIL_HOOKS_BASE_PATH}${EMAIL_HOOK_PATHS[hook]}`;
}

export interface SetupUrlSpec {
    /** The field name the provider's console uses. */
    label: string;
    /** Path appended to the origin. Omitted: the value is the origin itself. */
    path?: string;
    /** One short line shown under the value. */
    note?: string;
}

export interface SetupProvider {
    id: string;
    name: string;
    /** `auth`: sign-in providers. `email`: delivery webhooks. */
    group: 'auth' | 'email';
    /** The console page the URLs are pasted into. */
    consoleUrl: string;
    /** Env keys the provider needs. All set means configured. Names only, never values. */
    env: readonly string[];
    /** Package key the routes belong to; the provider is listed only when it is installed. Omitted: core. */
    package?: string;
    urls: readonly SetupUrlSpec[];
}

/** An OAuth provider served by `@ottabase/auth`: the redirect URI plus any console-specific fields. */
function oauth(
    id: string,
    name: string,
    consoleUrl: string,
    env: string[],
    redirectLabel: string,
    extra: SetupUrlSpec[] = [],
): SetupProvider {
    return {
        id,
        name,
        group: 'auth',
        consoleUrl,
        env,
        urls: [...extra, { label: redirectLabel, path: authCallbackPath(id) }],
    };
}

/**
 * The route map. Ids of the `auth` entries are the `@ottabase/auth` preset ids, and their `env` is
 * what the preset needs to be offered at sign-in.
 */
export const SETUP_PROVIDERS: readonly SetupProvider[] = [
    oauth(
        'google',
        'Google',
        'https://console.cloud.google.com/apis/credentials',
        ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        'Authorized redirect URI',
        [{ label: 'Authorized JavaScript origin' }],
    ),
    oauth(
        'github',
        'GitHub',
        'https://github.com/settings/developers',
        ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
        'Authorization callback URL',
        [{ label: 'Homepage URL' }],
    ),
    oauth(
        'discord',
        'Discord',
        'https://discord.com/developers/applications',
        ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
        'Redirect',
    ),
    oauth(
        'azure-ad',
        'Microsoft (Azure AD)',
        'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
        ['AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AZURE_AD_TENANT_ID'],
        'Redirect URI (Web)',
    ),
    oauth(
        'auth0',
        'Auth0',
        'https://manage.auth0.com/',
        ['AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_ISSUER'],
        'Allowed Callback URL',
    ),
    {
        id: 'resend',
        name: 'Resend',
        group: 'email',
        consoleUrl: 'https://resend.com/webhooks',
        env: ['EMAIL_RESEND_WEBHOOK_SECRET'],
        package: 'postmaster',
        urls: [
            {
                label: 'Webhook endpoint',
                path: emailHookPath('resend'),
                note: 'Events: email.bounced, email.complained. Its signing secret goes in EMAIL_RESEND_WEBHOOK_SECRET.',
            },
        ],
    },
    {
        id: 'ses',
        name: 'Amazon SES (via SNS)',
        group: 'email',
        consoleUrl: 'https://console.aws.amazon.com/sns/v3/home#/subscriptions',
        env: ['EMAIL_SES_WEBHOOK_SECRET'],
        package: 'postmaster',
        urls: [
            {
                label: 'HTTPS subscription endpoint',
                path: `${emailHookPath('ses')}/{EMAIL_SES_WEBHOOK_SECRET}`,
                note: 'Replace {EMAIL_SES_WEBHOOK_SECRET} with that secret. The subscription confirms itself.',
            },
        ],
    },
];

export interface SetupUrl {
    label: string;
    value: string;
    note?: string;
}

export interface SetupUrlGroup extends Omit<SetupProvider, 'urls'> {
    urls: SetupUrl[];
}

export interface SetupUrls {
    /** The normalized origin every URL was built from. */
    origin: string;
    providers: SetupUrlGroup[];
}

export interface SetupUrlsOptions {
    /** Installed package keys. Given: providers of packages not in it are dropped. Omitted: all are listed. */
    packages?: readonly string[];
}

/** localhost, *.localhost, 127.x.x.x and [::1]: the only hosts allowed to stay on http. */
function isLoopback(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '[::1]' ||
        /^127(?:\.\d{1,3}){3}$/.test(hostname)
    );
}

/**
 * Validate a base URL and reduce it to an origin: scheme and host lowercased, no default port, no
 * trailing slash. A bare host gets `https://` (`http://` for loopback). A public host is always
 * https; http stays only for loopback, which OAuth consoles accept for local development.
 * Throws on anything that is not an http(s) origin: a path, query, hash or credentials.
 */
export function normalizeOrigin(input: string): string {
    const raw = input.trim();
    if (!raw) throw new Error('A base URL is required, e.g. https://app.example.com');
    const explicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    let url: URL;
    try {
        url = new URL(explicitScheme ? raw : `https://${raw}`);
    } catch {
        throw new Error(`"${input}" is not a valid URL`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error(`"${input}" must use https`);
    }
    if (url.username || url.password) throw new Error(`"${input}" must not carry credentials`);
    if (url.pathname !== '/' || url.search || url.hash) {
        throw new Error(`"${input}" has a path; pass the origin only, e.g. ${url.protocol}//${url.host}`);
    }
    const loopback = isLoopback(url.hostname);
    if (!loopback || !explicitScheme) url.protocol = loopback ? 'http:' : 'https:';
    return url.origin;
}

/** Every URL to paste into each provider's console for one origin, grouped by provider. */
export function getSetupUrls(baseUrl: string, options: SetupUrlsOptions = {}): SetupUrls {
    const origin = normalizeOrigin(baseUrl);
    const installed = options.packages ? new Set(options.packages) : null;
    const providers = SETUP_PROVIDERS.filter((p) => !p.package || !installed || installed.has(p.package)).map(
        ({ urls, ...provider }) => ({
            ...provider,
            urls: urls.map(({ label, path, note }) => ({
                label,
                value: path ? `${origin}${path}` : origin,
                ...(note ? { note } : {}),
            })),
        }),
    );
    return { origin, providers };
}

/** The provider's env keys that are unset or blank in `env`. Reads presence only, never returns values. */
export function missingSetupEnv(provider: Pick<SetupProvider, 'env'>, env: object): string[] {
    const values = env as Record<string, unknown>;
    return provider.env.filter((key) => {
        const value = values[key];
        return typeof value !== 'string' || value.trim() === '';
    });
}

/** The route map entry for `id`, or undefined. */
export function findSetupProvider(id: string): SetupProvider | undefined {
    return SETUP_PROVIDERS.find((provider) => provider.id === id);
}
