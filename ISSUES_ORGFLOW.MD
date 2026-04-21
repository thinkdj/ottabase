# Org / Member / RBAC Flow — Issue Tracker

Findings from scanning: Organization > Member > org-scoped custom roles, platform super-admin, and SaaS tenant org users flow.

---

## CRITICAL (runtime crash / security)

### C1 — `member.toJson()` called on a plain DB row → runtime crash
**File:** `apps/otta-web/worker/routes/admin-organization-members.ts:157`
```
return jsonResponse({ data: member.toJson() }, 201);
```
`OrganizationMember.addMember()` returns `OrganizationMemberType` (a plain Drizzle-inferred row), not an `OrganizationMember` model instance. Calling `.toJson()` on it will throw `TypeError: member.toJson is not a function` at runtime.
The unit test masks this because the mock provides a `toJson()` stub.
**Fix:** Return `member` directly (it's already a serializable plain object).

---

### C2 — `clearTenantRBAC` does not clean up custom roles on member removal
**File:** `packages/ottaorm/src/models/OrganizationMember.ts:414-423`

`clearTenantRBAC` (called by `removeMember`) iterates over `DEFAULT_ROLE_NAMES` (owner/admin/member/viewer) and removes only those four role assignments from `user_roles`. Custom roles assigned via `/api/rbac/user-roles` are **not** touched. A fully removed member retains any custom-role entries in `user_roles`, which means the RBAC cache can still resolve them and grant access until TTL expiry.
**Fix:** Instead of iterating default role names, query and delete ALL `user_roles` rows for `(userId, organizationId)`.

---

### C3 — Cross-tenant role assignment in `handleRBACUserRoleAssign`
**File:** `apps/otta-web/worker/routes/rbac-user-roles.ts:106-108`

The handler resolves the role by `roleId` using `Role.find(roleId)`, which returns any role in the database regardless of its `organizationId`. The `canAccessOrganization` check verifies the caller can access the _target_ org, but does **not** verify that the role being assigned belongs to that org (or is a system role). A tenant admin in org-A who discovers a custom role UUID from org-B could assign it to users in org-A, creating cross-org role references.
**Fix:** After fetching the role, assert `role.get('isSystem') || role.get('organizationId') === organizationId`; return 404 otherwise to avoid disclosing cross-org role existence.

---

## HIGH (incorrect behavior / security design gap)

### H1 — `syncTenantRBAC` does not revoke custom roles when member is suspended
**File:** `packages/ottaorm/src/models/OrganizationMember.ts:368-407`

When a member is suspended (`setStatus(..., 'suspended', ...)`) or demoted, `syncTenantRBAC` only revokes the four default role assignments and re-assigns the correct one (or none for non-active). Any extra custom roles granted via `/api/rbac/user-roles` are untouched. A suspended member who holds a custom `editor` role retains that permission in every RBAC check until the cache TTL expires and the custom `user_roles` entry is manually removed.
**Fix (recommended):** On suspend, remove all custom org-scoped roles in addition to the default revocation. On reactivation, only the base membership role is restored — custom roles must be re-granted explicitly. Alternatively, the permission checker should veto suspended members before role evaluation (architectural decision).

---

### H2 — `viewer` role is missing from member-invite and member-update API validators
**Files:**
- `apps/otta-web/worker/routes/admin-organization-members.ts:22-23` (`isValidRole`)
- `InviteMemberRequestBody.role` and `UpdateMemberRequestBody.role` type unions
- `OrganizationMember.fields.role` `formConfig.options`

`DEFAULT_ROLE_NAMES` includes `'viewer'`, but the route-level `isValidRole` guard (`'owner' | 'admin' | 'member'`) and the `formConfig.options` list omit it. Inviting or updating a member to `viewer` fails with a 400 validation error even though the model and DB fully support it.
**Fix:** Add `'viewer'` to `isValidRole`, the type unions, and the `formConfig.options`.

---

### H3 — Invite cleanup happens after email send; old invites are not revoked on email failure
**File:** `apps/otta-web/worker/routes/admin-organization-invites.ts:179-188`

`OrganizationInvite.revokePendingForEmailExcept` is called **after** the email is sent. If the email send fails, the newly inserted invite is deleted/revoked but `revokePendingForEmailExcept` is never called, leaving any older pending invites for the same email address active. The correct order is: insert → revoke older → send email. On send failure, delete the new invite and let the older ones remain (or accept the current behaviour of leaving duplicates).
**Fix:** Move `revokePendingForEmailExcept` to before the email send, after insert succeeds.

---

### H4 — Non-atomic resend rollback can leave an invite permanently broken
**File:** `apps/otta-web/worker/routes/admin-organization-invites.ts:317-325`

If email send fails on resend and the rollback `updateById` also fails, the invite's `tokenHash` has been replaced with a new one but the old token is gone and the new token was never delivered. The invite is stuck in `pending` with an undeliverable token. There is no re-try path.
**Fix:** Wrap the resend token rotation and rollback in a catch that also checks if the rollback succeeded; log a structured error if both fail so an operator can identify and manually revoke.

---

## MEDIUM (missing validation / minor UX gaps)

### M1 — `handleRBACRoleUpdate` cannot rename a custom role
**File:** `apps/otta-web/worker/routes/rbac-roles.ts:129-131`

`PATCH /api/rbac/roles/:id` only updates `description` and `permissions`. The `name` field is silently ignored. This is asymmetric with `POST` (which sets the name) and may frustrate operators who want to rename a role after creation.

---

### M2 — `handleRBACRoleCreate` does not validate permission string format
**File:** `apps/otta-web/worker/routes/rbac-roles.ts:100`

The `permissions` array items are stored as-is with no format validation. Invalid strings (e.g., `""`, `"nocolon"`, `"too:many:colons"`) can be persisted and will never match any real permission, silently granting nothing.

---

### M3 — Bootstrap owner-promote secret accepted via query parameter
**File:** `apps/otta-web/worker/routes/admin-owner.ts:26,40-41`

`/api/admin/owner/promote?secret=<value>` accepts the secret via query string, which is captured in Cloudflare access logs and Wrangler logs. Using the `X-Bootstrap-Secret` header or `POST` body is safer.
**Fix:** Remove the `querySecret` branch or document clearly that it should never be used in production.

---

### M4 — `addMember` has no duplicate-membership guard at the model layer
**File:** `packages/ottaorm/src/models/OrganizationMember.ts:197`

The duplicate check (member already exists) is done only at the route layer. `OrganizationMember.addMember` itself performs a raw INSERT without a prior existence check, so a concurrent duplicate request will surface as an opaque D1 UNIQUE constraint violation instead of a `MembershipError`. Downstream code that calls `addMember` directly must remember to guard against duplicates.

---

### M5 — Public invite-accept race condition
**File:** `apps/otta-web/worker/routes/org-invites-public.ts:180-203`

Between the `OrganizationMember.first()` existence check and the subsequent `addMember` call, a concurrent request (e.g., double-click) could insert the same member first. The second call hits a D1 UNIQUE constraint and surfaces as a generic `ORG_INVITE_ACCEPT_FAILED` (500) instead of an idempotent success. The invite token also remains `pending`.

---

### M6 — `handleRBACRolesList` 500 response body missing `code` field
**File:** `apps/otta-web/worker/routes/rbac-roles.ts:56-58`

```ts
return errorResponse('Failed to load roles', 500, {
    details: err instanceof Error ? err.message : 'Unknown error',
});
```
The error shape is missing the `code` property present in all other error responses in the codebase, making it harder for clients to handle this specific error programmatically.

---

### M7 — `OrganizationMember.countOrganizationMembers` `role` filter is narrower than model enum
**File:** `packages/ottaorm/src/models/OrganizationMember.ts:433`

`getOrganizationMembers` and `countOrganizationMembers` accept `role?: 'owner' | 'admin' | 'member'` — omitting `'viewer'`. Any future queries for viewer-role members via these helpers would require a type cast.

---

## LOW (docs / test coverage)

### L1 — Tests for `handleAdminOrganizationInviteMember` mask the `toJson` crash
**File:** `apps/otta-web/worker/routes/__tests__/admin-organization-members.test.ts:39-40`

The mock provides `toJson: () => ({...})` on the `addMember` return value, causing the test to pass while the production code crashes. After fixing C1, the test mock should be updated to remove the `toJson` stub.

### L2 — No test coverage for cross-tenant role assignment guard (C3)
Once C3 is fixed, a test should be added to `rbac-user-roles.test.ts` asserting that assigning a foreign-org role ID returns 404.

### L3 — README describes `Default roles: owner, admin, member`; omits `viewer`
**File:** `packages/rbac/README.md:33`

### L4 — No GET by ID endpoint for `/api/rbac/roles/:id`
The RBAC roles API exposes list/create/update/delete but no single-role lookup by ID, requiring callers to filter the full list.
