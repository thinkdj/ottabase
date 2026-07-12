# Auth & Sessions — Agent Runbook

> Deep guidance for `@ottabase/auth`. Read this before touching sessions, login, or any user-profile
> mutation. Quick reference lives in `packages/auth/AGENTS.md`.

Lightweight in-house auth (no Auth.js/NextAuth). Web-Crypto only: signed session-cookie JWT + PBKDF2
credentials + generic OAuth2/OIDC + magic links. Config is env-driven (`AUTH_SECRET`, `AUTH_URL`,
`AUTH_*`); there is no `AuthConfig` object to build.

## Session data model (MUST understand before touching sessions)

A session is TWO parts:

1. **Signed JWT cookie** (`getSession` verifies it) — carries immutable identity + a display snapshot
   at issue time. It is NOT re-signed until the user logs in again, so its `name`/`image` copies go
   stale after a profile edit.
2. **KV registry snapshot** (`ottabase.session-token` → KV, per `jti`) — the MUTABLE half. It holds
   org/roles/permissions AND the mutable display fields (name/image/emailVerified), and is re-read
   from D1 whenever the per-user `profile:version` KV counter is bumped. `getSession` prefers the
   snapshot over the JWT for these fields (see `buildUser`), so mutations reflect on the next request
   without re-issuing the cookie.

## Backend

`getSession(request, env)` is globally usable from any worker route (import from
`@ottabase/auth/backend`); it fails closed without KV. Read identity via
`session.user.{id,email,name,image,organizationId,roles,permissions}`.

```typescript
import { getSession } from '@ottabase/auth/backend';
const session = await getSession(request, env);
if (!session) return errorResponse('Unauthorized', 401);
```

## Client

`useSession()` is the single global source of truth (module-level Jotai atoms, shared by every
caller; the app wraps it in `@/lib/auth` to also sync `@ottabase/state`). Import `useSession` from
`@/lib/auth` in app code. Never keep a private copy of `user` — read it from the hook so the header
(`UserSection`), guards, and every consumer re-render together.

```typescript
const { user, isAuthenticated, updateUser, refreshSession, logout } = useSession();
```

## METHODOLOGY — making a mutated user field reflect everywhere (do ALL of these)

1. **Server field plumbing:** the field must live in the KV snapshot path — add it to
   `RegistrySnapshot`, `UserContext`, `loadUserContext`, `parseSnapshot`, and `buildUser` in
   `packages/auth/src/session-store.ts` (org/roles/perms/name/image/emailVerified already are).
   JWT-only fields will NOT refresh.
2. **Bump the version on write:** the mutating endpoint MUST bump the TARGET user's profile version
   so `getSession` re-reads the snapshot — call the shared helper `bumpProfileVersion(env, userId)`
   from `worker/lib/auth-utils.ts` (do NOT hand-roll the KV write). A DB write WITHOUT a version bump
   is invisible to live sessions until the cookie JWT expires (up to `AUTH_SESSION_MAX_AGE`,
   ~30 days). Examples: `PATCH /api/users/me`, email verification, and admin membership changes all
   bump it. Role-DEFINITION changes affect MANY users: enumerate holders
   (`UserRole.where({ roleId })`) and bump each (see `admin-roles.ts`).
3. **Client refresh:** after the mutating request resolves, call `updateUser({ field })` for instant
   optimistic UI AND `refreshSession()` to reconcile from the server. Both go through the hook, so
   all `useSession()` consumers (top-right name/avatar, etc.) update. Do not
   `window.location.reload()`. Note: `refreshSession()` REPLACES the session from the server, so a
   client-only field not in the snapshot (e.g. `timezone`) must be re-applied via `updateUser` after
   the refresh.
4. **Membership/permission changes** additionally invalidate the RBAC + membership caches
   (`invalidateMembershipCache`, `rbac:` prefix) — see `worker/lib/auth-utils.ts`. Do BOTH the cache
   invalidation AND the profile-version bump: the caches gate the request-context path, the version
   bump gates the session-snapshot path.
