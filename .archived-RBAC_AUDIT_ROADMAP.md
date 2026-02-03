# RBAC & Audit Logging - Optimization Roadmap

## Executive Summary

This document outlines the optimization and integration plan for the RBAC and Audit logging packages to ensure production-readiness, proper package reuse, and multi-tenant support.

## Current State Analysis

### ✅ What's Working Well
1. **Two-level caching architecture** - Request-level + KV is correct approach
2. **Model-driven RBAC** - Integration with User model is clean
3. **Wildcard permissions** - Flexible permission matching works well
4. **Audit logging utilities** - Simple `log()` function is developer-friendly
5. **Optional caching** - Backward compatible, works without KV

### 🔴 Critical Issues Found

#### 1. Security Risk: Cache Keys Not Tenant-Scoped
**Impact**: User in Org A could access cached permissions from User (same ID) in Org B
**Location**: `packages/rbac/src/cache.ts:88`
**Priority**: P0 (Security)

#### 2. Performance: O(n) Cache Invalidation
**Impact**: Role permission changes clear ALL user caches (expensive at scale)
**Location**: `packages/rbac/src/cache.ts:260-276`
**Priority**: P0 (Scalability)

#### 3. Redundancy: Custom Cache vs Existing KVClient
**Impact**: Code duplication, inconsistent error handling
**Location**: `packages/rbac/src/cache.ts` vs `packages/cf/src/kv.ts`
**Priority**: P1 (Code Quality)

#### 4. Integration Gap: Logger Not Used
**Impact**: Inconsistent logging, missed structured logging benefits
**Location**: Multiple `console.error()` calls in RBAC/Audit
**Priority**: P1 (Observability)

#### 5. Multi-Tenancy: Missing Organization Context
**Impact**: Cannot scope permissions/audit logs by organization
**Location**: RBAC context, User model, Audit logs
**Priority**: P0 (Multi-tenant support)

## Implementation Roadmap

---

### 🚨 Phase 1: Critical Fixes (Week 1)

**Goal**: Fix security and scalability issues

#### 1.1 Add Tenant/Org Scoping to RBAC Cache
- [ ] Add `organizationId` parameter to all cache methods
- [ ] Update cache keys: `rbac:org:{orgId}:user:{userId}`
- [ ] Update User RBAC methods to accept/pass orgId
- [ ] Add tenant context to RBACContext interface

**Files to modify:**
- `packages/rbac/src/cache.ts`
- `packages/rbac/src/types.ts`
- `packages/rbac/src/utils.ts`
- `packages/ottaorm/src/models/User.ts`

**Migration impact**: Breaking change for cache keys (auto-heals)

#### 1.2 Implement Cache Versioning for RBAC
- [ ] Add version to RBACCacheConfig
- [ ] Store current version in KV: `rbac:cache_version`
- [ ] Include version in cache keys: `rbac:v1:user:{userId}`
- [ ] Invalidate by incrementing version (instant, not O(n))

**Files to modify:**
- `packages/rbac/src/cache.ts`

**Benefits**:
- Role changes become O(1) instead of O(n)
- No more bulk cache deletion
- Natural expiration of old cache entries

#### 1.3 Add organizationId to Audit Logs
- [ ] Add `organizationId` field to AuditLog schema
- [ ] Update AuditLogData type
- [ ] Add organization-scoped query methods
- [ ] Update all log functions to accept orgId

**Files to modify:**
- `packages/ottaorm/src/models/AuditLog.schema.ts`
- `packages/ottaorm/src/models/AuditLog.ts`
- `packages/audit/src/types.ts`
- `packages/audit/src/utils.ts`

**Migration**: Database migration required

---

### ⚡ Phase 2: Package Integration (Week 2)

**Goal**: Eliminate redundancy, use existing packages properly

#### 2.1 Refactor RBAC Cache to Use @ottabase/cf
- [ ] Replace direct KVNamespace usage with KVClient
- [ ] Use KVClient's error handling and typing
- [ ] Keep request-level cache (in-memory)
- [ ] Update RBACCacheConfig to accept KVClient

**Files to modify:**
- `packages/rbac/src/cache.ts`
- `packages/rbac/package.json` (add `@ottabase/cf` dependency)

**Benefits**:
- Consistent KV error handling across packages
- Better TypeScript types
- Result<T, Error> pattern for safety

#### 2.2 Integrate Logger Throughout RBAC/Audit
- [ ] Add `@ottabase/logger` dependency to RBAC
- [ ] Replace all `console.error()` with logger calls
- [ ] Add debug logging for permission checks
- [ ] Use logger in Audit package for errors

**Files to modify:**
- `packages/rbac/src/cache.ts` (8+ console.error calls)
- `packages/rbac/src/utils.ts`
- `packages/audit/src/utils.ts`
- `packages/rbac/package.json`
- `packages/audit/package.json`

**Benefits**:
- Structured logging with context
- Consistent log format
- Better production debugging

#### 2.3 Create Shared Middleware Utilities
- [ ] Create `@ottabase/middleware` package (or add to auth)
- [ ] Extract `getUserFromRequest()` to shared util
- [ ] Extract `extractRequestContext()` to shared util
- [ ] Both RBAC and Audit use shared functions

**New package structure:**
```
packages/middleware/
  src/
    user.ts      # getUserFromRequest()
    context.ts   # extractRequestContext()
    compose.ts   # Middleware composition utilities
    index.ts
  package.json
```

**Benefits**:
- No duplicate code
- Consistent user/context extraction
- Single source of truth

#### 2.4 Integrate RBAC with Audit in Middleware
- [ ] Add optional `audit` config to withRBAC
- [ ] Automatically log permission checks when audit enabled
- [ ] Log denied access attempts
- [ ] Compose middlewares cleanly

**Example API:**
```typescript
export const GET = withRBAC(handler, {
  permissions: ['users:read'],
  audit: {
    resourceType: 'user',
    action: 'read'
  }
});
// No need for withAudit wrapper!
```

**Files to modify:**
- `packages/rbac/src/middleware.ts`
- `packages/rbac/package.json` (add audit dependency)

---

### 🏗️ Phase 3: Multi-Tenant Architecture (Week 3)

**Goal**: Full multi-tenant support across all packages

#### 3.1 Add Multi-Tenant Support to User Model
- [ ] Add `static tenantField = 'organizationId'`
- [ ] Auto-scope queries by tenant
- [ ] Add tenant context to BaseModel
- [ ] Update all RBAC methods to be tenant-aware

**Files to modify:**
- `packages/ottaorm/src/base/BaseModel.ts`
- `packages/ottaorm/src/models/User.ts`

**Example:**
```typescript
// Automatically filter by tenant
User.withTenant('org-123').all(); // Only users in org-123
user.assignRole(roleId, assignedBy, { organizationId: 'org-123' });
```

#### 3.2 Update RBACContext with Tenant Info
- [ ] Add `organizationId` to RBACContext
- [ ] Add `tenantId` for multi-tenant scenarios
- [ ] Update permission checks to be tenant-aware
- [ ] Update hasPermission() to validate in correct tenant

**Files to modify:**
- `packages/rbac/src/types.ts`
- `packages/rbac/src/utils.ts`
- `packages/rbac/src/middleware.ts`

#### 3.3 Add App-Level Connection Isolation
- [ ] Update connection registry for app-level isolation
- [ ] Add `appId` parameter to registerConnection
- [ ] Ensure each app in monorepo has isolated connections
- [ ] Add connection pooling config

**Files to modify:**
- `packages/ottaorm/src/context/index.ts`
- `packages/db/src/registry.ts`

#### 3.4 Add Tenant Context to Auth Sessions
- [ ] Add `organizationId` to OttabaseSession
- [ ] Add `appId` to track which app session belongs to
- [ ] Update session utilities to preserve context

**Files to modify:**
- `packages/auth/src/session.ts`
- `packages/auth/src/adapter.ts`

---

### 📈 Phase 4: Production Optimization (Week 4)

**Goal**: Optimize for high-traffic production workloads

#### 4.1 Optimize AuditLog Query Performance
- [ ] Fix getRecent() to use proper query (not load all)
- [ ] Add database indexes on common query fields
- [ ] Add pagination helpers
- [ ] Implement query result limits

**Files to modify:**
- `packages/ottaorm/src/models/AuditLog.ts`

**Before:**
```typescript
static async getRecent(limit: number = 100) {
    const logs = await this.all(); // Loads ALL logs!
    return logs.slice(0, limit);
}
```

**After:**
```typescript
static async getRecent(limit: number = 100) {
    return this.where({})
        .orderBy('createdAt', 'desc')
        .limit(limit);
}
```

#### 4.2 Increase Logger Buffer Sizes for Production
- [ ] Increase AuditDbTransport buffer to 100 (from 10)
- [ ] Make buffer size environment-aware
- [ ] Add adaptive batching based on load
- [ ] Add buffer overflow protection

**Files to modify:**
- `packages/logger/src/audit-transport.ts`

#### 4.3 Add Connection Pooling Support
- [ ] Add ConnectionPoolConfig interface
- [ ] Implement basic pooling for D1 connections
- [ ] Add min/max connection limits
- [ ] Add idle timeout configuration

**Files to modify:**
- `packages/db/src/drizzle-d1.ts`
- `packages/ottaorm/src/context/index.ts`

#### 4.4 Implement Audit Log Archival Strategy
- [ ] Add time-based partitioning (monthly tables)
- [ ] Implement archive-to-R2 functionality
- [ ] Add retention policy configuration
- [ ] Add cleanup jobs for old logs

**New files:**
```
packages/audit/src/archival.ts
packages/audit/src/partitioning.ts
```

#### 4.5 Add Rate Limiting to Auth
- [ ] Integrate @ottabase/cf rate-limiting
- [ ] Add rate limits for login attempts
- [ ] Add rate limits per IP/user
- [ ] Return 429 on rate limit exceeded

**Files to modify:**
- `packages/auth/src/backend-handler.ts`
- `packages/auth/package.json`

---

### 🔬 Phase 5: Advanced Features (Week 5+)

**Goal**: Nice-to-have features for better DX

#### 5.1 RBAC + Audit Middleware Composition
- [ ] Create `withSecureRoute()` that combines both
- [ ] Auto-log all permission checks
- [ ] Auto-log denied attempts
- [ ] Provide clean composition API

#### 5.2 Read Replica Support
- [ ] Add connectionRead/connectionWrite to BaseModel
- [ ] Route reads to replica, writes to primary
- [ ] Add fallback to primary if replica unavailable

#### 5.3 Advanced Cache Strategies
- [ ] Add cache warming on app startup
- [ ] Add cache pre-fetching for hot paths
- [ ] Add cache metrics/monitoring

#### 5.4 Enhanced Multi-Tenancy
- [ ] Add tenant middleware for auto-scoping
- [ ] Add tenant-aware query builder
- [ ] Add cross-tenant query prevention

---

## Migration Guide

### Breaking Changes by Phase

**Phase 1:**
- ✅ Cache keys change (auto-heals, no action needed)
- ⚠️ AuditLog schema changes (requires migration)

**Phase 2:**
- ✅ Fully backward compatible
- ℹ️ New middleware composition is opt-in

**Phase 3:**
- ⚠️ RBACContext interface changes (may break TypeScript)
- ⚠️ Connection registry API changes (minor)
- ⚠️ Session interface changes (extends existing)

**Phase 4:**
- ✅ Performance improvements, no breaking changes

### Rollout Strategy

1. **Phase 1 (Critical)**: Deploy immediately, requires DB migration
2. **Phase 2 (Integration)**: Deploy gradually, update code as needed
3. **Phase 3 (Multi-tenant)**: Coordinate with app teams, staged rollout
4. **Phase 4 (Performance)**: Deploy to production, monitor metrics
5. **Phase 5 (Advanced)**: Opt-in features, no forced adoption

---

## Success Metrics

### Performance
- [ ] Cache hit rate > 90%
- [ ] Permission check latency < 5ms (cached)
- [ ] Audit log write latency < 50ms (buffered)
- [ ] Zero O(n) cache invalidations

### Code Quality
- [ ] Zero `console.error()` in packages (use logger)
- [ ] Zero duplicate user extraction logic
- [ ] All packages use @ottabase/cf for Cloudflare bindings
- [ ] < 5% code duplication across packages

### Security
- [ ] All cache keys include tenant/org ID
- [ ] No cross-tenant data leakage in cache
- [ ] Audit logs filterable by organization
- [ ] Rate limiting on auth endpoints

### Multi-Tenancy
- [ ] User queries auto-scoped by tenant
- [ ] RBAC checks tenant-aware
- [ ] Audit logs include organization context
- [ ] Connections isolated per app

---

## Estimated Effort

- **Phase 1**: 3-4 days (Critical fixes)
- **Phase 2**: 4-5 days (Integration)
- **Phase 3**: 5-7 days (Multi-tenant)
- **Phase 4**: 4-5 days (Performance)
- **Phase 5**: 10+ days (Advanced features)

**Total**: 4-5 weeks for Phases 1-4 (production-ready)

---

## Recommended Immediate Actions

### Priority 0 (This Week)
1. ✅ Review and approve this roadmap
2. 🔴 **Phase 1.1**: Add tenant scoping to RBAC cache (security fix)
3. 🔴 **Phase 1.2**: Implement cache versioning (scalability fix)
4. 🔴 **Phase 1.3**: Add organizationId to audit logs (multi-tenant support)

### Priority 1 (Next Week)
1. **Phase 2.1**: Refactor RBAC to use @ottabase/cf
2. **Phase 2.2**: Integrate logger throughout
3. **Phase 2.3**: Create shared middleware utilities

### Priority 2 (Weeks 3-4)
- Complete Phase 3 (Multi-tenant architecture)
- Complete Phase 4 (Production optimization)

---

## Questions for Team

1. **Multi-Tenancy Model**: Do we use `organizationId`, `tenantId`, or both?
2. **Cache TTL**: Is 5 minutes appropriate for your use case?
3. **Migration Timeline**: Can we do DB migrations next week?
4. **Backward Compatibility**: Are breaking changes in Phase 3 acceptable?
5. **Performance Budget**: What are target latencies for permission checks?

---

## Conclusion

The current implementation is **80% production-ready** but needs critical fixes for:
- Security (tenant-scoped caching)
- Scalability (cache versioning, query optimization)
- Code quality (package reuse, eliminate duplication)

With Phases 1-4 complete, the system will be **fully production-ready** for multi-tenant, high-traffic deployments.
