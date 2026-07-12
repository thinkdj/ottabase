# @ottabase/auth — agent notes

Dependency-free auth for Workers + D1: signed sessions (HS256), PBKDF2 passwords, OAuth2/OIDC, magic links. Full docs: ./README.md

## Use when

- Adding sign-in/session handling to an Ottabase Worker app: mount `handleAuthRequest` under `/api/auth/*`, read sessions server-side with `getSession`, use the client API / `useSession` / login components in React.
- NOT for non-Cloudflare runtimes (needs D1 + KV bindings), JWT algorithms beyond HS256, or IdP-hosted (redirect-to-third-party) auth flows.

## Imports

```ts
import { handleAuthRequest, getSession, hashPassword, verifyPassword, hashToken, revokeSession, revokeAllUserSessions, createSessionCookieForUser, bootstrapFirstUser, type AuthEnv, type CreateAuthConfigOptions } from '@ottabase/auth/backend';
import { isAuthenticated, requireAuth, getUserId, getUserEmail, hasVerifiedEmail, serializeSession, type Session } from '@ottabase/auth/session';
import { signInWithCredentials, signInWithProvider, sendMagicLink, registerWithCredentials, getSession, signOut, getCsrfToken, resetPassword, changePassword } from '@ottabase/auth/client';
import { autoConfigureProviders, getConfiguredProvider, resolveMagicLinkSender } from '@ottabase/auth/providers';
import { useSession, clearAuthSessionStorage, AUTH_STORAGE_KEY } from '@ottabase/auth/react';
import { LoginForm, RegisterForm, CredentialsForm, MagicLinkForm, SocialLoginButtons, getLoginConfig } from '@ottabase/auth/components';
```

## Canonical usage

Worker: mount handler + guard a route (fetch-handler style, no framework):

```ts
// /api/auth/* — csrf, session, credentials/OAuth/magic-link sign-in, sign-out
if (url.pathname.startsWith('/api/auth/')) {
    return handleAuthRequest(request, env, authOptions);
}

// any other route
const session = await getSession(request, env, authOptions);
if (!isAuthenticated(session)) {
    return errorResponse('Unauthorized', 401); // @ottabase/utils/http-errors
}
const userId = getUserId(session);
```

React:

```tsx
const { session, user, isAuthenticated, isLoading, logout } = useSession();
```

Client (SPA form handlers):

```ts
const result = await signInWithCredentials({ email, password });
const session = await getSession();
await signOut();
```

## Gotchas

- `OBCF_D1` and `OBCF_KV` bindings required. Without KV, session verification fails closed (`getSession` returns null) and session creation throws.
- `AUTH_SECRET` (16+ chars, 32+ recommended) is mandatory — a missing secret throws at runtime, even in dev. The insecure default is used only when ENVIRONMENT is an explicit dev value AND `AUTH_ALLOW_INSECURE_DEV_SECRET=true`.
- `handleAuthRequest` only owns csrf/session/signin/signout/callback. Register, password-reset, and verify-email routes are host-app-owned (see `apps/otta-web/worker/routes/auth.ts`) even though `@ottabase/auth/client` has helpers for them.
- OAuth sign-in with an email that already has a credentials account fails with `OAuthAccountNotLinked` — no auto-linking.
- Two `getSession`s: `/backend` reads the cookie server-side (Request + env); `/client` fetches `/api/auth/session` from the browser. Don't mix them up.
- `useSession({ skipAutoSync: true })` on pages that manage sync themselves (e.g. login page); default mounts a backend session sync.
- `/react` and `/components` need react + jotai peers (`catalog:`); backend/session/client/providers entries are UI-free and edge-safe (no Node-only APIs).
