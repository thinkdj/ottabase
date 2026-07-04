// ============================================================
// @ottabase/auth - Backend Request Handler (Cloudflare Workers)
// ============================================================
//
// Self-contained replacement for the Auth.js `Auth()` request handler.
// `handleAuthRequest` is a small router covering every `/api/auth/*`
// sub-path that isn't already owned by the host app (register,
// verify-email, password reset/change stay in the app -- see
// packages/auth/README.md for the full route table).
//
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { Account, User, VerificationToken } from '@ottabase/ottaorm/models';
import { bootstrapFirstUser } from './bootstrap';
import { serializeCookie, parseCookies, clearCookie } from './cookies';
import { hashPassword, verifyPassword, randomToken, getDummyPasswordHash, hashToken } from './crypto';
import { createCsrfCookiePair, verifyCsrfToken } from './csrf';
import { signJwt, verifyJwt } from './jwt';
import {
    exchangeCodeForTokens,
    fetchUserProfile,
    buildAuthorizationUrl,
    createPkcePair,
} from './providers/oauth-client';
import { getConfiguredProvider } from './providers/presets';
import { resolveMagicLinkSender } from './providers';
import {
    buildClearSessionCookie,
    createSessionCookieForUser,
    getSession,
    isProductionCookieEnv,
    resolveAuthSecret,
    resolveSecureCookie,
    resolveSessionCookieName,
    resolveSessionMaxAge,
    revokeSession,
} from './session-store';
import type { AuthEnv, AuthorizedUser, CreateAuthConfigOptions, SessionTokenPayload } from './types';

export type { AuthEnv, AuthorizedUser, CreateAuthConfigOptions, CredentialsAuthorizeOptions } from './types';
export { hashPassword, verifyPassword, hashToken } from './crypto';
export { bootstrapFirstUser } from './bootstrap';
export { getSession, revokeAllUserSessions, revokeSession, createSessionCookieForUser } from './session-store';

const CSRF_COOKIE_BASE = 'ottabase.csrf-token';
const CSRF_COOKIE_MAX_AGE = 60 * 60; // 1 hour
const OAUTH_STATE_COOKIE_BASE = 'ottabase.oauth-state';
const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes
const MAGIC_LINK_MAX_AGE_SECONDS = 15 * 60; // 15 minutes -- short-lived, unlike the app's own 24h email-verification links

// __Host- pins to the exact host with Path=/ (used for the root-scoped CSRF cookie);
// the OAuth-state cookie is scoped to Path=/api/auth so it can only use __Secure-.
function csrfCookieName(env: AuthEnv): string {
    return `${isProductionCookieEnv(env) ? '__Host-' : ''}${CSRF_COOKIE_BASE}`;
}
function oauthStateCookieName(env: AuthEnv): string {
    return `${isProductionCookieEnv(env) ? '__Secure-' : ''}${OAUTH_STATE_COOKIE_BASE}`;
}

/**
 * Origin allowlist check for state-changing requests: a browser always sends `Origin`
 * on cross-origin (and most same-origin) POSTs, so a present-but-mismatched Origin is
 * rejected as a defense-in-depth backstop to the double-submit CSRF token. A missing
 * Origin (some non-browser clients) falls through to the CSRF-token check.
 */
function isTrustedOrigin(request: Request, env: AuthEnv): boolean {
    const origin = request.headers.get('Origin');
    if (!origin) return true;
    try {
        const submitted = new URL(origin).origin;
        const allowed = new Set<string>([new URL(request.url).origin]);
        try {
            allowed.add(new URL(resolveFrontendUrl(env)).origin);
        } catch {
            // ignore malformed configured URL
        }
        return allowed.has(submitted);
    } catch {
        return false;
    }
}

function jsonResponse(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
    return new Response(JSON.stringify(data), { status, headers });
}

function ensureOrmConnection(env: AuthEnv): void {
    if (!env.OBCF_D1) return;
    registerConnection('default', createD1Driver(env.OBCF_D1));
}

function resolveFrontendUrl(env: AuthEnv): string {
    // Strip trailing slashes so `${resolveFrontendUrl(env)}${path}` and the OAuth
    // redirect_uri never produce a double slash (which would fail an exact redirect-uri
    // match at the provider and break OAuth).
    return (env.AUTH_URL || 'http://127.0.0.1:3003').replace(/\/+$/, '');
}

/** Only relative, single-leading-slash paths are accepted; anything else falls back, blocking open redirects. */
function sanitizeCallbackPath(raw: string | null | undefined, fallback = '/dashboard'): string {
    if (typeof raw !== 'string' || !raw) return fallback;
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
    try {
        // Parsing against a dummy base rejects anything that smuggles a scheme/host (e.g. "/\evil.com").
        const parsed = new URL(raw, 'http://ottabase.internal');
        if (parsed.origin !== 'http://ottabase.internal') return fallback;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return fallback;
    }
}

function redirectTo(env: AuthEnv, path: string): Response {
    return Response.redirect(`${resolveFrontendUrl(env)}${path}`, 302);
}

function errorRedirect(env: AuthEnv, options: CreateAuthConfigOptions | undefined, code: string): Response {
    const errorPage = options?.authConfig?.pages?.error || '/login';
    const separator = errorPage.includes('?') ? '&' : '?';
    return redirectTo(env, `${errorPage}${separator}error=${encodeURIComponent(code)}`);
}

async function defaultCredentialsAuthorize(
    credentials: { email: string; password: string },
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<AuthorizedUser | null> {
    const email = typeof credentials.email === 'string' ? credentials.email.trim().toLowerCase() : '';
    const password = typeof credentials.password === 'string' ? credentials.password : '';
    const minLength = options?.minPasswordLength ?? 6;

    if (!email || !password || password.length < minLength) return null;
    if (!env.OBCF_D1) throw new Error('OBCF_D1 database binding is required for credentials authentication');

    ensureOrmConnection(env);
    const user = await User.first({ email });

    const passwordHash = (user?.get('passwordHash') as string | null) ?? null;

    // Equalize timing between "no such user / no password set" and "wrong password":
    // both paths run exactly one PBKDF2 derive, so response time does not reveal whether
    // an account exists (user-enumeration oracle).
    if (!user || !passwordHash) {
        await verifyPassword(password, await getDummyPasswordHash());
        return null;
    }

    const valid = await verifyPassword(password, passwordHash);
    if (!valid) return null;

    const emailVerifiedRaw = user.get('emailVerified');
    const emailVerified = emailVerifiedRaw
        ? emailVerifiedRaw instanceof Date
            ? emailVerifiedRaw.getTime()
            : Number(emailVerifiedRaw)
        : null;

    return {
        id: String(user.get('id')),
        email: String(user.get('email')),
        name: (user.get('name') as string | null) ?? undefined,
        image: (user.get('image') as string | null) ?? undefined,
        emailVerified,
    };
}

/** Resolve the effective options for a request, applying environment-derived defaults. */
function resolveOptions(env: AuthEnv, options?: CreateAuthConfigOptions): CreateAuthConfigOptions {
    const envDisableCredentials = env.AUTH_DISABLE_CREDENTIALS === 'true' || env.AUTH_DISABLE_CREDENTIALS === '1';
    const envRequireVerified = env.AUTH_REQUIRE_EMAIL_VERIFIED === 'true' || env.AUTH_REQUIRE_EMAIL_VERIFIED === '1';

    return {
        ...options,
        disableCredentials: options?.disableCredentials ?? envDisableCredentials,
        requireVerifiedEmail: options?.requireVerifiedEmail ?? envRequireVerified,
    };
}

async function handleCsrf(env: AuthEnv, request: Request): Promise<Response> {
    const secret = resolveAuthSecret(env);
    const { token, cookieValue } = await createCsrfCookiePair(secret);
    const cookie = serializeCookie(csrfCookieName(env), cookieValue, {
        maxAgeSeconds: CSRF_COOKIE_MAX_AGE,
        secure: resolveSecureCookie(env, request),
        sameSite: 'Lax',
        httpOnly: true,
    });
    return jsonResponse({ csrfToken: token }, 200, { 'Set-Cookie': cookie });
}

async function handleGetSession(request: Request, env: AuthEnv, options: CreateAuthConfigOptions): Promise<Response> {
    const session = await getSession(request, env, options);
    return jsonResponse(session ?? null);
}

async function requireCsrf(request: Request, env: AuthEnv, submittedToken: unknown): Promise<boolean> {
    // Defense in depth: reject a mismatched Origin outright before the token check.
    if (!isTrustedOrigin(request, env)) return false;
    const cookies = parseCookies(request.headers.get('Cookie'));
    const secret = resolveAuthSecret(env);
    return verifyCsrfToken(
        cookies[csrfCookieName(env)],
        typeof submittedToken === 'string' ? submittedToken : undefined,
        secret,
    );
}

async function handleCredentialsCallback(
    request: Request,
    env: AuthEnv,
    options: CreateAuthConfigOptions,
): Promise<Response> {
    if (options.disableCredentials) {
        return jsonResponse({ error: 'Credentials sign-in is disabled' }, 403);
    }

    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; csrfToken?: string };

    if (!(await requireCsrf(request, env, body.csrfToken))) {
        return jsonResponse({ error: 'Invalid or missing CSRF token' }, 403);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const user = options.authorize
        ? await options.authorize({ email, password })
        : await defaultCredentialsAuthorize({ email, password }, env, options);

    if (!user) {
        return jsonResponse({ error: 'Invalid email or password' }, 401);
    }

    if (options.requireVerifiedEmail && !user.emailVerified) {
        return jsonResponse({ error: 'Please verify your email before signing in' }, 401);
    }

    ensureOrmConnection(env);
    await bootstrapFirstUser(env, user);
    await options.onSignIn?.({ userId: user.id, email: user.email });

    const { cookie, session } = await createSessionCookieForUser(
        { id: user.id, email: user.email, name: user.name, image: user.image, emailVerified: user.emailVerified },
        env,
        request,
        options,
    );

    return jsonResponse({ success: true, session: { user: session.user, expires: session.expiresAt } }, 200, {
        'Set-Cookie': cookie,
    });
}

async function handleOAuthSignIn(
    request: Request,
    env: AuthEnv,
    options: CreateAuthConfigOptions,
    providerId: string,
): Promise<Response> {
    const provider = getConfiguredProvider(providerId, env);
    if (!provider) {
        return errorRedirect(env, options, 'OAuthSignin');
    }

    const url = new URL(request.url);
    const callbackUrl = sanitizeCallbackPath(url.searchParams.get('callbackUrl'));
    const state = randomToken(16);
    const { codeVerifier, codeChallenge } = await createPkcePair();

    const statePayload = { state, codeVerifier, callbackUrl, providerId, purpose: 'oauth-state' };
    const stateToken = await signJwt(statePayload, resolveAuthSecret(env), { expiresInSeconds: OAUTH_STATE_MAX_AGE });
    const stateCookie = serializeCookie(oauthStateCookieName(env), stateToken, {
        maxAgeSeconds: OAUTH_STATE_MAX_AGE,
        secure: resolveSecureCookie(env, request),
        sameSite: 'Lax',
        httpOnly: true,
        path: '/api/auth',
    });

    const redirectUri = `${resolveFrontendUrl(env)}/api/auth/callback/${providerId}`;
    const authorizationUrl = buildAuthorizationUrl(provider, { redirectUri, state, codeChallenge });

    return new Response(null, { status: 302, headers: { Location: authorizationUrl, 'Set-Cookie': stateCookie } });
}

/** Redirect to the error page and clear the OAuth-state cookie (cleaned up on every terminal path). */
function oauthErrorRedirect(
    env: AuthEnv,
    options: CreateAuthConfigOptions | undefined,
    code: string,
    request: Request,
): Response {
    const errorPage = options?.authConfig?.pages?.error || '/login';
    const separator = errorPage.includes('?') ? '&' : '?';
    const location = `${resolveFrontendUrl(env)}${errorPage}${separator}error=${encodeURIComponent(code)}`;
    const clearState = clearCookie(oauthStateCookieName(env), {
        secure: resolveSecureCookie(env, request),
        path: '/api/auth',
    });
    return new Response(null, {
        status: 302,
        headers: [
            ['Location', location],
            ['Set-Cookie', clearState],
        ],
    });
}

async function handleOAuthCallback(
    request: Request,
    env: AuthEnv,
    options: CreateAuthConfigOptions,
    providerId: string,
): Promise<Response> {
    const url = new URL(request.url);

    if (url.searchParams.get('error')) {
        return oauthErrorRedirect(env, options, 'OAuthSignin', request);
    }

    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const cookies = parseCookies(request.headers.get('Cookie'));
    const stateToken = cookies[oauthStateCookieName(env)];

    if (!code || !stateParam || !stateToken) {
        return oauthErrorRedirect(env, options, 'OAuthCallback', request);
    }

    const statePayload = await verifyJwt<{
        state: string;
        codeVerifier: string;
        callbackUrl: string;
        providerId: string;
        purpose?: string;
    }>(stateToken, resolveAuthSecret(env));

    if (
        !statePayload ||
        statePayload.purpose !== 'oauth-state' ||
        statePayload.state !== stateParam ||
        statePayload.providerId !== providerId
    ) {
        return oauthErrorRedirect(env, options, 'OAuthCallback', request);
    }

    const provider = getConfiguredProvider(providerId, env);
    if (!provider) {
        return oauthErrorRedirect(env, options, 'OAuthSignin', request);
    }

    let userId!: string;
    let userEmail!: string;
    let userName: string | null = null;
    let userImage: string | null = null;
    let emailVerifiedAt: number | null = null;

    try {
        const redirectUri = `${resolveFrontendUrl(env)}/api/auth/callback/${providerId}`;
        const tokens = await exchangeCodeForTokens(provider, {
            code,
            redirectUri,
            codeVerifier: statePayload.codeVerifier,
        });
        const profile = await fetchUserProfile(provider, tokens);

        if (!profile.email) {
            return oauthErrorRedirect(env, options, 'OAuthCallback', request);
        }

        const normalizedEmail = profile.email.trim().toLowerCase();

        ensureOrmConnection(env);

        const existingAccount = await Account.first({
            provider: providerId,
            providerAccountId: profile.providerAccountId,
        });

        if (existingAccount) {
            const user = await User.find(String(existingAccount.get('userId')));
            if (!user) return oauthErrorRedirect(env, options, 'OAuthCallback', request);
            userId = String(user.get('id'));
            userEmail = String(user.get('email'));
            userName = (user.get('name') as string | null) ?? null;
            userImage = (user.get('image') as string | null) ?? null;
            emailVerifiedAt = user.get('emailVerified') ? new Date(user.get('emailVerified') as any).getTime() : null;
        } else {
            const existingUser = await User.first({ email: normalizedEmail });
            if (existingUser) {
                // An account already exists for this email but has never signed in with this
                // provider before. Do not silently link -- that would let anyone able to
                // register an OAuth identity with a matching (possibly unverified) email
                // hijack an existing account. Require the user to sign in with their
                // existing method first and link providers explicitly.
                return oauthErrorRedirect(env, options, 'OAuthAccountNotLinked', request);
            }

            const newUser = await User.create({
                email: normalizedEmail,
                name: profile.name,
                image: profile.image,
                emailVerified: profile.emailVerified ? Date.now() : null,
            });

            userId = String(newUser.get('id'));
            userEmail = normalizedEmail;
            userName = profile.name;
            userImage = profile.image;
            emailVerifiedAt = profile.emailVerified ? Date.now() : null;

            try {
                await Account.create({
                    userId,
                    type: 'oauth',
                    provider: providerId,
                    providerAccountId: profile.providerAccountId,
                    accessToken: tokens.access_token ?? null,
                    refreshToken: tokens.refresh_token ?? null,
                    idToken: tokens.id_token ?? null,
                    tokenType: tokens.token_type ?? null,
                    scope: tokens.scope ?? null,
                    expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + Number(tokens.expires_in) : null,
                });
            } catch (accountError) {
                // Roll back the just-created user so a failed Account insert does not leave an
                // orphan user row -- which would otherwise trip the "existingUser but no account"
                // branch above and lock this email into OAuthAccountNotLinked forever.
                try {
                    await User.delete(userId);
                } catch (cleanupError) {
                    console.error('Failed to roll back orphaned OAuth user:', cleanupError);
                }
                throw accountError;
            }
        }

        // OAuth identity providers are trusted to have verified the user's email themselves --
        // but only when this OAuth sign-in itself actually asserts the email is verified. An
        // unverified provider email (e.g. GitHub falling back to an unverified primary/first
        // address) must not silently mark a pre-existing account as verified.
        if (!emailVerifiedAt && profile.emailVerified) {
            await User.update(userId, { emailVerified: Date.now() });
            emailVerifiedAt = Date.now();
        }
    } catch (error) {
        console.error(`OAuth callback failed for provider "${providerId}":`, error);
        return oauthErrorRedirect(env, options, 'OAuthCallback', request);
    }

    // Honor the verified-email requirement for OAuth too: if the deployment requires a
    // verified email and this provider did not assert one, do not sign the user in.
    if (options.requireVerifiedEmail && !emailVerifiedAt) {
        return oauthErrorRedirect(env, options, 'Verification', request);
    }

    await bootstrapFirstUser(env, { id: userId, email: userEmail, name: userName });
    await options.onSignIn?.({ userId, email: userEmail });

    const { cookie } = await createSessionCookieForUser(
        { id: userId, email: userEmail, name: userName, image: userImage, emailVerified: emailVerifiedAt },
        env,
        request,
        options,
    );

    const clearState = clearCookie(oauthStateCookieName(env), {
        secure: resolveSecureCookie(env, request),
        path: '/api/auth',
    });

    return new Response(null, {
        status: 302,
        headers: [
            ['Location', `${resolveFrontendUrl(env)}${statePayload.callbackUrl}`],
            ['Set-Cookie', cookie],
            ['Set-Cookie', clearState],
        ],
    });
}

async function handleMagicLinkSend(
    request: Request,
    env: AuthEnv,
    options: CreateAuthConfigOptions,
): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
        email?: string;
        csrfToken?: string;
        callbackUrl?: string;
    };

    if (!(await requireCsrf(request, env, body.csrfToken))) {
        return jsonResponse({ error: 'Invalid or missing CSRF token' }, 403);
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
        return jsonResponse({ error: 'A valid email is required' }, 400);
    }

    const sender = resolveMagicLinkSender(env);
    if (!sender) {
        return jsonResponse({ error: 'Magic link sign-in is not configured' }, 500);
    }

    ensureOrmConnection(env);
    const identifier = `login:${email}`;
    // The plaintext token goes only in the emailed link; the database stores just its
    // hash, so a DB read leak cannot be replayed to mint a session.
    const token = randomToken(32);
    const tokenHash = await hashToken(token);
    const expiresAtMs = Date.now() + MAGIC_LINK_MAX_AGE_SECONDS * 1000;

    // Invalidate any prior outstanding link for this email (one active link at a time).
    await VerificationToken.deleteByIdentifier(identifier).catch(() => {});
    await VerificationToken.create({ identifier, token: tokenHash, expires: expiresAtMs });

    const callbackUrl = sanitizeCallbackPath(body.callbackUrl);
    // Derive the link origin from the configured frontend URL, NOT the incoming Host
    // header, so a spoofed/forwarded Host cannot poison the emailed link.
    const verifyUrl = new URL('/api/auth/callback/email', resolveFrontendUrl(env));
    verifyUrl.searchParams.set('token', token);
    verifyUrl.searchParams.set('email', email);
    verifyUrl.searchParams.set('callbackUrl', callbackUrl);

    try {
        await sender.send({ identifier: email, url: verifyUrl.toString(), expires: new Date(expiresAtMs) });
    } catch (error) {
        // Don't leave a live token behind if the email never went out.
        await VerificationToken.deleteByIdentifierAndToken(identifier, tokenHash).catch(() => {});
        console.error('Failed to send magic link email:', error);
        return jsonResponse({ error: 'Failed to send magic link' }, 502);
    }

    return jsonResponse({ success: true });
}

async function handleMagicLinkCallback(
    request: Request,
    env: AuthEnv,
    options: CreateAuthConfigOptions,
): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    const callbackUrl = sanitizeCallbackPath(url.searchParams.get('callbackUrl'));

    if (!token || !email) {
        return errorRedirect(env, options, 'Verification');
    }

    ensureOrmConnection(env);
    const identifier = `login:${email}`;
    const tokenHash = await hashToken(token);
    // Atomic single-use consume: exactly one concurrent request can win the delete, so
    // the same link cannot be redeemed twice (double-spend race).
    const verification = await VerificationToken.consumeByIdentifierAndToken(identifier, tokenHash);

    if (!verification) {
        return errorRedirect(env, options, 'Verification');
    }

    const expiresAt = Number(verification.get('expires'));
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return errorRedirect(env, options, 'Verification');
    }

    let user = await User.first({ email });
    if (!user) {
        user = await User.create({ email, name: null, emailVerified: Date.now() });
    } else if (!user.get('emailVerified')) {
        await User.update(String(user.get('id')), { emailVerified: Date.now() });
    }

    const userId = String(user.get('id'));
    const userName = (user.get('name') as string | null) ?? null;
    const userImage = (user.get('image') as string | null) ?? null;

    await bootstrapFirstUser(env, { id: userId, email, name: userName });
    await options.onSignIn?.({ userId, email });

    const { cookie } = await createSessionCookieForUser(
        { id: userId, email, name: userName, image: userImage, emailVerified: Date.now() },
        env,
        request,
        options,
    );

    return new Response(null, {
        status: 302,
        headers: [
            ['Location', `${resolveFrontendUrl(env)}${callbackUrl}`],
            ['Set-Cookie', cookie],
        ],
    });
}

async function handleSignOut(request: Request, env: AuthEnv, options: CreateAuthConfigOptions): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { csrfToken?: string };
    if (!(await requireCsrf(request, env, body.csrfToken))) {
        return jsonResponse({ error: 'Invalid or missing CSRF token' }, 403);
    }

    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies[resolveSessionCookieName(env)];
    const payload = token ? await verifyJwt<SessionTokenPayload>(token, resolveAuthSecret(env)) : null;

    if (payload?.sub && payload.jti) {
        await revokeSession(payload.sub, payload.jti, env);
        try {
            await options.onSignOut?.(payload.sub);
        } catch (error) {
            console.warn('onSignOut hook failed:', error);
        }
    }

    const cookie = buildClearSessionCookie(env, request);
    return jsonResponse({ success: true }, 200, { 'Set-Cookie': cookie });
}

/**
 * Handle every `/api/auth/*` request not already owned by the host app.
 * Covers: csrf, session, credentials + OAuth + magic-link sign-in, sign-out.
 */
export async function handleAuthRequest(
    request: Request,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<Response> {
    try {
        if (!env.OBCF_D1) {
            return jsonResponse({ error: 'OBCF_D1 database binding is required for authentication' }, 500);
        }

        const resolvedOptions = resolveOptions(env, options);
        const url = new URL(request.url);
        const match = url.pathname.match(/\/api\/auth\/(.+)$/);
        const segments = (match?.[1] ?? '').split('/').filter(Boolean);
        const [action, param] = segments;

        if (action === 'csrf' && request.method === 'GET') {
            return handleCsrf(env, request);
        }

        if (action === 'session' && request.method === 'GET') {
            return handleGetSession(request, env, resolvedOptions);
        }

        if (action === 'callback' && param === 'credentials' && request.method === 'POST') {
            return handleCredentialsCallback(request, env, resolvedOptions);
        }

        if (action === 'callback' && param === 'email' && request.method === 'GET') {
            return handleMagicLinkCallback(request, env, resolvedOptions);
        }

        if (action === 'callback' && param && request.method === 'GET') {
            return handleOAuthCallback(request, env, resolvedOptions, param);
        }

        if (action === 'signin' && param === 'email' && request.method === 'POST') {
            return handleMagicLinkSend(request, env, resolvedOptions);
        }

        if (action === 'signin' && param && request.method === 'GET') {
            return handleOAuthSignIn(request, env, resolvedOptions, param);
        }

        if (action === 'signout' && request.method === 'POST') {
            return handleSignOut(request, env, resolvedOptions);
        }

        return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
        console.error('Auth request error:', error);
        return jsonResponse({ error: 'Authentication error' }, 500);
    }
}
