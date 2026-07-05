import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Key, Shield, Users } from 'lucide-react';

export function RBACAdminPage() {
    const rbacLinks = [
        {
            title: 'Roles Management',
            description: 'Create and manage roles with custom permissions',
            href: '/admin/access/rbac/roles',
            icon: Shield,
            disabled: false,
        },
        {
            title: 'User Roles Assignment',
            description: 'Assign roles to users and manage access control',
            href: '/admin/access/rbac/user-roles',
            icon: Users,
            disabled: true, // Can be implemented later
        },
        {
            title: 'Permissions Matrix',
            description: 'View and manage the complete permissions matrix across the hierarchy',
            href: '/admin/access/rbac/permissions',
            icon: Key,
            disabled: false,
        },
    ];

    return (
        <div className="space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">RBAC Administration</h1>
                <p className="max-w-3xl text-muted-foreground">
                    Role-Based Access Control management for multi-tenant organizations
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {rbacLinks.map((item) => {
                    const Icon = item.icon;
                    const content = (
                        <Card
                            className={`h-full rounded-xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal ${
                                item.disabled ? 'opacity-50' : 'group-hover:bg-muted/70'
                            }`}
                        >
                            <CardHeader className="gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border transition-colors group-hover:text-foreground">
                                        <Icon className="h-[1.125rem] w-[1.125rem]" />
                                    </span>
                                    {item.disabled && (
                                        <span className="rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                                            Coming Soon
                                        </span>
                                    )}
                                </div>
                                <CardTitle className="text-[0.9375rem] font-semibold">{item.title}</CardTitle>
                                <CardDescription className="line-clamp-2 leading-relaxed">
                                    {item.description}
                                </CardDescription>
                            </CardHeader>
                            {!item.disabled && (
                                <CardContent>
                                    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                                        Open
                                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                    </span>
                                </CardContent>
                            )}
                        </Card>
                    );

                    if (item.disabled) {
                        return (
                            <div key={item.title} className="cursor-not-allowed">
                                {content}
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.title}
                            to={item.href}
                            className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {content}
                        </Link>
                    );
                })}
            </div>

            {/* Quick Stats */}
            <section className="space-y-4">
                <h2 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    RBAC Overview
                </h2>
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-muted/40 p-5">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            System Roles
                        </p>
                        <p className="mt-2 text-2xl font-semibold">3</p>
                        <p className="mt-1 text-xs text-muted-foreground">owner, admin, member</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-5">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Custom Roles
                        </p>
                        <p className="mt-2 text-2xl font-semibold">-</p>
                        <p className="mt-1 text-xs text-muted-foreground">Create custom roles as needed</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-5">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Permission Format
                        </p>
                        <p className="mt-2 font-mono text-xl font-semibold">resource:action</p>
                        <p className="mt-1 text-xs text-muted-foreground">e.g., users:read, posts:write</p>
                    </div>
                </div>
            </section>

            {/* Documentation */}
            <section className="space-y-6 rounded-xl bg-muted/40 p-6">
                <div className="space-y-1.5">
                    <h2 className="text-[0.9375rem] font-semibold">RBAC Architecture</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Understanding the multi-tenant RBAC hierarchy
                    </p>
                </div>

                <div>
                    <h3 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Hierarchy
                    </h3>
                    <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                            🏢 <strong className="font-medium text-foreground">Tenant (Organization)</strong> → Top
                            level isolation
                        </p>
                        <p className="ml-6">
                            📱 <strong className="font-medium text-foreground">App</strong> → Application scope
                            (optional)
                        </p>
                        <p className="ml-12">
                            👤 <strong className="font-medium text-foreground">User + Role</strong> → Permission
                            enforcement
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Key Features
                    </h3>
                    <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
                        <li>Per-organization cache versioning (O(1) invalidation)</li>
                        <li>Cloudflare KV caching with Result pattern</li>
                        <li>Request-level in-memory cache</li>
                        <li>Tenant isolation enforced at all levels</li>
                    </ul>
                </div>

                <div>
                    <h3 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Default Roles
                    </h3>
                    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                        <div>
                            <span className="mr-2 inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                                Owner
                            </span>
                            Full control over organization
                        </div>
                        <div>
                            <span className="mr-2 inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                                Admin
                            </span>
                            Manage members and settings
                        </div>
                        <div>
                            <span className="mr-2 inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                                Member
                            </span>
                            Basic access to organization resources
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
