# Org / Member / RBAC Flow — Issue Tracker

Findings from scanning: Organization > Member > org-scoped custom roles, platform super-admin, and SaaS tenant org users flow.

---

## CRITICAL (runtime crash / security) — ✅ All Fixed

### C1 — `member.toJson()` called on a plain DB row → runtime crash ✅ Fixed
### C2 — `clearTenantRBAC` does not clean up custom roles on member removal ✅ Fixed
### C3 — Cross-tenant role assignment in `handleRBACUserRoleAssign` ✅ Fixed

---

## HIGH (incorrect behavior / security design gap) — ✅ All Fixed

### H1 — `syncTenantRBAC` does not revoke custom roles when member is suspended ✅ Fixed
**Files:** `packages/ottaorm/src/models/OrganizationMember.ts`

When a member is suspended (`setStatus(..., 'suspended', ...)`) or demoted, `syncTenantRBAC` only revoked the four default role assignments. Any custom roles were untouched.

**Fix:** On non-active status (suspended/invited), use the `UserRole.clearUserRoles()` bulk DELETE to remove ALL org-scoped roles (default + custom). On reactivation, only the base membership role is restored — custom roles must be re-granted explicitly by an admin.

---

### H2 — `viewer` role is missing from member-invite and member-update API validators ✅ Fixed

---

### H3 — Invite cleanup happens after email send; old invites not revoked on email failure ✅ Fixed
**File:** `apps/otta-web/worker/routes/admin-organization-invites.ts`

`revokePendingForEmailExcept` was called **after** the email send. If send failed, older pending invites for the same email remained active.

**Fix:** Call `revokePendingForEmailExcept` after insert but before email send. On send failure, delete the new invite row (already done). This ensures there is never more than one live invite token for the same (org, email) pair, regardless of send success.

---

### H4 — Non-atomic resend rollback can leave an invite permanently broken ✅ Fixed
**File:** `apps/otta-web/worker/routes/admin-organization-invites.ts`

If email send fails on resend and the rollback `updateById` also fails, the invite's `tokenHash` has been replaced but the old token is gone and the new token was never delivered.

**Fix:** Wrapped the rollback in a try/catch; logs a structured `ORG_INVITE_RESEND_ROLLBACK_FAILED` error with `inviteId`, `organizationId`, `sendError`, and `rollbackError` so an operator can identify and manually revoke.

---

## MEDIUM (missing validation / minor UX gaps) — ✅ All Fixed

### M1 — `handleRBACRoleUpdate` cannot rename a custom role ✅ Fixed
**File:** `apps/otta-web/worker/routes/rbac-roles.ts`

`PATCH /api/rbac/roles/:id` now accepts an optional `name` field. Renaming is subject to the same reserved-name (system role names) and per-org uniqueness constraints as role creation.

---

### M2 — `handleRBACRoleCreate` does not validate permission string format ✅ Fixed
**File:** `apps/otta-web/worker/routes/rbac-roles.ts`

Added `validatePermissions()` that requires `resource:action` format (colon-separated non-empty segments, wildcards allowed). Called on both create and update. Returns 400 `VALIDATION_ERROR` for malformed entries.

---

### M3 — Bootstrap owner-promote secret accepted via query parameter ✅ Fixed
**File:** `apps/otta-web/worker/routes/admin-owner.ts`

Removed `querySecret` branch. Secret is now only accepted via `X-Bootstrap-Secret` header or POST body — never in a URL that could be captured in access logs.

---

### M4 — `addMember` has no duplicate-membership guard at the model layer ✅ Fixed
**File:** `packages/ottaorm/src/models/OrganizationMember.ts`

`addMember` now calls `getMember` first and throws `MembershipError('MEMBER_ALREADY_EXISTS')` if a row already exists. `MembershipErrorCode` union extended to include `'MEMBER_ALREADY_EXISTS'`. `membershipErrorToResponse` in the route maps it to 409.

---

### M5 — Public invite-accept race condition ✅ Fixed
**File:** `apps/otta-web/worker/routes/org-invites-public.ts`

`addMember` now throws `MembershipError('MEMBER_ALREADY_EXISTS')` on concurrent duplicate inserts. The public accept handler catches that specific error and returns an idempotent success (`{ accepted: true, alreadyMember: true }`) instead of a 500.

---

### M6 — `handleRBACRolesList` 500 response body missing `code` field ✅ Fixed

### M7 — `OrganizationMember` `role` filter narrower than model enum ✅ Fixed

---

## LOW (docs / test coverage) — ✅ All Fixed

### L1 — Tests mask the `toJson` crash ✅ Fixed
### L2 — No test for cross-tenant role assignment guard ✅ Fixed

### L3 — README omits `viewer` from default roles list ✅ Fixed
**File:** `packages/rbac/README.md`

### L4 — No GET by ID endpoint for `/api/rbac/roles/:id` ✅ Fixed
Added `handleRBACRoleGet` in `rbac-roles.ts` and wired it in the router under GET `/api/rbac/roles/:id`. System roles are accessible to any authenticated admin; custom roles are only visible to admins within the owning organization (returns 404 for cross-org to avoid disclosure).
