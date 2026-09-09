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

- Permissions are `resource:action` strings. Server check: `hasPermission(context, 'invoice:refund')` /
  `checkPermission` / the `withRBAC(handler, { permissions, roles })` middleware (`@ottabase/rbac`).
- Gate routes on **permission + scope**, not on a role _name_ — role names are not trust.
- Browser gating is a UX hint only (fails closed while loading); the **server guard is the boundary**.

## Security context (get provenance right or it is a leak)

- Derive the `SecurityContext` **server-side from a verified session** (`getSession(request, env)` from
  `@ottabase/auth/backend`). OttaORM has no header→context helper on purpose.
- `appId` comes from server config (`getOttabaseConfig(env)`), never an `x-app-id` header. Same for any
  row-scoping/ownership column — take it from the resolved context.
- `x-org-id` is a _request_, not an answer: validate it against authoritative active membership; drop to `null` if not a
  member.
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
- Note: a reusable `<Require permission=…>` / `useRBAC()` React component is not yet shipped (the rbac React layer is a
  placeholder) — apps currently gate via their own `ProtectedRoute`. Check the app before assuming a component exists.

## Authoritative sources

`AGENTS.MD` → "Row-Level Security (RLS)", "Security Context", "Error & Logging Boundaries", the auth "METHODOLOGY" list.
`docs/RBAC_MULTI_TENANT_GUIDE.md`, `packages/rbac/README.md`, `packages/auth/README.md`. Full docs: `/llms-full.txt`.
