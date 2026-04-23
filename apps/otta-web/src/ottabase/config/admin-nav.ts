/**
 * Admin Navigation – Single Source of Truth
 *
 * Two typed arrays drive the two admin surfaces:
 *   - TENANT_ADMIN_NAV_GROUPS: /admin/* (owner/admin of the current organization)
 *   - ADMIN_PLATFORM_NAV_GROUPS: /admin-platform/* (SaaS founder / system admin)
 *
 * Both drive their respective sidebar and overview index cards. To add a new
 * admin page, add a single entry to the correct array and register the matching
 * route in `apps/otta-web/src/router.tsx`.
 */

import { MEDIA_LIBRARY_ENABLED, PACKAGES_ENABLED } from '@/ottabase/config';
import { IconMenu2 } from '@tabler/icons-react';
import {
    Activity,
    Bell,
    BookOpen,
    Building2,
    Clock,
    Database,
    FileText,
    Image as ImageIcon,
    Inbox,
    Layers,
    Layout,
    LayoutDashboard,
    Palette,
    Power,
    RefreshCw,
    Rocket,
    Server,
    Shield,
    ShieldCheck,
    ShieldEllipsis,
    UserCog,
    UserPlus,
    Users,
    type LucideIcon,
} from 'lucide-react';

export type AdminNavIcon = LucideIcon | typeof IconMenu2;

export interface AdminNavItem {
    /** Display title in sidebar + cards. */
    title: string;
    /** Long description for the overview card. */
    description: string;
    /** Target route. Internal unless `external` is true. */
    href: string;
    /** Icon component (lucide or tabler). */
    icon: AdminNavIcon;
    /** Set true for `/api/*` style links opened in a new tab. */
    external?: boolean;
    /** Visible only when this package is enabled (skip if undefined). */
    requiresPackage?: keyof typeof PACKAGES_ENABLED;
    /** Visible only when MEDIA_LIBRARY_ENABLED is true. */
    requiresMediaLibrary?: boolean;
}

export type AdminNavGroupId =
    | 'overview'
    | 'appearance'
    | 'content'
    | 'access'
    | 'security'
    | 'growth'
    | 'tenants'
    | 'users'
    | 'infrastructure';

export interface AdminNavGroup {
    id: AdminNavGroupId;
    label: string;
    icon: AdminNavIcon;
    items: AdminNavItem[];
}

/**
 * Tenant admin nav — available to owner/admin of the current organization.
 * Lives under /admin/*.
 */
export const TENANT_ADMIN_NAV_GROUPS: AdminNavGroup[] = [
    {
        id: 'appearance',
        label: 'Appearance',
        icon: Palette,
        items: [
            {
                title: 'Brand Kits',
                description: 'Theme, layout, typography, and design tokens with real-time preview.',
                href: '/admin/appearance/brand-kits',
                icon: Layout,
            },
            {
                title: 'Layouts',
                description: 'Map routes to layouts (sidebar, topbar, drawer, minimal).',
                href: '/admin/appearance/layouts',
                icon: Layers,
            },
            {
                title: 'Menus',
                description: 'Define navigation menus (sidebar, header, footer, mobile).',
                href: '/admin/appearance/menus',
                icon: IconMenu2,
            },
        ],
    },
    {
        id: 'content',
        label: 'Content',
        icon: BookOpen,
        items: [
            {
                title: 'Posts',
                description: 'Create and manage blog posts, changelogs, docs, and announcements.',
                href: '/admin/content/blog',
                icon: FileText,
                requiresPackage: 'ottablog',
            },
            {
                title: 'Content Theme',
                description: 'Manage content themes and renderer plugins.',
                href: '/admin/content/blog/studio',
                icon: Palette,
                requiresPackage: 'ottablog',
            },
            {
                title: 'Media Library',
                description: 'Browse uploads with previews, metadata, and direct links.',
                href: '/admin/content/media',
                icon: ImageIcon,
                requiresMediaLibrary: true,
            },
        ],
    },
    {
        id: 'access',
        label: 'Access',
        icon: ShieldEllipsis,
        items: [
            {
                title: 'Members',
                description: 'Invite, promote, or remove members of the current organization.',
                href: '/admin/organization/members',
                icon: Users,
            },
            {
                title: 'Roles & Permissions',
                description: 'Manage RBAC roles and the permissions matrix for this organization.',
                href: '/admin/access/rbac',
                icon: UserCog,
            },
        ],
    },
    {
        id: 'security',
        label: 'Security',
        icon: Shield,
        items: [
            {
                title: 'Audit Logs',
                description: 'Search audit logs for security and compliance tracking.',
                href: '/admin/security/audit',
                icon: FileText,
            },
        ],
    },
    {
        id: 'growth',
        label: 'Growth',
        icon: Rocket,
        items: [
            {
                title: 'Notifications',
                description: 'Send notifications and broadcast system alerts.',
                href: '/admin/growth/notifications',
                icon: Bell,
            },
            {
                title: 'Referrals',
                description: 'Referral statistics, usernames, and conversion tracking.',
                href: '/admin/growth/referrals',
                icon: UserPlus,
                requiresPackage: 'referrals',
            },
        ],
    },
];

/**
 * Admin-platform (superadmin) nav — SaaS founder / system admin only.
 * Lives under /admin-platform/*.
 */
export const ADMIN_PLATFORM_NAV_GROUPS: AdminNavGroup[] = [
    {
        id: 'tenants',
        label: 'Tenants',
        icon: Building2,
        items: [
            {
                title: 'All Organizations',
                description: 'Platform-admin tenant lifecycle, support actions, and explicit tenant management.',
                href: '/admin-platform/organizations',
                icon: Building2,
            },
        ],
    },
    {
        id: 'users',
        label: 'Users',
        icon: Users,
        items: [
            {
                title: 'All Users',
                description: 'View and manage all users, assign roles, and control org access.',
                href: '/admin-platform/users',
                icon: Users,
            },
        ],
    },
    {
        id: 'security',
        label: 'Security',
        icon: Shield,
        items: [
            {
                title: 'Row-Level Security',
                description: 'Inspect tenant isolation policies and verify RLS enforcement.',
                href: '/admin-platform/security/rls',
                icon: ShieldCheck,
            },
            {
                title: 'Kill Switches',
                description: 'Configure global read-only mode or full lockdown.',
                href: '/admin-platform/security/kill-switches',
                icon: Power,
            },
            {
                title: 'Platform Audit',
                description: 'Cross-tenant audit view for the entire platform.',
                href: '/admin-platform/security/audit',
                icon: FileText,
            },
        ],
    },
    {
        id: 'infrastructure',
        label: 'Infrastructure',
        icon: Server,
        items: [
            {
                title: 'Database',
                description: 'Browse and manage database tables and records.',
                href: '/admin-platform/infrastructure/database',
                icon: Database,
            },
            {
                title: 'Migrations',
                description: 'Schema status, migration history, and table initialization.',
                href: '/admin-platform/infrastructure/migrations',
                icon: RefreshCw,
            },
            {
                title: 'Queues',
                description: 'Background job queues, processing stats, and failed jobs.',
                href: '/admin-platform/infrastructure/queues',
                icon: Layers,
            },
            {
                title: 'Cron',
                description: 'DB-driven scheduled tasks with run history.',
                href: '/admin-platform/infrastructure/cron',
                icon: Clock,
            },
            {
                title: 'Dev Mail',
                description: 'Inspect locally captured emails (magic links, resets, queue sends).',
                href: '/admin-platform/infrastructure/dev-mail',
                icon: Inbox,
            },
            {
                title: 'System Health',
                description: 'View system health metrics and API status.',
                href: '/api/health',
                icon: Activity,
                external: true,
            },
        ],
    },
];

function filterGroups(groups: AdminNavGroup[]): AdminNavGroup[] {
    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                if (item.requiresMediaLibrary && !MEDIA_LIBRARY_ENABLED) return false;
                if (item.requiresPackage && !PACKAGES_ENABLED[item.requiresPackage]) return false;
                return true;
            }),
        }))
        .filter((group) => group.items.length > 0);
}

export function getTenantAdminNav(): AdminNavGroup[] {
    return filterGroups(TENANT_ADMIN_NAV_GROUPS);
}

export function getAdminPlatformNav(): AdminNavGroup[] {
    return filterGroups(ADMIN_PLATFORM_NAV_GROUPS);
}

export interface AdminSurfaceInfo {
    /** 'tenant' for /admin/*, 'platform' for /admin-platform/*. */
    surface: 'tenant' | 'platform';
    /** Root path of the surface (used for the Overview link). */
    rootPath: '/admin' | '/admin-platform';
    /** Display label. */
    label: string;
    /** Overview icon. */
    overviewIcon: AdminNavIcon;
    groups: AdminNavGroup[];
}

export function resolveAdminSurface(pathname: string): AdminSurfaceInfo {
    if (pathname.startsWith('/admin-platform')) {
        return {
            surface: 'platform',
            rootPath: '/admin-platform',
            label: 'Platform Admin',
            overviewIcon: LayoutDashboard,
            groups: getAdminPlatformNav(),
        };
    }
    return {
        surface: 'tenant',
        rootPath: '/admin',
        label: 'Admin Console',
        overviewIcon: LayoutDashboard,
        groups: getTenantAdminNav(),
    };
}
