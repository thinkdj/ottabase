# @ottabase/auth

Lightweight, dependency-free authentication for Ottabase apps on Cloudflare Workers + D1. Signed
session cookies, PBKDF2 credentials, generic OAuth2/OIDC, and magic-link email sign-in — all built
on the Web Crypto API (`crypto.subtle`) that Workers implements natively. No Auth.js, no Node
crypto, no third-party crypto or JWT library.

## Features

- **Signed session cookie** - Compact HS256 JWT (custom, minimal implementation) + a KV
  revocation registry, so normal sign-out revokes exactly one session immediately
- **PBKDF2-SHA256 passwords** - 100k iterations via `crypto.subtle`, no bcrypt/argon2 native
  bindings needed
- **CSRF protection** - Double-submit cookie for every state-changing endpoint
- **OAuth2 + PKCE** - One generic Authorization-Code client, five built-in presets: Google,
  GitHub, Discord, Azure AD, Auth0
- **Magic link sign-in** - Short-lived (15 min) passwordless email links, with dev-trap / SMTP /
  Resend senders auto-selected from env vars
- **UI components** - Ready-to-use login/register forms built on `@ottabase/ui-shadcn`
- **Framework-agnostic client** - Plain `fetch`-based client API and a Jotai-backed React hook

## Installation

```bash
pnpm add @ottabase/auth
```

## Quick Start

Mount the backend router for every `/api/auth/*` path your app doesn't already own:

```typescript
// worker entry point
import { handleAuthRequest } from '@ottabase/auth/backend';

export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith('/api/auth/')) {
            return handleAuthRequest(request, env);
        }
        return new Response('OK');
    },
};
```

Read the session anywhere else in the worker:

```typescript
import { getSession } from '@ottabase/auth/backend';

const session = await getSession(request, env);
// session: { user: { id, email, name, image, emailVerified, organizationId, roles, permissions, createdAt }, expires } | null
```

## Route Table

`handleAuthRequest(request, env, options?)` is a small router covering every `/api/auth/*`
sub-path that the package owns. Everything else stays in the host app.

### Owned by `@ottabase/auth` (via `handleAuthRequest`)

| Route                                 | Method | Description                                                    |
| -------------------------------------- | ------ | ---------------------------------------------------------------- |
| `/api/auth/csrf`                       | GET    | Sets the CSRF cookie, returns `{ csrfToken }`                    |
| `/api/auth/session`                    | GET    | Returns the current `Session` or `null`                          |
| `/api/auth/callback/credentials`       | POST   | `{ email, password, csrfToken }` → `{ success, session }` or `{ error }` |
| `/api/auth/signin/:provider`           | GET    | `?callbackUrl=` → 302 redirect to the OAuth provider              |
| `/api/auth/callback/:provider`         | GET    | Exchanges the OAuth code, creates a session, redirects to `callbackUrl` |
| `/api/auth/signin/email`               | POST   | `{ email, csrfToken, callbackUrl }` → sends a magic link          |
| `/api/auth/callback/email`             | GET    | Verifies the magic-link token, creates a session, redirects       |
| `/api/auth/signout`                    | POST   | `{ csrfToken }` → revokes the current session only, clears the cookie |

### Owned by the host app (not part of this package)

These routes already didn't depend on Auth.js and are unaffected by this package; they call
`hashPassword` / `verifyPassword` / `getSession` / `revokeAllUserSessions` from
`@ottabase/auth/backend` directly:

| Route                                    | Method    |
| ----------------------------------------- | --------- |
| `/api/auth/register`                      | POST      |
| `/api/auth/verify-email`                  | GET       |
| `/api/auth/verify-email/resend`           | POST      |
| `/api/auth/password/reset/request`        | POST      |
| `/api/auth/password/reset/confirm`        | POST      |
| `/api/auth/password/change`               | POST      |
| `/api/auth/config`                        | GET       |
| `/api/users/me`                           | GET/PATCH |

## Session Model

A session is a signed, self-contained JWT (`sub`, `jti`, `email`, `name`, `image`,
`emailVerified`, `organizationId`, `roles`, `permissions`, `createdAt`, `profileVersion`, `iat`,
`exp`) stored in an HttpOnly/Secure/`SameSite=Lax` cookie — `ottabase.session-token` by default,
overridable via `AUTH_COOKIE_NAME`. Verifying a request only needs the JWT signature check plus up
to two KV reads; there's no database read on the hot path unless a profile-version bump flags the
cached fields as stale.

Each session is paired with a lightweight KV registry record, `auth:usr:<userId>:sess:<jti>`:

- **Single-session revocation** (normal sign-out) deletes that one registry key. Every other
  session for the user is untouched.
- **All-sessions revocation** (password change/reset) writes a bulk
  `auth:usr:<userId>:revoked` key with a "revoked since &lt;timestamp&gt;" value; any session whose
  `iat` is at or before that timestamp is rejected.

```typescript
import { revokeSession, revokeAllUserSessions } from '@ottabase/auth/backend';

// Sign-out: revoke just this session (handleAuthRequest does this automatically on POST /api/auth/signout)
await revokeSession(userId, jti, env);

// Password change/reset: invalidate every session for the user
await revokeAllUserSessions(userId, env);
```

Pure, I/O-free helpers for reading a `Session` are in `@ottabase/auth/session`:

```typescript
import { isAuthenticated, requireAuth, getUserId, getUserEmail, hasVerifiedEmail, serializeSession } from '@ottabase/auth/session';

const session = await getSession(request, env);
if (isAuthenticated(session)) {
    console.log(session.user.id);
}

const required = requireAuth(session); // throws if not authenticated
const userId = getUserId(session); // string | null
const verified = hasVerifiedEmail(session); // boolean
const data = serializeSession(session); // { authenticated, user } shape for API responses
```

## Password Hashing

`hashPassword` / `verifyPassword` (from `@ottabase/auth/backend`) use PBKDF2-SHA256 with 100,000
iterations via `crypto.subtle`. Stored format: `pbkdf2$iterations$saltBase64$hashBase64`.

```typescript
import { hashPassword, verifyPassword } from '@ottabase/auth/backend';

const passwordHash = await hashPassword(password);
const valid = await verifyPassword(password, passwordHash);
```

## CSRF Protection

CSRF uses a double-submit cookie. `GET /api/auth/csrf` sets an HttpOnly cookie
(`ottabase.csrf-token`) containing `token.hmac(token)` and returns the plain `token` in the JSON
body. State-changing endpoints (credentials sign-in, magic-link send, sign-out) require the client
to echo that token back in the request body; the server re-derives the HMAC from the cookie and
compares. The client API handles this automatically:

```typescript
import { getCsrfToken, signInWithCredentials } from '@ottabase/auth/client';

const csrfToken = await getCsrfToken(); // also called internally by signInWithCredentials/sendMagicLink/signOut
await signInWithCredentials({ email, password });
```

## OAuth Providers

One generic OAuth2 Authorization-Code + PKCE (S256) client (`src/providers/oauth-client.ts`)
drives all five presets; each preset is just endpoint/scope/claim-mapping data. Providers are
enabled purely by which env vars are set — `autoConfigureProviders(env)` returns every configured
provider, `getConfiguredProvider(id, env)` looks up one by id (used internally by
`handleAuthRequest`).

For every provider, register this redirect URI with the provider:

```
https://your-domain.com/api/auth/callback/<provider>
```

| Provider  | id         | Required env vars                                                     |
| --------- | ---------- | ----------------------------------------------------------------------- |
| Google    | `google`   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                               |
| GitHub    | `github`   | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                               |
| Discord   | `discord`  | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`                             |
| Azure AD  | `azure-ad` | `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`      |
| Auth0     | `auth0`    | `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_ISSUER`                 |

Starting sign-in and handling the callback are both handled by `handleAuthRequest`:

```
GET /api/auth/signin/google?callbackUrl=/dashboard   -> 302 to Google
GET /api/auth/callback/google?code=...&state=...     -> creates session, 302 to callbackUrl
```

From the client:

```typescript
import { signInWithProvider } from '@ottabase/auth/client';

await signInWithProvider('google', { redirectTo: '/dashboard' });
```

`autoConfigureProviders` / `getConfiguredProvider` are exported from `@ottabase/auth/providers` (or
the package root) if you need to introspect configured providers yourself:

```typescript
import { autoConfigureProviders } from '@ottabase/auth/providers';

const providers = autoConfigureProviders(env); // OAuthProviderConfig[]
```

On first sign-in, an OAuth account is only linked to an **existing** user if that user already
signed in via the same provider before; if the email matches an existing account that has never
used this provider, the callback fails with `OAuthAccountNotLinked` rather than silently linking
(this would otherwise let anyone claim an OAuth identity with a matching email hijack an existing
account).

## Magic Link (Passwordless Email)

`POST /api/auth/signin/email` sends a short-lived (15 minute) sign-in link, distinct from the
app's own 24-hour email-verification links. `GET /api/auth/callback/email` verifies the token,
creates a session, and redirects.

`resolveMagicLinkSender(env)` (from `@ottabase/auth/providers`) picks a sender using this priority
order:

1. **Local KV dev-email-trap** - if `DEV_EMAIL_TRAP_ENABLED` is set and `OBCF_KV` is bound
2. **SMTP** - via `@ottabase/email`'s Nodemailer mailer, if `EMAIL_SERVER` + `EMAIL_FROM` are set
3. **Resend** - if `EMAIL_RESEND_API_KEY` is set

```typescript
import { resolveMagicLinkSender } from '@ottabase/auth/providers';

const sender = resolveMagicLinkSender(env); // MagicLinkSender | null
```

From the client:

```typescript
import { sendMagicLink } from '@ottabase/auth/client';

await sendMagicLink(email, { redirectTo: '/dashboard' });
```

## Client API

Framework-agnostic, `fetch`-based, JSON end-to-end (`@ottabase/auth/client`):

```typescript
import {
    signInWithCredentials,
    signInWithProvider,
    sendMagicLink,
    registerWithCredentials,
    getSession,
    signOut,
    isAuthenticated,
    getCsrfToken,
    requestEmailVerification,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    changePassword,
} from '@ottabase/auth/client';

await signInWithCredentials({ email, password }, { redirect: false });
await signInWithProvider('github', { redirectTo: '/dashboard' });
await sendMagicLink(email, { redirectTo: '/dashboard' });

// Requires the host app's /api/auth/register endpoint
await registerWithCredentials({ name, email, password, referralCode });

const session = await getSession(); // AuthSession | null, retries transient 502/503/504 responses
await signOut({ redirectTo: '/login' });
const signedIn = await isAuthenticated();

// Requires the host app's own routes (see route table above)
await requestEmailVerification(email);
await verifyEmail(token, email);
await requestPasswordReset(email);
await resetPassword({ email, token, password });
await changePassword({ currentPassword, newPassword });
```

## React Hook

`useSession()` (from `@ottabase/auth/react`) is a Jotai-backed hook that syncs with
`GET /api/auth/session` on mount and persists the session to `localStorage`:

```typescript
import { useSession } from '@ottabase/auth/react';

function MyComponent() {
    const { session, user, isAuthenticated, isLoading, login, logout, updateUser, refreshSession } = useSession();

    if (!isAuthenticated) return <LoginPrompt />;
    return (
        <div>
            <h1>Welcome {user?.name}</h1>
            <button onClick={logout}>Sign Out</button>
        </div>
    );
}
```

## UI Components

Framework-agnostic React components built on `@ottabase/ui-shadcn` (`@ottabase/auth/components`).
They never depended on Auth.js and take plain callback props, so you wire them to
`@ottabase/auth/client` yourself.

```typescript
import { LoginForm, getLoginConfig } from '@ottabase/auth/components';
import { signInWithCredentials, signInWithProvider, sendMagicLink } from '@ottabase/auth/client';

// Auto-detect configured providers/methods from env vars
const config = getLoginConfig(process.env);

<LoginForm
    socialProviders={config.socialProviders}
    showCredentials={config.showCredentials}
    showMagicLink={config.showMagicLink}
    onSocialLogin={(id) => signInWithProvider(id)}
    onCredentialsLogin={({ email, password }) => signInWithCredentials({ email, password })}
    onMagicLinkSend={(email) => sendMagicLink(email)}
    title="Welcome back"
/>
```

Individual pieces are also exported: `CredentialsForm`, `MagicLinkForm`, `RegisterForm`,
`SocialLoginButtons` + `SocialLoginDivider`. Helper functions in the same subpath:

- `getConfiguredSocialProviders(env)` - social providers with credentials configured
- `isEmailProviderConfigured(env)` - true if the dev trap, SMTP, or Resend is configured
- `isCredentialsConfigured(env)` - true unless `AUTH_DISABLE_CREDENTIALS` is set
- `getLoginConfig(env)` - all of the above combined into one config object

## Environment Variables

| Variable                        | Required                       | Purpose                                                        |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `AUTH_SECRET`                    | Yes in production                | HMAC secret for session JWTs, CSRF tokens, OAuth state/PKCE cookies |
| `AUTH_URL` / `NEXTAUTH_URL`      | No                                | Frontend origin used for redirects (defaults to `http://127.0.0.1:3003`) |
| `AUTH_COOKIE_NAME`               | No                                | Overrides the session cookie name (default `ottabase.session-token`) |
| `AUTH_DISABLE_CREDENTIALS`       | No                                | `"true"`/`"1"` disables `POST /api/auth/callback/credentials`   |
| `AUTH_REQUIRE_EMAIL_VERIFIED`    | No                                | `"true"`/`"1"` rejects credentials sign-in for unverified users |
| `AUTH_SESSION_MAX_AGE`           | No                                | Session lifetime in seconds (default 30 days)                  |
| `AUTH_VERBOSE`                   | No                                | Reserved for verbose logging                                    |
| `GOOGLE_CLIENT_ID` / `_SECRET`   | For Google OAuth                  |                                                                 |
| `GITHUB_CLIENT_ID` / `_SECRET`   | For GitHub OAuth                  |                                                                 |
| `DISCORD_CLIENT_ID` / `_SECRET`  | For Discord OAuth                 |                                                                 |
| `AZURE_AD_CLIENT_ID` / `_SECRET` / `AZURE_AD_TENANT_ID` | For Azure AD OAuth |                                                    |
| `AUTH0_CLIENT_ID` / `_SECRET` / `AUTH0_ISSUER`          | For Auth0 OAuth     |                                                    |
| `EMAIL_RESEND_API_KEY`          | For Resend magic links            |                                                                 |
| `EMAIL_SERVER` / `EMAIL_FROM`   | For SMTP magic links               |                                                                 |
| `DEV_EMAIL_TRAP_ENABLED`        | For local dev email capture (needs `OBCF_KV`) |                                                  |

`AUTH_SECRET` is required whenever `ENVIRONMENT` is set to anything other than `development`,
`dev`, or `test` — `handleAuthRequest` throws otherwise. Outside production it falls back to an
insecure default and logs a warning.

## Architecture

```
@ottabase/auth
├── crypto.ts            Web Crypto primitives: PBKDF2 hashing, HMAC-SHA256, base64url, SHA-256
├── jwt.ts                Minimal HS256-only compact JWT (sign/verify)
├── cookies.ts            Cookie serialize/parse helpers
├── csrf.ts                Double-submit CSRF cookie pair + verification
├── session-store.ts      Session creation/verification, KV revocation registry
├── session.ts             Pure Session helpers (isAuthenticated, requireAuth, ...)
├── bootstrap.ts           First-user owner-role + personal-organization bootstrap
├── backend-handler.ts     handleAuthRequest router + credentials/OAuth/magic-link handlers
├── providers/
│   ├── oauth-client.ts    Generic Authorization-Code + PKCE client
│   ├── presets.ts         Google/GitHub/Discord/Azure AD/Auth0 endpoint + claim-mapping data
│   ├── email.ts           Magic-link senders (dev trap / Nodemailer / Resend)
│   └── types.ts           Shared provider types
├── client-api.ts          fetch-based frontend client
├── react-hooks.ts         useSession (Jotai-backed)
└── components/            Framework-agnostic login/register UI (shadcn/ui)
```

DB access goes through the existing OttaORM models (`User`, `Account`, `VerificationToken`,
`OrganizationMember` from `@ottabase/ottaorm/models`) — there is no hand-rolled adapter layer.
Every cryptographic primitive runs on `crypto.subtle`, which Cloudflare Workers implements
natively, so the package has no runtime dependency on Node crypto or any third-party crypto/JWT
library.

## License

MIT
