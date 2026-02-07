-- ============================================================
-- System Owner Bootstrap Migration
-- Migration: 003_system_owner_bootstrap
-- Purpose: Add 'owner' system role and support system-scoped roles
-- ============================================================

-- 1. Add 'owner' system role (platform-wide super admin)
-- Distinct from org-level 'owner' in organization_members
INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'owner',
    'System owner - full platform access across all organizations',
    '["*:*"]',
    1,
    unixepoch(),
    unixepoch()
);

-- 2. Add 'member' system role if missing (was in Role.ensureDefaultRoles but not in migration 001)
INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    'member',
    'Default member access',
    '["*:read"]',
    1,
    unixepoch(),
    unixepoch()
);

-- ============================================================
-- Migration Complete
-- ============================================================

-- SUMMARY:
-- + Added 'owner' system role with *:* permissions
-- + Added 'member' system role for completeness
-- NOTE: System-scoped roles use organization_id = 'system' (sentinel value)
--       to avoid SQLite NULL composite PK issues while keeping NOT NULL constraint
