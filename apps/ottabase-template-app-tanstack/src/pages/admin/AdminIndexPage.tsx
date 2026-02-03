import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import {
    Activity,
    Building2,
    Clock,
    Database,
    FileText,
    Layers,
    Palette,
    Shield,
    ShieldCheck,
    UserPlus,
    Users,
} from 'lucide-react';

export function AdminIndexPage() {
    const adminLinks = [
        {
            title: 'Blog Management',
            description: 'Create and manage blog posts, changelogs, and documentation.',
            href: '/admin/blog',
            icon: FileText,
            disabled: false,
        },
        {
            title: 'Blog Studio',
            description: 'Manage blog themes and plugins (activate theme, enable/disable plugins).',
            href: '/admin/blog/studio',
            icon: Palette,
            disabled: false,
        },
        {
            title: 'Organizations',
            description: 'Manage multi-tenant organizations, members, and settings.',
            href: '/organizations',
            icon: Building2,
            disabled: false,
        },
        {
            title: 'RBAC Administration',
            description: 'Manage roles, permissions, and access control for multi-tenant security.',
            href: '/admin/rbac',
            icon: Shield,
            disabled: false,
        },
        {
            title: 'Audit Logs',
            description: 'View and search audit logs for security and compliance tracking.',
            href: '/admin/audit',
            icon: FileText,
            disabled: false,
        },
        {
            title: 'RLS Security Demo',
            description: 'Interactive demo of Row-Level Security with live security tests and policy overview.',
            href: '/admin/security/rls',
            icon: ShieldCheck,
            disabled: false,
        },
        {
            title: 'User Management',
            description: 'View and manage all users, assign roles, and control organization access.',
            href: '/admin/users',
            icon: Users,
            disabled: false,
        },
        {
            title: 'Migration Status',
            description: 'Check database schema status, view migration history, and initialize tables.',
            href: '/migration-status',
            icon: Database,
            disabled: false,
        },
        {
            title: 'Database Manager',
            description: 'Directly view and manage database tables and records.',
            href: '/admin/db',
            icon: Database,
            disabled: false,
        },
        {
            title: 'Referral Tracking',
            description: 'View referral statistics, manage usernames, and track conversions.',
            href: '/admin/referrals',
            icon: UserPlus,
            disabled: false,
        },
        {
            title: 'Queue Management',
            description: 'Monitor background job queues, view processing stats, and manage failed jobs.',
            href: '/admin/queues',
            icon: Layers,
            disabled: false,
        },
        {
            title: 'Scheduled Tasks',
            description: 'Manage DB-driven cron jobs, view run history, and schedule new tasks.',
            href: '/admin/cron',
            icon: Clock,
            disabled: false,
        },
        {
            title: 'System Health',
            description: 'View system health metrics and API status.',
            href: '/api/health', // Direct API link or maybe a page? currently home page has health check.
            icon: Activity,
            external: true,
            disabled: false,
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
                <p className="text-muted-foreground mt-2">Central hub for system administration and monitoring.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {adminLinks.map((link) => (
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

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                <div className="flex gap-4 flex-wrap">
                    <Link to="/demo" className="text-sm text-primary hover:underline">
                        Component Demos
                    </Link>
                    <Link to="/shortlinks" className="text-sm text-primary hover:underline">
                        Shortlinks Manager
                    </Link>
                </div>
            </div>
        </div>
    );
}
