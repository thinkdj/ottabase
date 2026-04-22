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

### ✅ N1 — Fixed: RBAC custom roles now require active organization membership

**Files:**

- `apps/otta-web/worker/routes/rbac-user-roles.ts`
- `apps/otta-web/worker/routes/__tests__/rbac-user-roles.test.ts`

`/api/rbac/user-roles` now enforces active org membership for list/assign/remove operations and rejects system-role
mutation via this custom-role endpoint (`SYSTEM_ROLE_ASSIGNMENT_FORBIDDEN`).

---

### ✅ N2 — Fixed: cached role rehydration resolves with organization scope

**Files:**

- `packages/ottaorm/src/models/User.ts`

`User.roles(...)` cache-hit rehydration now resolves with org scope (`Role.findByName(roleName, organizationId)`), so
org-custom roles are not dropped on warm-cache requests.

---

### ✅ N3 — Fixed: `addMember` maps DB unique races to typed membership error

**Files:**

- `packages/ottaorm/src/models/OrganizationMember.ts`
- `packages/ottaorm/src/models/__tests__/OrganizationMember.lifecycle.test.ts`

Concurrent insert races are now normalized to `MembershipError('MEMBER_ALREADY_EXISTS')`, preventing raw DB UNIQUE
violations from surfacing as opaque 500s.

---

### ✅ N4 — Fixed: `viewer` role is now consistent across invite + UI flows

**Files:**

- `apps/otta-web/worker/routes/admin-organization-invites.ts`
- `apps/otta-web/worker/routes/org-invites-public.ts`
- `apps/otta-web/src/types/rbac.ts`
- `apps/otta-web/src/pages/admin/access/organizations/components/InviteMemberForm.tsx`
- `apps/otta-web/src/pages/admin/access/organizations/OrganizationMembersPage.tsx`
- `apps/otta-web/src/pages/admin/access/users/UserRBACPage.tsx`
- `apps/otta-web/worker/routes/__tests__/admin-organization-invites.test.ts`

Backend invite validation and admin UI role unions/select options now include `viewer` end-to-end.

---

### ✅ N5 — Fixed: RBAC role create/update now guard malformed JSON

**Files:**

- `apps/otta-web/worker/routes/rbac-roles.ts`
- `apps/otta-web/worker/routes/__tests__/rbac-roles.test.ts`

`handleRBACRoleCreate` and `handleRBACRoleUpdate` now return structured `400 BAD_REQUEST` for invalid JSON payloads.

---

## Current status

- No open issues from this N1–N5 re-scan set remain.
- Targeted regression tests were added/updated and passing for touched org/tenant/member flow surfaces.
