import { getTenantAdminNav } from '@/ottabase/config/admin-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';

/**
 * Tenant admin overview page.
 *
 * Renders cards driven by TENANT_ADMIN_NAV_GROUPS in
 * `apps/otta-web/src/ottabase/config/admin-nav.ts`. Adding a new tenant-admin
 * page = one entry in that file (the AdminLayout sidebar picks it up too).
 */
export function AdminIndexPage() {
    const groups = getTenantAdminNav();

    return (
        <div className="space-y-10 pb-20">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
                <p className="text-muted-foreground mt-2 max-w-3xl">
                    Everything you need to run your organization — content, access, security, and growth — in one place.
                </p>
            </div>

            {groups.map((group) => (
                <section key={group.id} className="space-y-4">
                    <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                        <group.icon className="h-4 w-4" />
                        {group.label}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {group.items.map((item) => (
                            <Link key={item.href} to={item.href} target={item.external ? '_blank' : undefined}>
                                <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                                    <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                                        <div className="p-2 bg-primary/10 rounded-full">
                                            <item.icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <CardTitle className="text-base">{item.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription>{item.description}</CardDescription>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
