# Production-Ready Auth Implementation

## Architecture - Reusable Monorepo Structure

All core auth logic lives in the `@ottabase/auth` package, making it reusable across all apps in the monorepo. It is a
lightweight, dependency-free (Web Crypto only) implementation: signed session JWTs in an HttpOnly cookie, PBKDF2
password hashing, a generic OAuth2 + PKCE client, and magic-link email sign-in. There is no third-party auth framework
involved (no Auth.js/NextAuth) — sessions, CSRF, and OAuth state are all custom-built on `crypto.subtle`. Apps only
contain minimal glue code and app-specific overrides.

## Package Structure

### `@ottabase/auth` Package (Reusable)

```
packages/auth/src/
├── backend-handler.ts     # handleAuthRequest() Cloudflare Workers router + getSession re-exports
├── client-api.ts          # Frontend API client (framework-agnostic)
├── react-hooks.ts         # React session management hook (useSession)
├── session.ts             # Pure session helpers (isAuthenticated, requireAuth, getUserId, ...)
├── session-store.ts       # createSessionForUser / getSession / revokeSession / revokeAllUserSessions (KV-backed)
├── jwt.ts                 # Minimal HS256 JWT sign/verify
├── crypto.ts              # Web Crypto helpers: HMAC-SHA256, PBKDF2 password hashing
├── csrf.ts                # Double-submit CSRF cookie helpers
├── cookies.ts             # Cookie serialize/parse helpers
├── bootstrap.ts            # First-run platform-owner bootstrap helper
├── providers.ts            # Re-exports OAuth presets + resolveMagicLinkSender
├── providers/
│   ├── presets.ts         # Google/GitHub/Discord/Azure AD/Auth0 OAuth preset configs
│   ├── oauth-client.ts    # Generic OAuth2 Authorization-Code + PKCE (S256) client
│   ├── email.ts           # Magic-link senders (dev KV trap, SMTP/Nodemailer, Resend)
│   └── types.ts           # Provider config/env types
├── components/            # React UI components
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── SocialLoginButtons.tsx
│   ├── CredentialsForm.tsx
│   ├── MagicLinkForm.tsx
│   └── helpers.ts         # Auto-configuration helpers (getLoginConfig)
├── types.ts               # Shared types: Session, SessionUser, AuthEnv, CreateAuthConfigOptions, ...
└── index.ts               # Main exports
```

**Package Exports** (subpaths in `packages/auth/package.json`):

- `@ottabase/auth` - Main exports (providers, session utils, backend handler, client API, react hooks — re-exported)
- `@ottabase/auth/backend` - `handleAuthRequest`, `getSession`, `hashPassword`, `verifyPassword`,
  `createSessionCookieForUser`, `revokeSession`, `revokeAllUserSessions`, plus types `AuthEnv`,
  `CreateAuthConfigOptions`, `CredentialsAuthorizeOptions`, `AuthorizedUser`
- `@ottabase/auth/client` - Frontend API client: `signInWithCredentials`, `signInWithProvider`, `sendMagicLink`,
  `registerWithCredentials`, `getSession`, `signOut`, `isAuthenticated`, `getCsrfToken`, `requestEmailVerification`,
  `verifyEmail`, `requestPasswordReset`, `resetPassword`, `changePassword`
- `@ottabase/auth/react` - React hooks (`useSession`)
- `@ottabase/auth/components` - UI components (`LoginForm`, `RegisterForm`, `CredentialsForm`, `MagicLinkForm`,
  `SocialLoginButtons`, `getLoginConfig` helper)
- `@ottabase/auth/session` - Pure session helpers: `isAuthenticated`, `requireAuth`, `getUserId`, `getUserEmail`,
  `hasVerifiedEmail`, `serializeSession`
- `@ottabase/auth/providers` - OAuth presets (`createGoogleProvider`, `createGitHubProvider`, `createDiscordProvider`,
  `createAzureAdProvider`, `createAuth0Provider`, `autoConfigureProviders`, `getConfiguredProvider`) + magic-link
  senders (`resolveMagicLinkSender`, `createDevEmailTrapMagicLinkSender`, `createNodemailerMagicLinkSender`,
  `createResendMagicLinkSender`)

There is no `./adapter`, `./adapters/drizzle`, or `./config` subpath — DB access goes through the existing OttaORM
models (`User`, `Account`, `VerificationToken`, `OrganizationMember`) directly, and there is no NextAuth-style config
object.

### App (Minimal Glue Code)

```
apps/otta-web/
├── worker/routes/router.ts    # Routes /api/auth/* to handleAuthApiRequest / handleAuthRequest
├── worker/routes/auth.ts      # handleAuthApiRequest + routes the app owns directly (register, verify-email,
│                               # password reset/change, config, users/me)
├── worker/lib/auth-utils.ts   # getAuthOptions() builds CreateAuthConfigOptions (pages, hooks, session max age)
├── worker/bootstrap/routes.ts # First-run platform-owner wizard, calls createSessionCookieForUser directly
└── src/pages/                 # Login/Register pages use LoginForm/RegisterForm components + client API/hooks
```

## Usage Examples

### Backend (Cloudflare Worker)

**Out-of-the-box usage:**

```typescript
// worker/routes/router.ts
import { handleAuthRequest } from '@ottabase/auth/backend';

if (url.pathname.startsWith('/api/auth/')) {
    return handleAuthRequest(request, env);
}
```

`handleAuthRequest` is a small router covering every `/api/auth/*` sub-path not already owned by the host app:

| Route                            | Method | Behavior                                                                 |
| -------------------------------- | ------ | ------------------------------------------------------------------------ |
| `/api/auth/csrf`                 | GET    | Sets an HttpOnly CSRF cookie, returns `{ csrfToken }`                    |
| `/api/auth/session`              | GET    | Returns the current `Session` or `null`                                  |
| `/api/auth/callback/credentials` | POST   | `{ email, password, csrfToken }` → `{ success, session }` or `{ error }` |
| `/api/auth/signin/:provider`     | GET    | 302 redirect to the OAuth provider (PKCE + state)                        |
| `/api/auth/callback/:provider`   | GET    | Exchanges the OAuth code, creates a session, redirects to `callbackUrl`  |
| `/api/auth/signin/email`         | POST   | `{ email, csrfToken, callbackUrl }` → sends a magic link                 |
| `/api/auth/callback/email`       | GET    | Verifies the magic-link token, creates a session, redirects              |
| `/api/auth/signout`              | POST   | Revokes the current session only, clears the session cookie              |

Routes the app owns directly (not part of this package, live in `worker/routes/auth.ts`): `POST /api/auth/register`,
`GET/POST /api/auth/verify-email(/resend)`, `POST /api/auth/password/reset/request|confirm`,
`POST /api/auth/password/change`, `GET /api/auth/config`, `GET/PATCH /api/users/me`. These call
`hashPassword`/`verifyPassword`/`getSession` from `@ottabase/auth/backend` directly.

**With custom authorization and lifecycle hooks:**

```typescript
import { handleAuthRequest, verifyPassword } from '@ottabase/auth/backend';

if (url.pathname.startsWith('/api/auth/')) {
    return handleAuthRequest(request, env, {
        authorize: async ({ email, password }) => {
            // Your custom database query
            const user = await db.query.users.findFirst({
                where: eq(users.email, email),
            });

            if (!user || !(await verifyPassword(password, user.passwordHash))) {
                return null;
            }

            return { id: user.id, email: user.email, name: user.name };
        },
        // Called right after a session is created (credentials/OAuth/magic-link sign-in)
        onSignIn: async ({ userId, email }) => {
            /* e.g. activate pending org/group invites */
        },
        // Called after a user signs out (session revoked)
        onSignOut: async (userId) => {
            /* e.g. clear app-level caches */
        },
    });
}
```

### Frontend (React)

**Session management:**

```typescript
import { useSession } from "@ottabase/auth/react";

function MyComponent() {
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return (
    <div>
      <h1>Welcome {user.name}</h1>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

**Login implementation:**

```typescript
import { signInWithCredentials, signInWithProvider } from "@ottabase/auth/client";
import { LoginForm, getLoginConfig } from "@ottabase/auth/components";

function LoginPage() {
  const config = getLoginConfig(import.meta.env);

  return (
    <LoginForm
      socialProviders={config.socialProviders}
      showCredentials={config.showCredentials}
      showMagicLink={config.showMagicLink}
      onSocialLogin={(id) => signInWithProvider(id)}
      onCredentialsLogin={({ email, password }) =>
        signInWithCredentials({ email, password })
      }
    />
  );
}
```

## Configuration

### Auto-Configuration

The auth system automatically detects and enables OAuth providers based on environment variables (via
`autoConfigureProviders(env)` / `getConfiguredProvider(id, env)`):

```bash
# Set these in wrangler.jsonc or .env
AUTH_SECRET=your-secret         # required in production; signs session JWTs, CSRF tokens, OAuth state/PKCE cookies
AUTH_URL=https://your-app.example.com   # frontend origin for redirects + OAuth redirect_uri
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_ISSUER=...
EMAIL_RESEND_API_KEY=...        # Magic link via Resend
EMAIL_SERVER=...                # Magic link via SMTP (@ottabase/email Nodemailer mailer)
EMAIL_FROM=...
DEV_EMAIL_TRAP_ENABLED=true     # Local dev catch-all inbox (KV-backed), highest priority when enabled
```

Magic-link sender priority (`resolveMagicLinkSender(env)`): local KV dev-email-trap (if `DEV_EMAIL_TRAP_ENABLED`) → SMTP
via `@ottabase/email`'s Nodemailer mailer → Resend. Magic-link sign-in links are short-lived (15 minutes), distinct from
the app's own 24h email-verification links.

The package will:

- Enable only OAuth providers that have their required env vars set (Google/GitHub/Discord/Azure AD/Auth0)
- Auto-configure UI components (`getLoginConfig`) to show only what's enabled
- Work with zero configuration (credentials only)

Other env vars: `AUTH_COOKIE_NAME` (default `ottabase.session-token`), `AUTH_DISABLE_CREDENTIALS`,
`AUTH_REQUIRE_EMAIL_VERIFIED`, `AUTH_SESSION_MAX_AGE`.

### App-Specific Overrides

Apps can override behavior by passing a `CreateAuthConfigOptions` object to `handleAuthRequest` / `getSession`:

```typescript
handleAuthRequest(request, env, {
    // Custom authorization
    authorize: async (credentials) => {
        /* ... */
    },

    // Session duration (seconds)
    sessionMaxAge: 7 * 24 * 60 * 60, // 7 days

    // Disable credentials sign-in / require verified email
    disableCredentials: false,
    requireVerifiedEmail: false,

    // Verbose logging
    verbose: true,

    // Where to send users for sign-in / OAuth errors
    authConfig: {
        pages: {
            signIn: '/custom-login',
            error: '/custom-login',
        },
    },

    // Lifecycle hooks
    onSignIn: async ({ userId, email }) => {
        /* ... */
    },
    onSignOut: async (userId) => {
        /* ... */
    },
});
```

`authConfig.pages` is the entire shape — just `signIn` and `error` paths used for OAuth error redirects and (by
convention) the app's login route. There is no broader Auth.js-style config object.

## Features

### Implemented

1. **Backend Handler** (`@ottabase/auth/backend`)
    - Plug-and-play Cloudflare Workers integration (`handleAuthRequest`)
    - Auto-configuration from env vars
    - Customizable authorization + sign-in/sign-out hooks
    - Signed HS256 session JWTs (identity claims only; roles/permissions live in a per-session KV registry snapshot, not
      the cookie) in an HttpOnly/Secure/SameSite=Lax cookie. Revocation is a deny-list: sign-out writes a per-jti
      tombstone (honored even within the KV propagation grace window), and a bulk "revoked since &lt;ms&gt;" KV key
      backs password change/reset, invalidating every earlier session for a user
    - Double-submit CSRF cookie + Origin allowlist for all state-changing endpoints

2. **Client API** (`@ottabase/auth/client`)
    - Framework-agnostic (works with any frontend)
    - Type-safe API calls
    - Credentials, OAuth, Magic Link support

3. **React Hooks** (`@ottabase/auth/react`)
    - `useSession()` with auto-sync
    - LocalStorage persistence
    - Loading states
    - Session refresh

4. **UI Components** (`@ottabase/auth/components`)
    - `LoginForm` - Unified login interface
    - `RegisterForm` - Registration
    - `SocialLoginButtons` - OAuth providers
    - `CredentialsForm` - Email/password
    - `MagicLinkForm` - Passwordless
    - Auto-configuration helpers (`getLoginConfig`)

5. **Provider Support**
    - Credentials (email/password, PBKDF2-SHA256 hashing, 100k iterations)
    - Google OAuth
    - GitHub OAuth
    - Discord OAuth
    - Azure AD OAuth
    - Auth0
    - Magic Link (Resend)
    - Magic Link (SMTP/Nodemailer)
    - Magic Link (Catch-all mail trap using local KV, dev only)

All OAuth providers use a single generic Authorization-Code + PKCE (S256) client (`providers/oauth-client.ts`); each
provider is just endpoint/scope/claim-mapping data in `providers/presets.ts`.

## Benefits of This Architecture

### For the Package

- Reusable across all apps
- Single source of truth
- No third-party auth dependency to track or patch (Web Crypto only)
- Easy to maintain and update
- Well-tested and production-ready
- Framework-agnostic core

### For Apps

- Minimal boilerplate (just import and use)
- Can override anything when needed
- Automatic updates from package
- Consistent auth across apps
- Zero configuration to get started

### For the Monorepo

- DRY (Don't Repeat Yourself)
- Consistent patterns
- Easier onboarding
- Centralized improvements
- Production-quality baseline

## Next Steps

1. **Build the auth package:**

    ```bash
    cd packages/auth
    pnpm build
    ```

2. **Install dependencies in app:**

    ```bash
    cd apps/otta-web
    pnpm install
    ```

3. **Configure environment:**
    - Copy `.env.example` to `.env.local`
    - Set `AUTH_SECRET` (required in production)
    - Add OAuth provider credentials (optional)

4. **Run the app:**

    ```bash
    pnpm dev
    ```

5. **Test authentication:**
    - Visit `/login`
    - See auto-configured providers
    - (Development only) Use the built-in credentials login to verify the flow locally. **Do not use the default
      credentials handler in production** — you must implement a real `authorize` callback backed by your user store
      before deploying.

## Summary

**What's in the Package:**

- Backend request handler (session JWTs, CSRF, OAuth+PKCE, magic links, PBKDF2 credentials)
- Client API
- React hooks
- UI components
- Auto-configuration
- Provider helpers
- Session utilities

**What's in the App:**

- Simple imports
- Optional overrides (`CreateAuthConfigOptions`)
- Environment config
- The few routes the app still owns directly (register, verify-email, password reset/change, config, users/me)

**Result:** Production-ready, dependency-free auth that works out-of-the-box, but can be customized for any app-specific
requirements. Perfect for a reusable monorepo!
