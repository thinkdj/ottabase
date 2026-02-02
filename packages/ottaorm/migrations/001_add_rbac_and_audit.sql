-- ============================================================
-- RBAC and Audit Logging Migration
-- Migration: 001_add_rbac_and_audit
-- Created: 2026-02-02
-- ============================================================

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT NOT NULL DEFAULT '[]',
    is_system INTEGER DEFAULT 0 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    organization_id TEXT,
    assigned_at INTEGER NOT NULL,
    assigned_by TEXT,
    PRIMARY KEY (user_id, role_id)
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,
    organization_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    changes TEXT,
    metadata TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success' NOT NULL,
    error_message TEXT,
    created_at INTEGER NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- Insert default system roles
INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at) VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        'admin',
        'Full system access',
        '["*:*"]',
        1,
        unixepoch(),
        unixepoch()
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        'editor',
        'Can create and edit content',
        '["*:read","*:create","*:update"]',
        1,
        unixepoch(),
        unixepoch()
    ),
    (
        '00000000-0000-0000-0000-000000000003',
        'viewer',
        'Read-only access',
        '["*:read"]',
        1,
        unixepoch(),
        unixepoch()
    );

-- Insert default permissions
INSERT OR IGNORE INTO permissions (id, name, description, resource, action, created_at, updated_at) VALUES
    -- User permissions
    (hex(randomblob(16)), 'users:read', 'Read users', 'users', 'read', unixepoch(), unixepoch()),
    (hex(randomblob(16)), 'users:create', 'Create users', 'users', 'create', unixepoch(), unixepoch()),
    (hex(randomblob(16)), 'users:update', 'Update users', 'users', 'update', unixepoch(), unixepoch()),
    (hex(randomblob(16)), 'users:delete', 'Delete users', 'users', 'delete', unixepoch(), unixepoch()),
    -- Role permissions
    (hex(randomblob(16)), 'roles:read', 'Read roles', 'roles', 'read', unixepoch(), unixepoch()),
    (hex(randomblob(16)), 'roles:create', 'Create roles', 'roles', 'create', unixepoch(), unixepoch()),
    (hex(randomblob(16)), 'roles:update', 'Update roles', 'roles', 'update', unixepoch(), unixepoch()),
    (hex(randomblob(16)), 'roles:delete', 'Delete roles', 'roles', 'delete', unixepoch(), unixepoch()),
    -- Audit log permissions
    (hex(randomblob(16)), 'audit:read', 'Read audit logs', 'audit', 'read', unixepoch(), unixepoch()),
    (hex(randomblob(16)), 'audit:export', 'Export audit logs', 'audit', 'export', unixepoch(), unixepoch()),
    -- Wildcard permissions
    (hex(randomblob(16)), '*:*', 'All permissions', '*', '*', unixepoch(), unixepoch()),
    (hex(randomblob(16)), '*:read', 'Read all resources', '*', 'read', unixepoch(), unixepoch());

-- ============================================================
-- Migration complete
-- ============================================================
