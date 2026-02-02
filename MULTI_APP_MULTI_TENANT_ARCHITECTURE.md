# Multi-App & Multi-Tenant Architecture Analysis

**Date:** 2026-02-02
**Status:** Architecture Review
**Priority:** Critical - Security & Data Isolation

---

## Executive Summary

Your Ottabase monorepo currently uses **two distinct isolation dimensions**:

1. **`appId`** - Isolates data between different applications (web, admin, api) sharing one database
2. **`organizationId`** / **`tenantId`** - Isolates data between different customers/organizations within an app

**Current State:** These two dimensions exist but are **incompletely integrated**, creating security gaps and architectural inconsistencies.

**Key Finding:** RBAC cache keys are NOT tenant-scoped (P0 security vulnerability)

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [How appId Works](#how-appid-works)
3. [How organizationId Works](#how-organizationid-works)
4. [Critical Issues](#critical-issues)
5. [How They Should Coexist](#how-they-should-coexist)
6. [Recommended Architecture](#recommended-architecture)
7. [Implementation Plan](#implementation-plan)

---

## Current Architecture

### The Two Dimensions

```
┌─────────────────────────────────────────────────────────┐
│                    Single Database                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  App Dimension (appId):                                  │
│  ├─ Web App (appId: "web")                              │
│  ├─ Admin Dashboard (appId: "admin")                    │
│  └─ API Service (appId: "api")                          │
│                                                           │
│  Tenant Dimension (organizationId):                      │
│  ├─ Customer A (orgId: "org-acme")                      │
│  ├─ Customer B (orgId: "org-startup")                   │
│  └─ Customer C (orgId: "org-enterprise")                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Design Intent

**appId:** You're a solo founder building multiple apps that share infrastructure:
- Same database for all apps
- Shared users across apps
- Feature packages (shortlinks, blog, referrals) can be app-specific

**organizationId:** Standard B2B SaaS multi-tenancy:
- Each customer is an organization
- Users belong to organizations
- Permissions scoped to organizations
- Audit logs per organization

---

## How appId Works

### Definition & Configuration

**Location:** `packages/config/src/types.ts`
```typescript
interface AppConfig {
    appId: string;  // Unique app identifier for multi-app database sharing
    // ...
}

// Default: 'ottabase-template-app'
```

### Where appId Is Used

#### 1. Feature Models (Optional Scoping)

**Shortlinks** (`packages/shortlinks/src/ottaorm-models/Shortlink.schema.ts`):
```typescript
export const shortlinksTable = sqliteTable('shortlinks', {
    id: text('id').primaryKey(),
    appId: text('app_id'),  // NULL = shared across all apps
    code: text('code').notNull().unique(),
    targetUrl: text('target_url').notNull(),
    // ...
});

// Usage:
const link = await Shortlink.findByCode(code, { appId: 'web' });
```

**Blog Models** (`packages/ottablog/src/ottaorm-models/*.ts`):
```typescript
// Post, PostCategory, PostTag, PostSeries all have:
appId: text('app_id'),  // Blog content scoped by app

// Query by app:
const posts = await Post.where({ appId: 'blog' });
```

**Referral Tracking** (`packages/referrals/src/ottaorm-models/ReferralTracking.schema.ts`):
```typescript
appId: text('app_id'),  // With index for performance
```

#### 2. Where appId Is NOT Used

❌ **Core Models:**
- User model - NO appId field
- Role model - NO appId field
- Permission model - NO appId field
- AuditLog model - NO appId field
- UserRole junction table - NO appId field

❌ **Connection Registry:**
- Database connections identified by name ("default", "analytics")
- No connection-per-app isolation

❌ **RBAC System:**
- Roles and permissions are NOT app-scoped
- Cache keys do NOT include appId

### appId Design Pattern

**Philosophy:** "Opt-in app isolation at the feature level"

```typescript
// Pattern 1: Shared data (NULL appId)
const sharedShortlink = await Shortlink.create({
    code: 'promo2024',
    appId: null,  // Available to all apps
    targetUrl: 'https://example.com/promo'
});

// Pattern 2: App-specific data
const webShortlink = await Shortlink.create({
    code: 'web-only',
    appId: 'web',  // Only visible in web app
    targetUrl: 'https://example.com/web'
});

// Pattern 3: Query with app filter
const webLinks = await Shortlink.where({ appId: 'web' });
```

**Key Characteristic:** Manual filtering required - NOT automatic scoping

---

## How organizationId Works

### Definition & Usage

**Location:** `packages/rbac/src/types.ts`, `packages/audit/src/types.ts`
```typescript
interface RBACContext {
    user: User | null;
    roles: string[];
    permissions: string[];
    isAuthenticated: boolean;
    organizationId?: string;  // Organization/tenant context
    tenantId?: string;        // Alternative identifier
}

interface AuditLogData {
    userId?: string;
    organizationId?: string;  // Organization context
    action: string;
    resourceType: string;
    // ...
}
```

### Where organizationId Is Used

#### 1. RBAC System (Multi-Tenant Permissions)

**UserRole Junction Table** (`packages/ottaorm/src/models/UserRole.schema.ts`):
```typescript
export const userRolesTable = sqliteTable('user_roles', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    roleId: text('role_id').notNull(),
    organizationId: text('organization_id'),  // ✅ Tenant scoping
    assignedBy: text('assigned_by'),
    assignedAt: integer('assigned_at', { mode: 'timestamp' }),
});

// Usage:
const hasRole = await UserRole.hasRole(userId, roleId, 'org-acme');
const orgRoles = await UserRole.getUserRoles(userId, 'org-acme');
```

**User RBAC Methods** (`packages/ottaorm/src/models/User.ts`):
```typescript
// All RBAC methods accept organizationId parameter:
async assignRole(roleId, assignedBy?, organizationId?, options?)
async removeRole(roleId, organizationId?, options?)
async hasRole(roleName, organizationId?)
async hasPermission(permission, { cache?, organizationId? })
async roles({ cache?, organizationId? })
async getPermissions({ cache?, organizationId? })

// Example:
const canEdit = await user.hasPermission('posts:edit', {
    cache: rbacCache,
    organizationId: 'org-acme'  // Only check permissions in this org
});
```

#### 2. Audit Logging (Multi-Tenant Audit Trails)

**AuditLog Model** (`packages/ottaorm/src/models/AuditLog.schema.ts`):
```typescript
export const auditLogsTable = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    organizationId: text('organization_id'),  // ✅ Organization context
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    // ...
});

// Organization-scoped queries:
static async getByOrganization(organizationId: string, limit?: number)
static async getByUserInOrganization(userId: string, organizationId: string, limit?: number)
static async getByResourceInOrganization(resourceType: string, resourceId: string, organizationId: string, limit?: number)

// Example:
const orgAudit = await AuditLog.getByOrganization('org-acme', 100);
```

#### 3. Cache System (Tenant-Scoped Caching)

**RBAC Cache** (`packages/rbac/src/cache.ts`):
```typescript
// ⚠️ CURRENT IMPLEMENTATION (SECURITY RISK):
private buildCacheKey(type: string, userId: string, organizationId?: string) {
    const parts = [this.prefix, this.version];

    if (organizationId) {
        parts.push('org', organizationId);
    }

    parts.push(type, userId);
    return parts.join(':');  // rbac:v1:org:org-123:user:user-456
}

// ✅ INTENDED BEHAVIOR:
// Org A: rbac:v1:org:org-acme:user:user-123
// Org B: rbac:v1:org:org-startup:user:user-123
// These are completely separate cache entries
```

### organizationId Design Pattern

**Philosophy:** "Explicit tenant context for permissions and audit"

```typescript
// Pattern 1: Tenant-aware permission check
const context = await createRBACContext(user, cache, {
    organizationId: 'org-acme',
    tenantId: 'org-acme'  // Alternative identifier
});

if (context.permissions.includes('posts:edit')) {
    // User has permission in THIS organization only
}

// Pattern 2: Multi-org user
const user = await User.find(userId);

// Check permissions in Org A
const canEditA = await user.hasPermission('posts:edit', {
    organizationId: 'org-acme'
}); // false

// Check permissions in Org B
const canEditB = await user.hasPermission('posts:edit', {
    organizationId: 'org-startup'
}); // true

// Pattern 3: Organization audit logs
await logCreate('post', postId, postData, {
    userId,
    organizationId: 'org-acme',  // Audit entry tied to org
    metadata: { appId: 'web' }   // Optional app context
});
```

**Key Characteristic:** Manual context passing - NOT automatic scoping

---

## Critical Issues

### 🔴 Issue #1: RBAC Cache Security Vulnerability (P0)

**File:** `packages/rbac/src/cache.ts`
**Impact:** Cross-tenant data leakage

**Problem:**
```typescript
// User 123 in Org A checks permission
const canEdit = await user.hasPermission('posts:edit', {
    organizationId: 'org-acme'
});
// Cache key: rbac:v1:org:org-acme:user:user-123 ✅

// Later, User 123 in Org B checks permission
const canEdit = await user.hasPermission('posts:edit', {
    organizationId: undefined  // ❌ FORGOT TO PASS ORG!
});
// Cache key: rbac:v1:user:user-123
// This could return cached results from ANY org!
```

**Root Cause:** organizationId is **optional** in cache key generation. If not passed, cache keys collide across organizations.

**Fix Required:**
```typescript
// Option A: Make organizationId required
private buildCacheKey(type: string, userId: string, organizationId: string) {
    if (!organizationId) {
        throw new Error('organizationId is required for tenant-scoped caching');
    }
    // ...
}

// Option B: Default to a "global" namespace
private buildCacheKey(type: string, userId: string, organizationId?: string) {
    const orgKey = organizationId || 'global';
    return `${this.prefix}:${this.version}:org:${orgKey}:${type}:${userId}`;
}
```

---

### 🔴 Issue #2: Core Models Lack Tenant Isolation (P0)

**Impact:** No automatic tenant filtering on core operations

**Problem:**
```typescript
// User model has NO organizationId field
const users = await User.all();
// Returns ALL users from ALL organizations!
// No automatic filtering by current tenant context

// Role model has NO organizationId field
const roles = await Role.all();
// Returns ALL roles (should these be org-specific?)

// Permission model has NO organizationId field
const permissions = await Permission.all();
// Returns ALL permissions (shared globally or per-org?)
```

**Question:** Should users, roles, and permissions be org-specific?

**Current Design (Inconsistent):**
- ✅ UserRole junction table HAS organizationId (user can have different roles per org)
- ❌ User table LACKS organizationId (user is global across all orgs)
- ❌ Role table LACKS organizationId (roles are global)
- ❌ Permission table LACKS organizationId (permissions are global)

**Implication:** A user with `userId: user-123` is the SAME person across all organizations:
```typescript
// User 123 in Org A
await user.assignRole(adminRoleId, null, 'org-acme');

// User 123 in Org B (SAME USER!)
await user.assignRole(viewerRoleId, null, 'org-startup');

// This works if: User accounts are shared (like Gmail across Google Workspace orgs)
// This breaks if: Each org should have separate user accounts
```

---

### 🔴 Issue #3: appId and organizationId Don't Integrate (P1)

**Impact:** No unified multi-app/multi-tenant strategy

**Problem:** These two dimensions exist in silos:
```typescript
// Feature models use appId, not organizationId
const blogPosts = await Post.where({ appId: 'web' });  // App-scoped
// But NO organization scoping for blog posts!

// RBAC uses organizationId, not appId
const canEdit = await user.hasPermission('posts:edit', {
    organizationId: 'org-acme'  // Org-scoped
});
// But permission doesn't consider which app!

// Audit logs use organizationId, not appId
await logCreate('post', postId, data, {
    organizationId: 'org-acme'  // Org context
    // appId could be in metadata, but not structured
});
```

**Questions:**
1. Should roles/permissions be app-specific? (e.g., admin in web app vs viewer in admin app?)
2. Should audit logs track both appId AND organizationId?
3. Should users be scoped by (appId, organizationId) tuple?

---

### 🔴 Issue #4: Cache Invalidation Performance (P0)

**File:** `packages/rbac/src/cache.ts`
**Impact:** O(n) cache clearing on role changes

**Problem:**
```typescript
// When a role's permissions change:
async invalidateRole(roleName: string): Promise<void> {
    // Current implementation increments cache version (good!)
    await this.incrementCacheVersion();  // v1 → v2
    this.requestCache.clear();

    // But if organizationId is optional in cache keys,
    // we can't properly invalidate just that org's cache
}
```

**Fix Required:** Cache versioning MUST include organizationId:
```typescript
// Instead of global version: v1, v2, v3
// Use per-org version: org-acme:v1, org-startup:v1

private async getCacheVersion(organizationId: string): Promise<number> {
    const key = `${this.prefix}:version:org:${organizationId}`;
    const version = await this.kv.get<number>(key);
    return version ?? 1;
}

async invalidateRole(roleName: string, organizationId: string): Promise<void> {
    // Increment version for THIS organization only
    await this.incrementCacheVersion(organizationId);
    this.requestCache.clear();
}
```

---

### ⚠️ Issue #5: Missing Connection-Level App Isolation (P2)

**File:** `packages/ottaorm/src/context/index.ts`
**Impact:** No database connection per app

**Current State:**
```typescript
// Connection registry by name only
const registry: Record<string, ConnectionWrapper> = {
    'default': { db, appId: undefined },
    'analytics': { db, appId: undefined }
};

// No way to get connection by appId
```

**Enhancement:**
```typescript
// Enable connection-per-app if needed
const registry: Record<string, ConnectionWrapper> = {
    'default': { db, appId: null },           // Shared
    'web-db': { db, appId: 'web' },          // Web app DB
    'admin-db': { db, appId: 'admin' }       // Admin DB
};

// Query models with app-specific connection
User.setConnection('web-db').all();  // Users from web app DB
```

---

## How They Should Coexist

### Conceptual Model

```
┌────────────────────────────────────────────────────────┐
│                  Your SaaS Platform                     │
└────────────────────────────────────────────────────────┘
           │
           ├─ App Layer (appId)
           │  ├─ "web" - Customer-facing web app
           │  ├─ "admin" - Internal admin dashboard
           │  └─ "api" - Public API service
           │
           └─ Tenant Layer (organizationId)
              ├─ "org-acme" - Acme Corp (uses web + api)
              ├─ "org-startup" - Startup Inc (uses web only)
              └─ "org-enterprise" - Enterprise LLC (uses all apps)
```

### Data Model Hierarchy

```
User (Global Entity)
 │
 ├─── AppAccess (appId) - Which apps can this user access?
 │     ├─ web: true
 │     ├─ admin: false
 │     └─ api: true
 │
 └─── OrganizationMembership (organizationId)
       ├─ org-acme
       │   ├─ Roles: [admin, editor]
       │   ├─ Permissions: [posts:*, users:read, ...]
       │   └─ App Context: web, api
       │
       └─ org-startup
           ├─ Roles: [viewer]
           ├─ Permissions: [posts:read, ...]
           └─ App Context: web
```

### Key Insights

1. **appId = App Isolation** (Infrastructure Level)
   - Determines which app code is running
   - Feature data can be app-specific (blog posts for web vs admin)
   - Connection-level isolation (optional)

2. **organizationId = Tenant Isolation** (Business Level)
   - Determines which customer organization
   - Permissions are org-specific (user can be admin in Org A, viewer in Org B)
   - Audit logs are org-specific

3. **Relationship:**
   ```
   (appId, organizationId, userId) = Complete Context
   ```

   Example: "User `user-123` accessing app `web` in organization `org-acme`"

---

## Recommended Architecture

### Design Decision: Shared Users with Org-Scoped Roles

**Recommended Pattern:** Global user accounts with organization-scoped permissions

```
┌────────────────────────────────────────────────────────┐
│                   User: user-123                        │
│                 (Global Account)                        │
└─────────────────────┬──────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
   Org A Context              Org B Context
   ─────────────              ─────────────
   organizationId: org-acme   organizationId: org-startup
   roles: [admin, editor]     roles: [viewer]
   apps: [web, api]           apps: [web]
   permissions: [posts:*]     permissions: [posts:read]
```

**Why This Pattern:**
1. ✅ Users don't need separate logins per organization (better UX)
2. ✅ Same user can be admin in one org, viewer in another
3. ✅ Matches real-world SaaS (Slack, GitHub, Linear, etc.)
4. ✅ RBAC already implements this (UserRole has organizationId)

---

### Proposed Schema Updates

#### 1. Add organizationId to Core Models (Recommended)

**User Model Enhancement:**
```typescript
// Option A: Add organizationId to User (if users are org-specific)
export const usersTable = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    organizationId: text('organization_id'),  // Primary org
    // ...
});

// Option B: Keep User global, create OrganizationMember junction
export const organizationMembersTable = sqliteTable('organization_members', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => usersTable.id),
    organizationId: text('organization_id').notNull(),
    role: text('role').default('member'),  // member, admin, owner
    joinedAt: integer('joined_at', { mode: 'timestamp' }),
});
```

**Role Model Enhancement:**
```typescript
// Should roles be org-specific or global?

// Option A: Global roles (current)
export const rolesTable = sqliteTable('roles', {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description'),
});

// Option B: Org-specific roles
export const rolesTable = sqliteTable('roles', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    organizationId: text('organization_id'),  // NULL = global/system role
    description: text('description'),
});
```

**Recommendation:** Keep roles GLOBAL, scope via UserRole junction (current design is correct)

#### 2. Add appId to RBAC/Audit (Optional)

**UserRole with App Context:**
```typescript
export const userRolesTable = sqliteTable('user_roles', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    roleId: text('role_id').notNull(),
    organizationId: text('organization_id'),  // ✅ Already has this
    appId: text('app_id'),                     // NEW: Role only applies in this app
    assignedBy: text('assigned_by'),
    assignedAt: integer('assigned_at', { mode: 'timestamp' }),
});

// Example: User is admin in web app, viewer in admin app
await user.assignRole(adminRoleId, null, 'org-acme', 'web');
await user.assignRole(viewerRoleId, null, 'org-acme', 'admin');
```

**AuditLog with App Context:**
```typescript
export const auditLogsTable = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    organizationId: text('organization_id'),  // ✅ Already has this
    appId: text('app_id'),                    // NEW: Which app logged this
    action: text('action').notNull(),
    // ...
});

// Example: Track which app generated the audit log
await logCreate('post', postId, data, {
    userId,
    organizationId: 'org-acme',
    appId: 'web'  // Action happened in web app
});
```

#### 3. Fix Cache Keys (REQUIRED)

**RBAC Cache - Make organizationId Required:**
```typescript
// Before (insecure):
async getUserPermissions(userId: string, organizationId?: string): Promise<string[]> {
    const cacheKey = this.buildCacheKey('perms', userId, organizationId);
    // If organizationId is undefined, cache key has no org scoping!
}

// After (secure):
async getUserPermissions(userId: string, organizationId: string): Promise<string[]> {
    if (!organizationId) {
        throw new Error('organizationId is required for tenant-scoped permissions');
    }

    const cacheKey = this.buildCacheKey('perms', userId, organizationId);
    // Cache key ALWAYS includes org: rbac:v1:org:org-acme:perms:user-123
}
```

**Per-Organization Cache Versioning:**
```typescript
private async getCacheVersion(organizationId: string): Promise<number> {
    const key = `${this.prefix}:version:org:${organizationId}`;
    const version = await this.kv.get<number>(key);
    return version ?? 1;
}

async invalidateOrganization(organizationId: string): Promise<void> {
    // Invalidate cache for ONE organization only
    const currentVersion = await this.getCacheVersion(organizationId);
    await this.kv.set(
        `${this.prefix}:version:org:${organizationId}`,
        currentVersion + 1,
        { expirationTtl: 86400 }
    );
    this.requestCache.clear();
}
```

---

### Unified Context Object

**Proposed Standard Context:**
```typescript
interface AppContext {
    // App dimension
    appId: string;              // Which app is running (web, admin, api)
    appName: string;            // Human-readable app name

    // Tenant dimension
    organizationId: string;     // Which customer organization
    organizationName?: string;  // Human-readable org name
    tenantId: string;           // Alternative identifier (alias for organizationId)

    // User context
    user: User | null;          // Current user
    userId?: string;            // User ID

    // RBAC context
    roles: string[];            // User's roles in this org
    permissions: string[];      // User's permissions in this org
    isAuthenticated: boolean;   // Is user logged in

    // Request metadata
    ipAddress?: string;         // For audit logging
    userAgent?: string;         // For audit logging
    requestId?: string;         // For tracing
}

// Build context from request:
const context = await buildAppContext(request, {
    appId: 'web',
    organizationId: extractOrgFromRequest(request)
});

// Use context throughout app:
if (context.permissions.includes('posts:edit')) {
    await Post.update(postId, data);

    await logUpdate('post', postId, changes, {
        userId: context.userId,
        organizationId: context.organizationId,
        appId: context.appId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
    });
}
```

---

## Implementation Plan

### Phase 0: Critical Security Fixes (1-2 days)

**Priority:** P0 - Security vulnerability

1. **Fix RBAC cache keys to require organizationId**
   - File: `packages/rbac/src/cache.ts`
   - Change: Make organizationId required parameter
   - Impact: Prevents cross-tenant cache pollution

2. **Add per-organization cache versioning**
   - File: `packages/rbac/src/cache.ts`
   - Change: Version cache per org, not globally
   - Impact: O(1) invalidation per org

3. **Update User RBAC methods to enforce organizationId**
   - File: `packages/ottaorm/src/models/User.ts`
   - Change: Make organizationId required (breaking change)
   - Impact: Forces developers to provide tenant context

**Migration Note:** Breaking change - all calls to `user.hasPermission()` must now pass organizationId

---

### Phase 1: Standardize Multi-Tenant Context (1 week)

1. **Create unified AppContext interface**
   - New file: `packages/rbac/src/context.ts`
   - Consolidates appId + organizationId + user + RBAC

2. **Create context builder utility**
   - Function: `buildAppContext(request, options)`
   - Extracts organizationId from request (header, subdomain, or JWT)
   - Loads user roles/permissions for that org
   - Returns complete AppContext

3. **Update createRBACContext to use AppContext**
   - Deprecate old createRBACContext signature
   - New signature accepts AppContext

---

### Phase 2: Add appId to RBAC/Audit (Optional, 2-3 days)

**Decision Required:** Do you need app-level permission scoping?

**Use Case A - YES:** User should have different permissions in web app vs admin dashboard
```typescript
// User is editor in web app
await user.assignRole(editorRoleId, null, 'org-acme', 'web');
// User is viewer in admin app
await user.assignRole(viewerRoleId, null, 'org-acme', 'admin');
```

**Use Case B - NO:** Permissions are the same across all apps (current design)
```typescript
// User has same permissions in all apps
await user.assignRole(editorRoleId, null, 'org-acme');
```

**If YES:**
1. Add `appId` column to `user_roles` table
2. Update UserRole methods to accept appId parameter
3. Update cache keys: `rbac:v1:app:web:org:org-acme:user:user-123`
4. Add `appId` column to `audit_logs` table

**If NO:** Skip this phase (recommended for MVP)

---

### Phase 3: Add Organization Management (1 week)

1. **Create Organization model**
   ```typescript
   export const organizationsTable = sqliteTable('organizations', {
       id: text('id').primaryKey(),
       name: text('name').notNull(),
       slug: text('slug').notNull().unique(),
       ownerId: text('owner_id').references(() => usersTable.id),
       createdAt: integer('created_at', { mode: 'timestamp' }),
       settings: text('settings', { mode: 'json' }),
   });
   ```

2. **Create OrganizationMember junction**
   ```typescript
   export const organizationMembersTable = sqliteTable('organization_members', {
       id: text('id').primaryKey(),
       userId: text('user_id').references(() => usersTable.id),
       organizationId: text('organization_id').references(() => organizationsTable.id),
       role: text('role').default('member'),  // member, admin, owner
       joinedAt: integer('joined_at', { mode: 'timestamp' }),
   });
   ```

3. **Create Organization model with methods**
   ```typescript
   class Organization extends BaseModel {
       static async getMembers(organizationId: string)
       static async addMember(organizationId: string, userId: string, role: string)
       static async removeMember(organizationId: string, userId: string)
       static async updateMemberRole(organizationId: string, userId: string, role: string)
   }
   ```

---

### Phase 4: Documentation & Migration Guide (2-3 days)

1. **Create MULTI_TENANCY_GUIDE.md**
   - How to extract organizationId from requests
   - How to scope all queries by organization
   - Common patterns (org switcher, user invites, etc.)

2. **Create migration script**
   - `002_add_organization_management.sql`
   - Creates organizations and organization_members tables
   - Migrates existing data if needed

3. **Update RBAC_AUDIT_SETUP_GUIDE.md**
   - Add multi-app considerations
   - Add organizationId best practices
   - Update all examples to include org context

---

## Architectural Recommendations

### Short-Term (MVP) - Recommended

**Goal:** Secure multi-tenant RBAC with minimal changes

1. ✅ Keep current design: Global users, org-scoped permissions
2. ✅ Make organizationId required in RBAC cache (security fix)
3. ✅ Add per-org cache versioning (performance fix)
4. ✅ Document that appId is for feature isolation, organizationId for tenant isolation
5. ❌ Don't add appId to RBAC (keep it simple)

**Trade-off:** Users have same permissions across all apps, but this is fine for MVP

---

### Long-Term (Scale) - After Product-Market Fit

**Goal:** Full multi-app, multi-tenant architecture

1. Add Organization model with full CRUD
2. Add OrganizationMember junction for membership management
3. Add appId to UserRole for app-specific permissions
4. Add appId to AuditLog for app context tracking
5. Create AppContext middleware for all requests
6. Add connection-per-app support if needed

**Trade-off:** More complex, but supports unlimited apps and orgs

---

## Decision Matrix

| Feature | Current | Short-Term | Long-Term |
|---------|---------|------------|-----------|
| Global users | ✅ | ✅ | ✅ |
| Org-scoped roles | ✅ | ✅ | ✅ |
| App-scoped roles | ❌ | ❌ | ✅ |
| Secure cache keys | ❌ | ✅ | ✅ |
| Per-org cache version | ❌ | ✅ | ✅ |
| Organization CRUD | ❌ | ❌ | ✅ |
| App context tracking | ❌ | ❌ | ✅ |
| Connection per app | ❌ | ❌ | ✅ |

---

## Example: How It All Works Together

### Scenario: User posts a blog article

```typescript
// 1. Extract context from request
const context = await buildAppContext(request, {
    appId: 'web',  // Running in web app
    organizationId: extractOrgFromSubdomain(request)  // acme.yourapp.com → org-acme
});

// Context now contains:
// {
//   appId: 'web',
//   organizationId: 'org-acme',
//   user: User{id: 'user-123', email: 'john@acme.com'},
//   roles: ['editor'],
//   permissions: ['posts:create', 'posts:edit', 'posts:delete'],
//   isAuthenticated: true
// }

// 2. Check permission (org-scoped)
if (!context.permissions.includes('posts:create')) {
    throw new ForbiddenError('You do not have permission to create posts');
}

// 3. Create blog post (app-scoped if needed)
const post = await Post.create({
    title: 'My Blog Post',
    content: '...',
    authorId: context.userId,
    appId: context.appId,  // Optional: Scope post to web app only
    // Note: No organizationId on Post (blog content shared across orgs?)
    // Or add organizationId if blog should be org-specific
});

// 4. Log action to audit (both app and org context)
await logCreate('post', post.id, post, {
    userId: context.userId,
    userEmail: context.user?.email,
    organizationId: context.organizationId,  // Audit in this org
    metadata: {
        appId: context.appId,  // Track which app created it
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
    }
});

// 5. Later, view audit logs (org-scoped)
const auditLogs = await AuditLog.getByOrganization('org-acme', 100);
// Returns only logs for Acme Corp, not other organizations
```

---

## Key Takeaways

1. **appId and organizationId serve different purposes:**
   - appId = App isolation (infrastructure, feature data)
   - organizationId = Tenant isolation (permissions, audit)

2. **Current RBAC design is mostly correct:**
   - Global users with org-scoped roles ✅
   - But cache keys need security fix ❌

3. **Short-term fix (P0):**
   - Make organizationId required in RBAC cache
   - Add per-org cache versioning
   - Document the architecture

4. **Long-term enhancement:**
   - Add Organization model for org management
   - Optionally add appId to RBAC for app-specific permissions
   - Create unified AppContext middleware

5. **Your original intuition was correct:**
   - One database can support multiple apps (appId)
   - Each app can serve multiple tenants (organizationId)
   - These dimensions work together, not in conflict

---

## Next Steps

**Immediate Action Required:**

1. Review this analysis
2. Decide on short-term vs long-term approach
3. Approve Phase 0 security fixes (P0 priority)
4. Decide if you need app-level permission scoping (Phase 2)

**Questions to Answer:**

1. Should users have different permissions in web vs admin apps?
2. Do you need Organization CRUD (create, invite, manage orgs)?
3. Should blog posts be org-specific or shared?
4. How should organizationId be extracted from requests? (subdomain? header? JWT claim?)

**Recommended First Step:** Implement Phase 0 security fixes immediately.
