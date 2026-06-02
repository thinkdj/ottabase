/**
 * Admin Navigation – Single Source of Truth
 *
 * One typed array drives BOTH:
 *   - The admin sidebar (apps/otta-web/src/components/admin/AdminLayout.tsx)
 *   - The admin overview cards (apps/otta-web/src/pages/admin/AdminIndexPage.tsx)
 *
 * To add a new admin page: add a single entry to ADMIN_NAV_GROUPS,
 * then register the route in apps/otta-web/src/router.tsx.
 */

import { CUSTOM_PACKAGES_ENABLED, MEDIA_LIBRARY_ENABLED, PACKAGES_ENABLED } from '@/ottabase/config';
import { PAYPORT_ADMIN_NAV } from '@ottabase/payport/admin';
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

export interface AdminNavGroup {
    /** Stable id used by sidebar for active-group detection (matches URL segment). */
    id: 'overview' | 'appearance' | 'content' | 'access' | 'security' | 'infrastructure' | 'growth' | 'billing';
    label: string;
    icon: AdminNavIcon;
    items: AdminNavItem[];
}

/**
 * Master admin nav. Order here = order in sidebar + cards.
 * brandEngine and ottamenu are core (always enabled) — no `requiresPackage`.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
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
                title: 'Users',
                description: 'View and manage all users, assign roles, and control org access.',
                href: '/admin/access/users',
                icon: Users,
            },
            {
                title: 'Organizations',
                description: 'Manage multi-tenant organizations, members, and settings.',
                href: '/admin/access/organizations',
                icon: Building2,
            },
            {
                title: 'Roles & Permissions',
                description: 'Manage RBAC roles and the permissions matrix.',
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
            {
                title: 'Row-Level Security',
                description: 'Inspect tenant isolation policies and verify RLS enforcement.',
                href: '/admin/security/rls',
                icon: ShieldCheck,
            },
            {
                title: 'Kill Switches',
                description: 'Configure global read-only mode or full lockdown.',
                href: '/admin/security/kill-switches',
                icon: Power,
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
                href: '/admin/infrastructure/database',
                icon: Database,
            },
            {
                title: 'Migrations',
                description: 'Schema status, migration history, and table initialization.',
                href: '/admin/infrastructure/migrations',
                icon: RefreshCw,
            },
            {
                title: 'Queues',
                description: 'Background job queues, processing stats, and failed jobs.',
                href: '/admin/infrastructure/queues',
                icon: Layers,
            },
            {
                title: 'Cron',
                description: 'DB-driven scheduled tasks with run history.',
                href: '/admin/infrastructure/cron',
                icon: Clock,
            },
            {
                title: 'Dev Mail',
                description: 'Inspect locally captured emails (magic links, resets, queue sends).',
                href: '/admin/infrastructure/dev-mail',
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

/** Returns admin nav with package/feature gates applied; empty groups are dropped. */
export function getEnabledAdminNav(): AdminNavGroup[] {
    // Payport is a custom package — only show its nav when enabled via ottabase.config.ts.
    // PAYPORT_ADMIN_NAV is structurally compatible with AdminNavGroup (id 'billing' is in the union).
    const groups: AdminNavGroup[] = CUSTOM_PACKAGES_ENABLED?.payport
        ? [...ADMIN_NAV_GROUPS, PAYPORT_ADMIN_NAV as unknown as AdminNavGroup]
        : ADMIN_NAV_GROUPS;

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
