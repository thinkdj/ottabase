# Auth Roadmap

## Purpose

This document defines the recommended direction for authentication and account security across the Ottabase monorepo.
It is written for a **Cloudflare-first**, **package-first**, **framework-reusable** codebase where auth must work well in
the template app today and remain reusable for future apps.

The goal is not to add every auth feature at once. The goal is to make `@ottabase/auth` the default foundation for
production SaaS apps built on Ottabase, with strong security defaults and minimal app-level glue code.

---

## Product Direction

Ottabase auth should be:

- **Secure by default** — strong password handling, session revocation, MFA, auditable auth flows
- **Cloudflare-native** — edge-compatible, Worker-safe, no Node-only assumptions in runtime code
- **Reusable across apps** — core logic belongs in `@ottabase/auth`, not duplicated in apps
- **Composable** — apps can enable only what they need without re-implementing auth primitives
- **Operationally practical** — local dev must work without third-party SaaS dependencies

---

## Current State

### Core auth already in place

- Auth.js v5 integration in `@ottabase/auth`
- D1-backed users, accounts, sessions, verification tokens, authenticators
- Credentials login, OAuth providers, and magic link email login
- Email verification and password reset
- Session refresh/versioning via KV
- Dev email trap support for local development

### Account security already in place

- In-app password change while signed in
- TOTP 2FA setup, enable, disable, and TOTP-aware credentials login
- Passkey enrollment and management using WebAuthn
- Passkey registration/auth endpoints and authenticator persistence
- GDPR-style user data export and account deletion UX in the template app

### Important architectural constraint

The best long-term design remains:

- **`packages/auth`**: reusable primitives, backend flows, adapters, client helpers, shared UI building blocks
- **app layer**: route wiring, app-specific policy, product UX, and branding

---

## What “Production-Ready” Means for Ottabase

For this repo, production-ready auth means:

1. A new SaaS app can ship with sane defaults without rebuilding auth
2. Security-sensitive flows are auditable and easy to reason about
3. Recovery paths exist for real users, not only happy-path demos
4. Tenant-aware and org-aware apps can safely apply auth state to authorization
5. The auth package remains small, understandable, and edge-compatible

---

## Guiding Principles

### 1. Keep auth primitives in `@ottabase/auth`

If a feature is broadly reusable, it should live in the package:

- sign-in and session flows
- step-up auth helpers
- factor verification helpers
- client API wrappers
- reusable security UI building blocks

### 2. Keep app UX in the app unless it is generic

The template app should demonstrate best-practice UX, but not every page needs to move into the package.

### 3. Prefer security hardening before auth surface expansion

Before adding more providers or identity features, finish hardening:

- recovery
- step-up auth
- auditability
- secrets handling
- device/session visibility

### 4. Avoid third-party SaaS requirements by default

Optional integrations are fine, but the default path should remain self-hostable and local-dev friendly.

---

## Recommended Roadmap

## Phase 1 — Hardening the current auth surface

**Goal:** make the already-implemented flows safe to rely on in a real SaaS app.

### 1.1 Encrypt MFA secrets at rest

- [ ] Encrypt `totpSecret` before storing it in D1
- [ ] Add a dedicated env key for MFA secret encryption
- [ ] Support secret rotation with a migration path
- [ ] Keep verification logic package-owned and edge-compatible

**Why this matters**

TOTP is implemented, but secret-at-rest protection should be treated as a first-class security requirement.

**Likely homes**

- `packages/auth`
- `apps/ottabase-template-app-tanstack/worker/lib`
- `packages/ottaorm/src/models/User.*`

### 1.2 Add recovery codes

- [ ] Generate single-use recovery codes during 2FA enablement
- [ ] Store them hashed, never plaintext after display
- [ ] Add regenerate flow that invalidates old codes
- [ ] Add UX for download/copy/print during enrollment

**Why this matters**

2FA without recovery is not production-complete.

### 1.3 Add step-up authentication primitives

- [ ] Define “recent authentication” concept for sensitive actions
- [ ] Require password / passkey / TOTP confirmation before critical mutations
- [ ] Add shared helper for routes that require step-up auth
- [ ] Use it for account deletion, email change, session revocation, and factor changes

**Why this matters**

Signed-in state alone is not sufficient for all sensitive actions.

### 1.4 Expand audit logging for auth/security events

- [ ] Log password changes
- [ ] Log MFA enable/disable
- [ ] Log passkey add/remove
- [ ] Log failed step-up attempts
- [ ] Log suspicious auth recovery activity

**Why this matters**

The repo already has audit infrastructure; auth events should participate in it consistently.

---

## Phase 2 — Finish account security UX

**Goal:** close the remaining “real SaaS account settings” gaps.

### 2.1 Session and device management

- [ ] Show current session plus other active sessions/devices
- [ ] Revoke individual sessions
- [ ] Revoke all other sessions
- [ ] Include last seen time, approximate location metadata when available, and auth method

### 2.2 Email change flow

- [ ] Allow changing email while signed in
- [ ] Require verification of new email before activation
- [ ] Optionally require recent auth / current password
- [ ] Preserve audit trail and safe rollback behavior

### 2.3 Linked account management

- [ ] Link OAuth providers from settings
- [ ] Unlink providers safely
- [ ] Prevent lockout when removing the last usable login method
- [ ] Make “usable sign-in methods” explicit in UI

### 2.4 Security notifications

- [ ] Email on password change
- [ ] Email on MFA enable/disable
- [ ] Email on new passkey enrollment
- [ ] Optional email on unusual sign-in or session revocation

---

## Phase 3 — Passkey-first and password-light UX

**Goal:** make passkeys a first-class sign-in path, not only a settings feature.

### 3.1 Add passkey-first login UX

- [ ] Add “Sign in with passkey” button on login page
- [ ] Support conditional mediation / autofill where browser support exists
- [ ] Make Windows Hello, Touch ID, and platform authenticators obvious to users
- [ ] Provide clear fallback to password + TOTP

### 3.2 Support passkey bootstrapping patterns

- [ ] After password login, encourage passkey enrollment
- [ ] After MFA setup, offer passkey as a lower-friction strong factor
- [ ] Add “make this device a sign-in device” UX where appropriate

### 3.3 Clarify factor strategy

Ottabase should explicitly define the intended model:

- password only
- password + TOTP
- password + passkey
- passkey-first/passwordless
- recovery-code fallback

That model should then drive package APIs and template UX.

---

## Phase 4 — Tenant-aware enterprise controls

**Goal:** support organizations and more advanced SaaS requirements without rebuilding auth foundations later.

### 4.1 Organization-aware auth policy

- [ ] Per-org auth policy toggles
- [ ] Require MFA for selected orgs or roles
- [ ] Allow org-level session duration and re-auth policy
- [ ] Allow org-level provider restrictions where needed

### 4.2 Invite and provisioning policy

- [ ] Better invite acceptance flows
- [ ] Safe join/claim rules for verified domains
- [ ] Owner/admin protections against self-lockout

### 4.3 Admin security controls

- [ ] Admin-managed MFA enforcement
- [ ] Session invalidation for org members
- [ ] Auth posture dashboard for owners/admins

---

## Phase 5 — Package polish and framework ergonomics

**Goal:** make `@ottabase/auth` easy to adopt across multiple Ottabase apps.

### 5.1 Package surface cleanup

- [ ] Document stable public APIs vs app-local glue
- [ ] Reduce coupling between package internals and template-app routes
- [ ] Move reusable security helpers out of app worker routes where appropriate

### 5.2 Reusable UI primitives

- [ ] Extract generic security settings blocks where beneficial
- [ ] Keep app-specific composition in the app
- [ ] Avoid over-packaging entire pages unless they are truly reusable

### 5.3 Stronger docs

- [ ] Update `packages/auth/README.md` with MFA/passkey flows
- [ ] Document recommended template-app auth setup
- [ ] Document recovery, step-up auth, and provider-linking patterns

---

## Recommended Priority Order

If only a limited amount of work can be done next, the order should be:

1. **Encrypt TOTP secrets at rest**
2. **Recovery codes**
3. **Step-up auth for sensitive actions**
4. **Session/device management**
5. **Passkey-first login button and autofill UX**
6. **Email change flow**
7. **Auth audit event expansion**
8. **Provider linking/unlinking**

This order gives the best balance of security, usability, and framework leverage.

---

## What Should Stay Out of Scope for Now

These are reasonable later, but should not outrank the phases above:

- SAML / enterprise federation
- SCIM provisioning
- external identity broker abstractions
- biometric risk scoring / anomaly detection
- fully custom auth engine replacing Auth.js

For Ottabase today, the best move is to make the current Auth.js-based foundation excellent before broadening scope.

---

## Success Criteria

Auth can be considered “framework-ready” when:

- [ ] A new Ottabase app can enable secure auth with minimal custom code
- [ ] MFA includes recovery and safe factor-management flows
- [ ] Sensitive actions support step-up auth
- [ ] Passkeys are first-class in both settings and sign-in
- [ ] Sessions/devices are visible and revocable
- [ ] Auth events are auditable
- [ ] Package docs reflect the real supported path

---

## Summary

The best path for this repo is **not** to add many more auth features immediately. The best path is to:

1. harden what already exists,
2. complete recovery and step-up flows,
3. make passkeys first-class,
4. add session/device visibility,
5. then package the result cleanly for reuse across apps.

That keeps Ottabase aligned with its architecture: **package-first, edge-compatible, secure by default, and practical for
real SaaS apps**.
