import { getEnabledAdminNav } from '@/ottabase/config/admin-nav';
import { Card, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

/**
 * Admin Console overview page.
 *
 * Renders cards driven by the SSOT in `apps/otta-web/src/ottabase/config/admin-nav.ts`.
 * Adding a new admin page = one entry in that file (the AdminLayout sidebar
 * picks it up automatically too).
 */
export function AdminIndexPage() {
    const groups = getEnabledAdminNav();

    return (
        <div className="space-y-8 pb-20">
            <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Admin Console</h1>
                <p className="max-w-3xl text-muted-foreground">
                    Everything that keeps the platform running — identity, content, infrastructure, growth — in one
                    place. Tenant-isolated, role-gated, and built for production operations.
                </p>
            </div>

            {groups.map((group) => (
                <section key={group.id} className="space-y-4">
                    <h2 className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        <group.icon className="h-3.5 w-3.5" />
                        {group.label}
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map((item) => (
                            <Link
                                key={item.href}
                                to={item.href}
                                target={item.external ? '_blank' : undefined}
                                className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <Card className="h-full rounded-xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal group-hover:bg-muted/70">
                                    <CardHeader className="gap-2">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border transition-colors group-hover:text-foreground">
                                            <item.icon className="h-[1.125rem] w-[1.125rem]" />
                                        </span>
                                        <CardTitle className="flex items-center gap-1.5 text-[0.9375rem] font-semibold">
                                            {item.title}
                                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-normal group-hover:translate-x-0.5 group-hover:text-foreground" />
                                        </CardTitle>
                                        <CardDescription className="line-clamp-2 leading-relaxed">
                                            {item.description}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
