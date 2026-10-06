/**
 * The admin overview: what needs a look, what happened lately, and where everything lives.
 * The section list comes from `ottabase/config/admin-nav.ts`, so a new admin page needs one entry there.
 */
import { timeAgo } from '@/hooks/useLastRefreshed';
import { StatList } from '@/components/admin/StatList';
import { isOrgAdmin, isPlatformAdmin, useSession } from '@/lib/auth';
import { getEnabledAdminNav } from '@/ottabase/config/admin-nav';
import { LoadingState } from '@ottabase/ui-components';
import { Link } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import { describeAuditEntry, useAdminOverview, type AttentionItem, type AttentionTone } from './adminOverview';

const SECTION_TITLE = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const DOT: Record<AttentionTone, string> = {
    destructive: 'bg-destructive',
    warning: 'bg-warning',
    info: 'bg-info',
};

export function AdminIndexPage() {
    const { user } = useSession();
    const platformAdmin = isPlatformAdmin(user);
    const groups = useMemo(
        () => getEnabledAdminNav({ isPlatformAdmin: platformAdmin, isOrgAdmin: isOrgAdmin(user) }),
        [platformAdmin, user],
    );
    const { attention, checking, glance, activity, activityLoading } = useAdminOverview({
        isPlatformAdmin: platformAdmin,
    });

    return (
        <div className="space-y-10 pb-20">
            <header className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Admin</h1>
                <p className="max-w-3xl text-muted-foreground">
                    What needs a look, what happened lately, and where everything lives.
                </p>
            </header>

            <section aria-labelledby="attention-title" className="space-y-3">
                <h2 id="attention-title" className={SECTION_TITLE}>
                    Needs attention
                </h2>
                {attention.length > 0 ? (
                    <ul className="grid gap-3 md:grid-cols-2">
                        {attention.map((item) => (
                            <AttentionCard key={item.key} item={item} />
                        ))}
                    </ul>
                ) : checking ? (
                    <LoadingState count={2} height="h-12" />
                ) : (
                    <p className="flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        All clear. Nothing is waiting on you.
                    </p>
                )}
            </section>

            <StatList stats={glance} />

            <section aria-labelledby="activity-title" className="space-y-3">
                <div className="flex items-baseline justify-between gap-4">
                    <h2 id="activity-title" className={SECTION_TITLE}>
                        Recent activity
                    </h2>
                    <Link
                        to="/admin/security/audit"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        All activity
                    </Link>
                </div>
                {activityLoading ? (
                    <LoadingState count={4} height="h-9" />
                ) : activity.length === 0 ? (
                    <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        Nothing recorded yet.
                    </p>
                ) : (
                    <ol className="divide-y divide-border/60 rounded-xl border border-border/60">
                        {activity.map((entry) => (
                            <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                                <span className={entry.status === 'success' ? '' : 'text-destructive'}>
                                    {describeAuditEntry(entry)}
                                </span>
                                <time className="shrink-0 text-xs text-muted-foreground">
                                    {timeAgo(entry.created_at)}
                                </time>
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            <section aria-labelledby="sections-title" className="space-y-6">
                <h2 id="sections-title" className={SECTION_TITLE}>
                    Everything else
                </h2>
                {groups.map((group) => (
                    <div key={group.id} className="space-y-2">
                        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                            <group.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            {group.label}
                        </h3>
                        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                            {group.items.map((item) => (
                                <li key={item.href}>
                                    <Link
                                        to={item.href}
                                        target={item.external ? '_blank' : undefined}
                                        className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <item.icon
                                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium">{item.title}</span>
                                            <span className="line-clamp-1 block text-xs text-muted-foreground">
                                                {item.description}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </section>
        </div>
    );
}

function AttentionCard({ item }: { item: AttentionItem }) {
    return (
        <li className="rounded-xl border border-border/60 p-4">
            <Link
                to={item.href as never}
                search={item.search as never}
                className="group flex items-start gap-3 outline-none"
            >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[item.tone]}`} aria-hidden="true" />
                <span className="flex-1 font-medium group-hover:underline">{item.label}</span>
                <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                />
            </Link>
            {item.details && item.details.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm">
                    {item.details.map((detail) => (
                        <li key={detail.key}>
                            {detail.href ? (
                                <Link
                                    to={detail.href as never}
                                    className="line-clamp-1 text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {detail.text}
                                </Link>
                            ) : (
                                <span className="line-clamp-1 text-muted-foreground">{detail.text}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}
