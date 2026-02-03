import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Key, Shield, Users } from 'lucide-react';

export function RBACAdminPage() {
    const rbacLinks = [
        {
            title: 'Roles Management',
            description: 'Create and manage roles with custom permissions',
            href: '/admin/rbac/roles',
            icon: Shield,
            disabled: false,
        },
        {
            title: 'User Roles Assignment',
            description: 'Assign roles to users and manage access control',
            href: '/admin/rbac/user-roles',
            icon: Users,
            disabled: true, // Can be implemented later
        },
        {
            title: 'Permissions Matrix',
            description: 'View and manage the complete permissions matrix across the hierarchy',
            href: '/admin/rbac/permissions',
            icon: Key,
            disabled: false,
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">RBAC Administration</h1>
                <p className="text-muted-foreground mt-2">
                    Role-Based Access Control management for multi-tenant organizations
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rbacLinks.map((item) => {
                    const Icon = item.icon;
                    const content = (
                        <Card
                            className={`group transition-all ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:border-primary/50 cursor-pointer'}`}
                        >
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{item.title}</CardTitle>
                                        {item.disabled && (
                                            <span className="text-xs text-muted-foreground">(Coming Soon)</span>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-sm">{item.description}</CardDescription>
                            </CardContent>
                        </Card>
                    );

                    if (item.disabled) {
                        return <div key={item.title}>{content}</div>;
                    }

                    return (
                        <Link key={item.title} to={item.href} className="block">
                            {content}
                        </Link>
                    );
                })}
            </div>

            {/* Quick Stats */}
            <Card>
                <CardHeader>
                    <CardTitle>RBAC Overview</CardTitle>
                    <CardDescription>Quick statistics about your RBAC configuration</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">System Roles</p>
                            <p className="text-3xl font-bold">3</p>
                            <p className="text-xs text-muted-foreground">owner, admin, member</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Custom Roles</p>
                            <p className="text-3xl font-bold">-</p>
                            <p className="text-xs text-muted-foreground">Create custom roles as needed</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Permission Format</p>
                            <p className="text-xl font-mono">resource:action</p>
                            <p className="text-xs text-muted-foreground">e.g., users:read, posts:write</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Documentation */}
            <Card>
                <CardHeader>
                    <CardTitle>RBAC Architecture</CardTitle>
                    <CardDescription>Understanding the multi-tenant RBAC hierarchy</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h3 className="font-semibold mb-2">Hierarchy</h3>
                        <div className="space-y-1 text-sm">
                            <p>🏢 <strong>Tenant (Organization)</strong> → Top level isolation</p>
                            <p className="ml-6">📱 <strong>App</strong> → Application scope (optional)</p>
                            <p className="ml-12">👤 <strong>User + Role</strong> → Permission enforcement</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2">Key Features</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                            <li>Per-organization cache versioning (O(1) invalidation)</li>
                            <li>Cloudflare KV caching with Result pattern</li>
                            <li>Request-level in-memory cache</li>
                            <li>Tenant isolation enforced at all levels</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2">Default Roles</h3>
                        <div className="space-y-2 text-sm">
                            <div>
                                <strong>Owner:</strong> Full control over organization
                            </div>
                            <div>
                                <strong>Admin:</strong> Manage members and settings
                            </div>
                            <div>
                                <strong>Member:</strong> Basic access to organization resources
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
