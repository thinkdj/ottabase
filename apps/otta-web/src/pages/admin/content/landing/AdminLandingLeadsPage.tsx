// /admin/content/landing/leads — what visitors sent through the landing site's contact and
// signup sections: read, reply, mark, delete, export.

import { getErrorMessage } from '@/lib/api';
import type { LeadData, LeadKind } from '@ottabase/ottalanding';
import { Badge, Button, ConfirmDialog } from '@ottabase/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, Download, Inbox, Mail, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LEADS_QUERY_KEY, leadsApi, useLanding, useLeads } from './landingApi';

const FILTERS: { kind?: LeadKind; label: string }[] = [
    { label: 'All' },
    { kind: 'contact', label: 'Messages' },
    { kind: 'signup', label: 'Signups' },
];

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function AdminLandingLeadsPage() {
    const [kind, setKind] = useState<LeadKind>();
    const leads = useLeads(kind);
    const { data: landing } = useLanding();
    const first = leads.data?.pages[0];
    const items = leads.data?.pages.flatMap((p) => p.leads) ?? [];

    const exportCsv = useMutation({
        mutationFn: () => leadsApi.csv(kind),
        onSuccess: (blob) => {
            const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(blob),
                download: `form-entries-${new Date().toISOString().slice(0, 10)}.csv`,
            });
            a.click();
            URL.revokeObjectURL(a.href);
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1">
                    <Link
                        to="/admin/content/landing"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                        Landing site
                    </Link>
                    <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-[-0.015em]">
                        Form entries
                        {first?.unread ? <Badge>{first.unread} new</Badge> : null}
                    </h1>
                    <p className="text-muted-foreground">Messages and signups from your landing site’s forms.</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => exportCsv.mutate()}
                    disabled={!first?.total || exportCsv.isPending}
                >
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                    Export CSV
                </Button>
            </div>

            {landing && !landing.site.leadEmail && (
                <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
                    Want an email when someone writes? Add an address under <strong>Email new form entries to</strong>{' '}
                    in the{' '}
                    <Link to="/admin/content/landing" className="font-medium underline underline-offset-4">
                        site settings
                    </Link>
                    .
                </p>
            )}

            <div role="radiogroup" aria-label="Show" className="inline-flex rounded-lg border border-border p-1">
                {FILTERS.map((f) => (
                    <button
                        key={f.label}
                        type="button"
                        role="radio"
                        aria-checked={kind === f.kind}
                        onClick={() => setKind(f.kind)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === f.kind ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {leads.isLoading ? (
                <div className="h-48 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />
            ) : leads.error ? (
                <div className="rounded-xl border border-border p-8 text-center">
                    <p className="font-medium">The entries couldn’t be loaded.</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(leads.error)}</p>
                    <Button className="mt-4" variant="outline" onClick={() => leads.refetch()}>
                        Try again
                    </Button>
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center">
                    <Inbox className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                    <p className="mt-3 font-medium">Nothing here yet</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                        Add a <strong>Contact form</strong> or <strong>Email signup</strong> section to a page, and what
                        visitors send shows up here.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {items.map((lead) => (
                        <LeadRow key={lead.id} lead={lead} />
                    ))}
                </ul>
            )}

            {leads.hasNextPage && (
                <div className="text-center">
                    <Button variant="outline" onClick={() => leads.fetchNextPage()} disabled={leads.isFetchingNextPage}>
                        {leads.isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function LeadRow({ lead }: { lead: LeadData }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const refresh = () => queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY });
    const setRead = useMutation({
        mutationFn: (read: boolean) => leadsApi.setRead(lead.id, read),
        onSuccess: refresh,
        onError: (err) => toast.error(getErrorMessage(err)),
    });
    const remove = useMutation({
        mutationFn: () => leadsApi.remove(lead.id),
        onSuccess: () => {
            toast.success('Entry deleted');
            refresh();
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });
    const isSignup = lead.kind === 'signup';
    const reply = `mailto:${encodeURIComponent(lead.email)}${isSignup ? '' : `?subject=${encodeURIComponent('Re: your message')}`}`;

    const toggle = () => {
        setOpen((o) => !o);
        // Opening an entry reads it.
        if (!open && !lead.read) setRead.mutate(true);
    };

    return (
        <li className={lead.read ? '' : 'bg-primary/5'}>
            <div className="flex items-start gap-3 px-4 py-3.5">
                <span
                    className={`mt-2 h-2 w-2 shrink-0 rounded-full ${lead.read ? 'bg-transparent' : 'bg-primary'}`}
                    aria-hidden
                />
                <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`truncate ${lead.read ? '' : 'font-semibold'}`}>
                            {isSignup ? lead.email : lead.name}
                        </span>
                        {!isSignup && <span className="truncate text-sm text-muted-foreground">{lead.email}</span>}
                        <Badge variant="secondary">{isSignup ? 'Signup' : 'Message'}</Badge>
                        {!lead.read && <span className="sr-only">(new)</span>}
                    </span>
                    {lead.message && (
                        <span
                            className={`mt-1 block text-sm text-muted-foreground ${open ? 'whitespace-pre-wrap' : 'line-clamp-1'}`}
                        >
                            {lead.message}
                        </span>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground">
                        {when(lead.createdAt)} · {lead.pagePath}
                    </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                    <Button asChild variant="ghost" size="sm">
                        <a href={reply}>
                            <Mail className="mr-1.5 h-4 w-4" aria-hidden />
                            Reply
                        </a>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={setRead.isPending}
                        onClick={() => setRead.mutate(!lead.read)}
                    >
                        {lead.read ? 'Mark unread' : 'Mark read'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirming(true)}
                        aria-label={`Delete entry from ${lead.email}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title="Delete this entry?"
                description={`The ${isSignup ? 'signup' : 'message'} from ${lead.email} will be removed. This can’t be undone.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={() => {
                    remove.mutate();
                    setConfirming(false);
                }}
            />
        </li>
    );
}
