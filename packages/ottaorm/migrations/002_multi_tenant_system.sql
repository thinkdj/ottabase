-- ============================================================
-- Multi-Tenant SaaS System Migration
-- Implements: Tenant > App > User hierarchy
-- ============================================================

-- ============================================================
-- 1. CREATE ORGANIZATIONS TABLE (Top-level tenant entity)
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_id TEXT,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    settings TEXT,  -- JSON
    metadata TEXT,  -- JSON
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan);

-- ============================================================
-- 2. CREATE ORGANIZATION_MEMBERS TABLE (User ↔ Organization junction)
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_members (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',  -- owner, admin, member
    status TEXT NOT NULL DEFAULT 'active',  -- active, invited, suspended
    invited_by TEXT,
    invited_at INTEGER,
    joined_at INTEGER NOT NULL,
    metadata TEXT,  -- JSON
    PRIMARY KEY (user_id, organization_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);

-- ============================================================
-- 3. UPDATE USER_ROLES TABLE (Add appId, require organizationId)
-- ============================================================

-- Check if user_roles table exists
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Step 1: Create new table with updated schema
CREATE TABLE IF NOT EXISTS user_roles_new (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL,  -- REQUIRED (was optional)
    app_id TEXT,  -- NEW: Optional app scoping (null = all apps)
    assigned_at INTEGER NOT NULL,
    assigned_by TEXT,
    PRIMARY KEY (user_id, role_id, organization_id)  -- Composite key updated
);

-- Step 2: Migrate existing data (if user_roles exists)
-- Set organizationId to 'default-org' for existing records without org
INSERT INTO user_roles_new (user_id, role_id, organization_id, app_id, assigned_at, assigned_by)
SELECT
    user_id,
    role_id,
    COALESCE(organization_id, 'default-org'),  -- Default org for existing data
    NULL as app_id,  -- No app scoping for existing records
    assigned_at,
    assigned_by
FROM user_roles
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_roles');

-- Step 3: Drop old table and rename new table
DROP TABLE IF EXISTS user_roles;
ALTER TABLE user_roles_new RENAME TO user_roles;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_app_id ON user_roles(app_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_org ON user_roles(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_org_app ON user_roles(user_id, organization_id, app_id);

-- ============================================================
-- 4. UPDATE AUDIT_LOGS TABLE (Add appId)
-- ============================================================

-- Check if audit_logs table exists and doesn't have app_id column
-- SQLite doesn't support conditional ALTER TABLE, so we check and recreate if needed

-- Create new table with updated schema
CREATE TABLE IF NOT EXISTS audit_logs_new (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,
    organization_id TEXT,  -- Organization/tenant context
    app_id TEXT,  -- NEW: App context (web, admin, api)
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    changes TEXT,  -- JSON
    metadata TEXT,  -- JSON
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at INTEGER NOT NULL
);

-- Migrate existing data
INSERT INTO audit_logs_new (
    id, user_id, user_email, organization_id, app_id, action, resource_type,
    resource_id, changes, metadata, ip_address, user_agent, status, error_message, created_at
)
SELECT
    id, user_id, user_email, organization_id,
    NULL as app_id,  -- No app context for existing logs
    action, resource_type, resource_id, changes, metadata,
    ip_address, user_agent, status, error_message, created_at
FROM audit_logs
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_logs');

-- Drop old table and rename new table
DROP TABLE IF EXISTS audit_logs;
ALTER TABLE audit_logs_new RENAME TO audit_logs;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_app_id ON audit_logs(app_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_org ON audit_logs(user_id, organization_id);

-- ============================================================
-- 5. SEED DEFAULT ORGANIZATION (for development)
-- ============================================================

-- Create default organization if none exist
INSERT OR IGNORE INTO organizations (id, name, slug, plan, status, created_at, updated_at)
VALUES (
    'default-org',
    'Default Organization',
    'default',
    'free',
    'active',
    unixepoch(),
    unixepoch()
);

-- ============================================================
-- Migration Complete
-- ============================================================

-- SUMMARY:
-- ✅ Created organizations table (top-level tenant entity)
-- ✅ Created organization_members table (user ↔ organization junction)
-- ✅ Updated user_roles table (added appId, required organizationId)
-- ✅ Updated audit_logs table (added appId for app context)
-- ✅ Added comprehensive indexes for performance
-- ✅ Migrated existing data with default values
-- ✅ Seeded default organization

-- HIERARCHY IMPLEMENTED: Tenant > App > User (RBAC)
-- - Organizations are top-level tenants
-- - Users can belong to multiple organizations via organization_members
-- - Users can have different roles per organization (and optionally per app)
-- - Audit logs track both organization and app context
