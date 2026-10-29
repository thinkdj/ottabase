import { isOrgAdmin, isPlatformAdmin, useSession } from '@/lib/auth';
import { getEnabledAdminNav } from '@/ottabase/config/admin-nav';
import { SystemReadiness } from '@/pages/admin/SystemReadiness';
import { Card, CardDescription, CardHeader, CardTitle, PageHeader, PremiumMark } from '@ottabase/ui';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

/**
 * Admin Console overview page.
 *
 * Renders cards driven by the SSOT in `apps/otta-web/src/ottabase/config/admin-nav.ts`.
 * Adding a new admin page = one entry in that file (the AdminLayout sidebar
 * picks it up automatically too).
 */
export function AdminIndexPage() {
    const { user } = useSession();
    const groups = useMemo(
        () => getEnabledAdminNav({ isPlatformAdmin: isPlatformAdmin(user), isOrgAdmin: isOrgAdmin(user) }),
        [user],
    );

    return (
        <div className="flex flex-col gap-8 pb-20">
            <PageHeader
                title="Overview"
                description="Everything that keeps the platform running — identity, content, infrastructure, growth — in one place. Tenant-isolated, role-gated, and built for production operations."
            />

            {/* Platform admins see whether every setting, binding and probe is in place; org admins do not. */}
            {isPlatformAdmin(user) && <SystemReadiness />}

            {groups.map((group) => (
                <section key={group.id} className="flex flex-col gap-3">
                    <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        <group.icon className="size-3.5" />
                        {group.label}
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map((item) => (
                            <Link
                                key={item.href}
                                to={item.href}
                                target={item.external ? '_blank' : undefined}
                                aria-label={item.title}
                                className="group rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <Card className="h-full transition duration-fast ease-theme group-hover:border-input group-hover:shadow-sm">
                                    <CardHeader className="gap-2 pb-4">
                                        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition duration-fast ease-theme group-hover:text-foreground">
                                            <item.icon className="size-[18px]" />
                                        </span>
                                        <CardTitle className="flex items-center gap-1.5">
                                            {item.title}
                                            {item.premium && <PremiumMark iconOnly />}
                                            <ArrowRight className="ml-auto size-4 shrink-0 text-faint-foreground transition duration-fast ease-theme group-hover:translate-x-0.5 group-hover:text-foreground" />
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
