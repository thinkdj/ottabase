# RBAC & Audit Optimization Summary

**Status**: 🟡 80% Production-Ready | 🔴 Critical Fixes Needed

---

## 🚨 Critical Issues (Fix Immediately)

### 1. Security Risk: Cache Not Tenant-Scoped
```typescript
// ❌ CURRENT (Security Risk)
cache key: rbac:user:123
// User 123 in Org A sees cached data from User 123 in Org B!

// ✅ FIX
cache key: rbac:org:A:user:123
cache key: rbac:org:B:user:123
```
**Impact**: Cross-tenant data leakage
**Location**: `packages/rbac/src/cache.ts:88`
**Effort**: 4 hours

### 2. Performance: O(n) Cache Invalidation
```typescript
// ❌ CURRENT (Slow at Scale)
async invalidateRole(roleName: string) {
    const list = await kv.list({ prefix: 'rbac:' });
    await Promise.all(list.keys.map(k => kv.delete(k))); // Deletes ALL!
}

// ✅ FIX: Cache Versioning
cache keys: rbac:v1:user:123
// To invalidate: increment version → rbac:v2:user:123
// O(1) instead of O(n)!
```
**Impact**: Role changes slow with 10k+ users
**Location**: `packages/rbac/src/cache.ts:260`
**Effort**: 6 hours

### 3. Multi-Tenancy: Missing Organization Context
```typescript
// ❌ CURRENT
interface RBACContext {
    user: User;
    roles: string[];
    permissions: string[];
}

// ✅ FIX
interface RBACContext {
    user: User;
    roles: string[];
    permissions: string[];
    organizationId?: string; // Add this!
    tenantId?: string;
}
```
**Impact**: Cannot scope permissions by org
**Location**: `packages/rbac/src/types.ts`
**Effort**: 1 day (includes DB migration)

---

## 📦 Package Reuse Issues

### Use @ottabase/cf Instead of Direct KV
```typescript
// ❌ CURRENT
import type { KVNamespace } from '@cloudflare/workers-types';
const cached = await this.kv.get(key, 'json');

// ✅ FIX
import { KVClient } from '@ottabase/cf/kv';
const result = await this.kvClient.getJSON<RBACContext>(key);
if (result.success) { ... }
```
**Benefit**: Consistent error handling, better types
**Files**: `packages/rbac/src/cache.ts`
**Effort**: 3 hours

### Use @ottabase/logger Instead of console.error
```typescript
// ❌ CURRENT (8+ places)
console.error('Failed to get RBAC context from KV:', error);

// ✅ FIX
import { createLogger } from '@ottabase/logger';
const logger = createLogger({ name: 'rbac' });
logger.error('Failed to get RBAC context from KV', error);
```
**Benefit**: Structured logging, production debugging
**Files**: `packages/rbac/src/cache.ts`, `packages/audit/src/utils.ts`
**Effort**: 2 hours

### Eliminate Duplicate Code
```typescript
// ❌ CURRENT: Duplicated in RBAC + Audit
async function getUserFromRequest(request: Request) {
    const userId = request.headers.get('x-user-id');
    return userId ? User.find(userId) : null;
}

// ✅ FIX: Extract to shared package
// packages/middleware/src/user.ts
export async function getUserFromRequest(request: Request) { ... }

// Both packages use it
import { getUserFromRequest } from '@ottabase/middleware';
```
**Benefit**: Single source of truth, consistency
**Effort**: 4 hours

---

## ⚡ Performance Issues

### Fix Audit Log Queries
```typescript
// ❌ CURRENT: Loads ALL logs into memory!
static async getRecent(limit: number = 100) {
    const logs = await this.all(); // SELECT * FROM audit_logs
    return logs.slice(0, limit);
}

// ✅ FIX: Proper query
static async getRecent(limit: number = 100) {
    return this.where({})
        .orderBy('createdAt', 'desc')
        .limit(limit);
}
```
**Impact**: Memory issues with large audit tables
**Location**: `packages/ottaorm/src/models/AuditLog.ts:312`
**Effort**: 1 hour

### Increase Logger Buffer Size
```typescript
// ❌ CURRENT: Too small for production
this.bufferSize = options.bufferSize || 10;

// ✅ FIX: Environment-aware
this.bufferSize = options.bufferSize || (
    process.env.NODE_ENV === 'production' ? 100 : 10
);
```
**Impact**: More DB writes than necessary
**Location**: `packages/logger/src/audit-transport.ts:54`
**Effort**: 30 minutes

---

## 🏗️ Architecture Improvements

### Better Middleware Composition
```typescript
// ❌ CURRENT: Nested wrappers
export const GET = withAudit(
    withRBAC(handler, { permissions: ['users:read'] }),
    { resourceType: 'user' }
);

// ✅ FIX: Integrated
export const GET = withRBAC(handler, {
    permissions: ['users:read'],
    audit: { resourceType: 'user', action: 'read' }
});
// Auto-logs permission checks!
```
**Benefit**: Cleaner API, automatic audit logging
**Effort**: 6 hours

### Add Multi-Tenant Query Scoping
```typescript
// ❌ CURRENT: Manual tenant filtering
const users = await User.where({ organizationId: currentOrg.id });

// ✅ FIX: Automatic scoping
User.withTenant(currentOrg.id).all(); // Auto-scoped!
// Or global context:
setTenantContext(request, currentOrg.id);
User.all(); // Automatically filtered by tenant
```
**Benefit**: Prevent tenant data leakage
**Effort**: 2 days

---

## 📊 Effort Estimates

### Week 1 (Critical Fixes) - 3-4 days
- [ ] Tenant-scoped cache keys
- [ ] Cache versioning for O(1) invalidation
- [ ] Add organizationId to audit logs (+ migration)

### Week 2 (Integration) - 4-5 days
- [ ] Refactor RBAC to use @ottabase/cf
- [ ] Replace console.error with logger
- [ ] Extract shared middleware utilities
- [ ] Integrate RBAC + Audit middleware

### Week 3 (Multi-Tenant) - 5-7 days
- [ ] Tenant-aware User model
- [ ] Update RBACContext with org info
- [ ] App-level connection isolation
- [ ] Tenant context in auth sessions

### Week 4 (Performance) - 4-5 days
- [ ] Fix AuditLog queries
- [ ] Increase buffer sizes
- [ ] Add connection pooling
- [ ] Implement audit archival

**Total**: 4-5 weeks for production-ready system

---

## ✅ What's Already Good

1. ✅ Two-level caching architecture (request + KV)
2. ✅ Model-driven RBAC integration
3. ✅ Wildcard permission matching
4. ✅ Simple audit logging API: `log(userId, action, meta)`
5. ✅ Optional caching (backward compatible)
6. ✅ Comprehensive documentation

---

## 🎯 Immediate Action Items

### Today
1. Review RBAC_AUDIT_ROADMAP.md
2. Decide on multi-tenancy model (organizationId vs tenantId)
3. Schedule DB migration for audit logs

### This Week (Priority 0)
1. Fix tenant-scoped cache keys (4 hours)
2. Implement cache versioning (6 hours)
3. Add organizationId to AuditLog schema (1 day)

### Next Week (Priority 1)
1. Refactor to use @ottabase/cf (3 hours)
2. Integrate logger (2 hours)
3. Create shared middleware utils (4 hours)
4. Fix AuditLog queries (1 hour)

---

## 📈 Success Criteria

- [ ] Cache hit rate > 90%
- [ ] Permission checks < 5ms (cached)
- [ ] Zero cross-tenant cache leakage
- [ ] Zero O(n) cache operations
- [ ] All packages use logger (no console.error)
- [ ] < 5% code duplication

---

## Questions to Answer

1. **Multi-Tenancy**: Use `organizationId`, `tenantId`, or both?
2. **Cache TTL**: Is 5 minutes appropriate?
3. **Migration**: Can we deploy DB changes next week?
4. **Breaking Changes**: OK for Phase 3 (tenant context)?
5. **Performance Targets**: What's acceptable latency?

---

## Files to Review

**Critical:**
- `packages/rbac/src/cache.ts` (cache implementation)
- `packages/rbac/src/types.ts` (RBAC context)
- `packages/ottaorm/src/models/AuditLog.ts` (query performance)

**Integration:**
- `packages/rbac/src/middleware.ts` (RBAC middleware)
- `packages/audit/src/middleware.ts` (Audit middleware)
- `packages/audit/src/utils.ts` (logging functions)

**Architecture:**
- `packages/ottaorm/src/context/index.ts` (connection registry)
- `packages/auth/src/session.ts` (session interface)

---

## Next Steps

**Option A: Full Roadmap (4-5 weeks)**
→ See RBAC_AUDIT_ROADMAP.md for detailed plan

**Option B: Critical Only (1 week)**
→ Just fix Phase 1 items (security + perf)

**Option C: Start Phase 1 Now**
→ I can begin implementing tenant-scoped caching immediately

**Your choice?** 🚀
