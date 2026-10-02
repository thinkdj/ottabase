---
name: ottabase-rbac
description:
    The Ottabase way to check permissions and keep multi-tenant isolation — RBAC + RLS security context. Use for "gate
    this route/feature", "check permission", "admin-only", "restrict by role", "tenant scoping", or any authorization
    work. Getting the security context wrong is a tenant leak, so this encodes the fail-closed rules.
---

# RBAC + RLS the Ottabase way

Two layers cooperate: **RBAC** answers "may this caller do this action?"; **RLS** answers "which rows exist for this
caller?". Never bypass either.

## Permission checks

- Permissions are `resource:action` strings. Grants are **org-scoped**: every role API needs an `organizationId`
  (`user.hasPermission(perm, { organizationId })`, `user.assignRole(roleId, assignedBy, organizationId)`) and throws
  without one. Platform authority = grants in org `'system'`.
- App worker routes: `requireAdminAccess(context, { scope: 'system' | 'organization' | 'either' })` from
  `worker/lib/admin-guard.ts`; it returns a `Response` to short-circuit on. Platform gates read `systemPermissions`
  (`isPlatformAdmin`), org gates `org:admin` (`isOrgAdmin`).
- Package-level: `hasPermission(ctx, perm)` / `hasRole` return **booleans**; `evaluatePermission` / `evaluateRole`
  return `{ allowed, reason, missing… }` (always truthy — never put it in an `if`).
  `withRBAC(handler, { permissions, roles, getUserFromRequest, getOrganizationId })` requires both getters — no getter →
  401, no org → nothing granted.
- Gate routes on **permission + scope**, not on a role _name_ — role names are not trust.
- Browser gating is a UX hint only (fails closed while loading); the **server guard is the boundary**.

## Security context (get provenance right or it is a leak)

- Derive the `SecurityContext` **server-side from a verified session** (`getSession(request, env)` from
  `@ottabase/auth/backend`). OttaORM has no header→context helper on purpose.
- `appId` comes from server config (`getOttabaseConfig(env)`), never an `x-app-id` header. Same for any
  row-scoping/ownership column — take it from the resolved context.
- `x-org-id` is a _request_, not an answer: validate it against authoritative active membership; drop to `null` if not a
  member. The `'system'` scope is honoured only for holders of a system grant; anonymous callers always get a `null`
  org. Use the app's `getSecurityContext` (`worker/lib/auth-utils.ts`) — never assemble one by hand.
- **Fail closed**: if membership can't be resolved, return `503 SECURITY_CONTEXT_UNAVAILABLE`. A cache miss/malformed
  value must never change the authorization outcome. An unknown membership list is never "no restrictions".
- `initRLS()` must run at app init. Rules: `tenant` (matching `organizationId`), `user`, `app`. `platformAdmin` does
  **not** bypass tenant filters.

## Making a permission/role change take effect on live sessions

Role-definition and membership changes must both (a) invalidate the RBAC + membership caches and (b) bump each affected
user's `profile:version` (`bumpProfileVersion`) so `getSession` re-reads the snapshot. A role-definition change affects
many users — enumerate holders (`UserRole.where({ roleId })`) and bump each.

## Gotchas

- Authorization denials say nothing: unauthenticated → generic 401, authenticated → generic 403. Never leak policy text,
  attempted data, or the model registry.
- `@ottabase/rbac` has no React layer. Gate pages with the app's `ProtectedRoute` (`requirePlatformAdmin` or
  `requiredPermissions={['org:admin']}`).
- Never edit grants through generic CRUD: `user_roles` is blocked from `/api/ottaorm/*`, and `UserRole`'s static
  `update`/`delete` throw (composite key). Use `User.assignRole` / `UserRole.removeRole` with an org.
- Direct model calls are not RLS-filtered; only the secure CRUD path is. Scope server-side queries yourself.

## Authoritative sources

`AGENTS.MD` → "Row-Level Security (RLS)", "Security Context", "Error & Logging Boundaries", the auth "METHODOLOGY" list.
`docs/RBAC_MULTI_TENANT_GUIDE.md`, `packages/rbac/README.md`, `packages/auth/README.md`. Full docs: `/llms-full.txt`.
