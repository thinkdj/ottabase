# Org / Member / RBAC Flow — Issue Tracker (Latest Re-scan)

Fresh audit scope:
- tenant/org membership lifecycle
- org invite (admin + public accept)
- RBAC role + user-role assignment paths
- request-context + permission evaluation chain
- current admin UI wiring for member roles

---

## Previously fixed set (still verified as fixed)

- C1 `member.toJson()` crash on plain row
- C2 `clearTenantRBAC` now removes all roles on member removal
- C3 cross-tenant role assignment guard in `handleRBACUserRoleAssign`
- H1 suspend/deactivate now revokes custom roles
- H2 viewer support added for member invite/update APIs
- H3 invite duplicate cleanup moved before email send
- H4 resend rollback now logs double-failure condition
- M1 role rename support in `PATCH /api/rbac/roles/:id`
- M2 permission format validation in role create/update
- M3 bootstrap owner secret no longer accepted in query params
- M4 model-layer duplicate guard in `OrganizationMember.addMember`
- M5 public accept handles `MEMBER_ALREADY_EXISTS` idempotently
- M6 roles list 500 now includes error `code`
- M7 viewer role filter parity in OrganizationMember helpers
- L1/L2/L3/L4 prior test/docs/endpoint gaps

---

## NEW / STILL-OPEN Findings (from latest state)

## CRITICAL

### N1 — RBAC custom roles can be assigned to users with no active org membership
**Files:**
- `apps/otta-web/worker/routes/rbac-user-roles.ts`
- `packages/rbac/src/request-context.ts`
- `packages/rbac/src/admin-guard.ts`
- `apps/otta-web/worker/routes/rbac-roles.ts`

`handleRBACUserRoleAssign` validates caller access + role ownership but does **not** verify that target `userId` is an active member of `organizationId`.

Because request context permissions come from `user_roles` for the scoped org, a non-member user can still receive org-scoped permissions if an admin assigns a role directly. This is especially dangerous because custom roles currently allow `*:*` permissions, and `assertAdmin` treats `*:*` as admin-equivalent.

**Recommended fix:** enforce `OrganizationMember.first({ userId, organizationId, status: 'active' })` (or equivalent model helper) before assign/list/remove custom org roles; reject otherwise.

---

## HIGH

### N2 — Cached role-name rehydration drops org-custom roles
**File:** `packages/ottaorm/src/models/User.ts`

In `User.roles(...)`, cache-hit path fetches cached role names, then resolves each via `Role.findByName(roleName)` **without organization scope**.

For org-custom roles (e.g., `editor`), `findByName` without org only checks system roles and returns null; custom role permissions disappear on cache-hit requests.

**Impact:** intermittent permission loss / inconsistent authorization behavior between cold and warm cache paths.

**Recommended fix:** resolve cached roles by `(name, organizationId)` or cache role IDs and resolve by ID.

---

### N3 — `addMember` race can still throw raw DB UNIQUE errors (not mapped)
**Files:**
- `packages/ottaorm/src/models/OrganizationMember.ts`
- `apps/otta-web/worker/routes/org-invites-public.ts`
- `apps/otta-web/worker/routes/admin-organization-members.ts`

`addMember` has a pre-insert duplicate check, but concurrent calls can still pass the check and race on INSERT.

Current handlers only map `MembershipError('MEMBER_ALREADY_EXISTS')`; a raw UNIQUE violation can still bubble up as 500.

**Recommended fix:** catch unique-constraint insert errors inside `addMember` and rethrow `MembershipError('MEMBER_ALREADY_EXISTS')` so all callers get consistent idempotent handling.

---

## MEDIUM

### N4 — `viewer` role remains inconsistent across invite/UI flows
**Files:**
- `apps/otta-web/worker/routes/admin-organization-invites.ts`
- `apps/otta-web/worker/routes/org-invites-public.ts`
- `apps/otta-web/src/types/rbac.ts`
- `apps/otta-web/src/pages/admin/access/organizations/components/InviteMemberForm.tsx`
- `apps/otta-web/src/pages/admin/access/organizations/OrganizationMembersPage.tsx`

Model + member-admin APIs now support `viewer`, but:
- email invite create validation still allows only owner/admin/member,
- frontend `MemberRole` excludes `viewer`,
- role selects in member pages/forms also exclude `viewer`.

**Impact:** admins cannot consistently assign/invite `viewer` through current UI/email flows.

**Recommended fix:** make role unions/options consistent end-to-end with backend membership enum.

---

## LOW

### N5 — RBAC role create/update still lacks invalid-JSON body guard
**File:** `apps/otta-web/worker/routes/rbac-roles.ts`

`handleRBACRoleCreate` and `handleRBACRoleUpdate` call `await request.json()` without local try/catch; malformed JSON currently surfaces as generic 500 instead of structured 400 `BAD_REQUEST`.

**Recommended fix:** add JSON parse guard similar to other routes.

---

## Suggested immediate assessment order
1. N1 (security boundary bypass)
2. N2 (authorization correctness drift)
3. N3 (idempotency + 500 race)
4. N4 (role-model consistency)
5. N5 (error-shape consistency)
