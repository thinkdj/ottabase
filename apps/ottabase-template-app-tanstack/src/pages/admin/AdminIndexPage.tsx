import { PACKAGES_ENABLED } from '@/ottabase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconMenu2 } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    Bell,
    Building2,
    Clock,
    Database,
    FileText,
    Layers,
    Layout,
    Mail,
    Palette,
    Power,
    Shield,
    ShieldCheck,
    UserPlus,
    Users,
} from 'lucide-react';

// brandEngine is core — BrandEngine/Theme Generator always shown
const PACKAGE_LINK_KEYS: Record<string, keyof typeof PACKAGES_ENABLED> = {
    'Blog Management': 'ottablog',
    'Blog Studio': 'ottablog',
    'Referral Tracking': 'referrals',
};

interface AdminLink {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon | typeof IconMenu2;
    disabled?: boolean;
    external?: boolean;
}

interface AdminCategory {
    label: string;
    links: AdminLink[];
}

const ADMIN_CATEGORIES: AdminCategory[] = [
    {
        label: 'Appearance & Navigation',
        links: [
            {
                title: 'BrandEngine',
                description: 'Theme, layout, typography, and design token configuration with real-time preview.',
                href: '/admin/brand-engine',
                icon: Layout,
            },
            {
                title: 'Theme Generator',
                description: 'Generate color palettes and check accessibility contrast (in Brand Engine).',
                href: '/admin/brand-engine',
                icon: Palette,
            },
            {
                title: 'Menus',
                description: 'Define navigation menus (sidebar, header). Override default nav links.',
                href: '/admin/menus',
                icon: IconMenu2,
            },
        ],
    },
    {
        label: 'Content',
        links: [
            {
                title: 'Blog Management',
                description: 'Create and manage blog posts, changelogs, and documentation.',
                href: '/admin/blog',
                icon: FileText,
            },
            {
                title: 'Blog Studio',
                description: 'Manage blog themes and plugins (activate theme, enable/disable plugins).',
                href: '/admin/blog/studio',
                icon: Palette,
            },
        ],
    },
    {
        label: 'Users & Access Control',
        links: [
            {
                title: 'User Management',
                description: 'View and manage all users, assign roles, and control organization access.',
                href: '/admin/users',
                icon: Users,
            },
            {
                title: 'Organizations',
                description: 'Manage multi-tenant organizations, members, and settings.',
                href: '/organizations',
                icon: Building2,
            },
            {
                title: 'RBAC Administration',
                description: 'Manage roles, permissions, and access control for multi-tenant security.',
                href: '/admin/rbac',
                icon: Shield,
            },
        ],
    },
    {
        label: 'Security & Compliance',
        links: [
            {
                title: 'Audit Logs',
                description: 'View and search audit logs for security and compliance tracking.',
                href: '/admin/audit',
                icon: FileText,
            },
            {
                title: 'RLS Security Demo',
                description: 'Interactive demo of Row-Level Security with live security tests and policy overview.',
                href: '/admin/security/rls',
                icon: ShieldCheck,
            },
            {
                title: 'Platform Kill Switches',
                description:
                    'Configure global read-only mode or full lockdown (KILLSWITCH_READONLY_MODE / KILLSWITCH_LOCKDOWN).',
                href: '/admin/security/kill-switches',
                icon: Power,
            },
        ],
    },
    {
        label: 'Infrastructure',
        links: [
            {
                title: 'Migration Status',
                description: 'Check database schema status, view migration history, and initialize tables.',
                href: '/migration-status',
                icon: Database,
            },
            {
                title: 'Database Manager',
                description: 'Directly view and manage database tables and records.',
                href: '/admin/db',
                icon: Database,
            },
            {
                title: 'Queue Management',
                description: 'Monitor background job queues, view processing stats, and manage failed jobs.',
                href: '/admin/queues',
                icon: Layers,
            },
            {
                title: 'Scheduled Tasks',
                description: 'Manage DB-driven cron jobs, view run history, and schedule new tasks.',
                href: '/admin/cron',
                icon: Clock,
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
        label: 'Communication & Growth',
        links: [
            {
                title: 'Notifications',
                description: 'Send notifications to users and broadcast system alerts to administrators.',
                href: '/admin/notifications',
                icon: Bell,
            },
            {
                title: 'Dev Mail Trap',
                description:
                    'Inspect locally captured emails for magic links, verification, password resets, and queue sends.',
                href: '/admin/dev-mail',
                icon: Mail,
            },
            {
                title: 'Referral Tracking',
                description: 'View referral statistics, manage usernames, and track conversions.',
                href: '/admin/referrals',
                icon: UserPlus,
            },
        ],
    },
];

export function AdminIndexPage() {
    // Filter categories by enabled packages, then drop empty categories
    const categories = ADMIN_CATEGORIES.map((cat) => ({
        ...cat,
        links: cat.links.filter((link) => {
            const pkg = PACKAGE_LINK_KEYS[link.title];
            return !pkg || PACKAGES_ENABLED[pkg];
        }),
    })).filter((cat) => cat.links.length > 0);

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
                <p className="text-muted-foreground mt-2">Central hub for system administration and monitoring.</p>
            </div>

            {categories.map((category) => (
                <section key={category.label} className="space-y-4">
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">{category.label}</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {category.links.map((link) => (
                            <Link
                                key={link.title}
                                to={link.href}
                                target={link.external ? '_blank' : undefined}
                                disabled={link.disabled}
                                className={link.disabled ? 'pointer-events-none opacity-50' : ''}
                            >
                                <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                                    <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                                        <div className="p-2 bg-primary/10 rounded-full">
                                            <link.icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <CardTitle className="text-base">{link.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription>{link.description}</CardDescription>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                <div className="flex gap-4 flex-wrap">
                    <Link to="/demo" className="text-sm text-primary hover:underline">
                        Component Demos
                    </Link>
                    {PACKAGES_ENABLED.shortlinks && (
                        <Link to="/shortlinks" className="text-sm text-primary hover:underline">
                            Shortlinks Manager
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
