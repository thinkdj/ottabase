/**
 * Audit log (admin): who did what and when, as a timeline grouped by day. The filters live in the
 * URL, so a view can be shared, and the action and resource lists come from the rows themselves.
 */
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { useRBACToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import type { AuditLogRecord } from '@/types/rbac';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Chip, EmptyState, LoadingState } from '@ottabase/ui-components';
import { Button, Input, NativeSelect, NativeSelectOption } from '@ottabase/ui-shadcn';
import { downloadTextFile } from '@ottabase/utils/browser';
import { keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronDown, Download, ScrollText, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    auditCsv,
    auditQuery,
    auditSearch,
    clock,
    dayGroups,
    fullDate,
    humanizeAction,
    isDestructive,
    parseJson,
    shortId,
    summarize,
    type AuditLogsResponse,
    type AuditSearch,
    type AuditStatus,
} from './auditTimeline';

const PER_PAGE = 50;
/** Export pages through the API at its max page size, up to a sane cap */
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_ROWS = 5000;
const NO_LOGS: AuditLogRecord[] = [];
const MICRO = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const STATUS: Record<AuditStatus, { label: string; dot: string }> = {
    success: { label: 'Succeeded', dot: 'bg-success' },
    failure: { label: 'Failed', dot: 'bg-destructive' },
    error: { label: 'Errored', dot: 'bg-warning' },
};

export function AuditLogViewerPage() {
    const search = useSearch({ strict: false }) as AuditSearch;
    const navigate = useNavigate();
    const toast = useRBACToast();
    const page = search.page ?? 1;
    const query = auditQuery(search, page, PER_PAGE);
    const logs = useApiQuery<AuditLogsResponse>({
        entity: 'audit',
        queryKey: [query],
        endpoint: `/api/audit/logs?${query}`,
        queryOptions: { placeholderData: keepPreviousData, meta: { errorPresentation: 'local' } },
    });

    /** Changes the URL; a change of filter starts again at page 1 */
    const update = useCallback(
        (patch: Partial<AuditSearch>, replace = false) =>
            void navigate({
                search: (prev: AuditSearch) => auditSearch({ ...prev, page: undefined, ...patch }),
                replace,
            } as never),
        [navigate],
    );

    // The box follows the URL and the URL follows the box once typing pauses
    const q = search.q ?? '';
    const [draft, setDraft] = useState(q);
    useEffect(() => setDraft(q), [q]);
    useEffect(() => {
        if (draft === q) return;
        const timer = setTimeout(() => update({ q: draft || undefined }, true), 300);
        return () => clearTimeout(timer);
    }, [draft, q, update]);

    const [open, setOpen] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const rows = logs.data?.data ?? NO_LOGS;
    const pagination = logs.data?.pagination;
    const facets = logs.data?.facets;
    const groups = useMemo(() => dayGroups(rows), [rows]);
    const filtered = Boolean(search.q || search.action || search.type || search.status || search.user || search.org);

    /** Every row matching the filters as CSV, newest first, capped */
    const exportCsv = async () => {
        setExporting(true);
        try {
            const all: AuditLogRecord[] = [];
            for (let p = 1; all.length < EXPORT_MAX_ROWS; p++) {
                const res = await api<AuditLogsResponse>(`/api/audit/logs?${auditQuery(search, p, EXPORT_PAGE_SIZE)}`);
                all.push(...(res.data ?? []));
                if (!res.pagination || p >= res.pagination.totalPages) break;
            }
            if (!all.length) {
                toast.info('Nothing to export', 'No entries match the current filters');
                return;
            }
            const exported = all.slice(0, EXPORT_MAX_ROWS);
            downloadTextFile(
                auditCsv(exported),
                `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
                'text/csv;charset=utf-8',
            );
            toast.success(
                'Export ready',
                `${exported.length} entr${exported.length === 1 ? 'y' : 'ies'} saved as CSV${all.length >= EXPORT_MAX_ROWS ? ` (first ${EXPORT_MAX_ROWS})` : ''}`,
            );
        } catch {
            toast.error('Export failed', 'Could not load the audit log. Try again.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <ScrollText className="h-7 w-7 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Audit log</h1>
                    </div>
                    <p className="max-w-3xl text-muted-foreground">
                        Who did what and when, across the organizations you belong to. Click a person or an organization
                        to follow them.
                    </p>
                </div>
                <Button variant="outline" onClick={exportCsv} disabled={exporting} className="w-fit gap-2">
                    <Download className="h-4 w-4" />
                    {exporting ? 'Exporting' : 'Export CSV'}
                </Button>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Search email, action or resource"
                    aria-label="Search"
                    className="h-9 w-full bg-background text-sm sm:w-64"
                />
                <NativeSelect
                    size="sm"
                    aria-label="Action"
                    value={search.action ?? ''}
                    onChange={(e) => update({ action: e.target.value || undefined })}
                >
                    <NativeSelectOption value="">Any action</NativeSelectOption>
                    {facets?.actions.map((f) => (
                        <NativeSelectOption key={f.value} value={f.value}>
                            {humanizeAction(f.value)} ({f.count})
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
                <NativeSelect
                    size="sm"
                    aria-label="Resource"
                    value={search.type ?? ''}
                    onChange={(e) => update({ type: e.target.value || undefined })}
                >
                    <NativeSelectOption value="">Any resource</NativeSelectOption>
                    {facets?.resourceTypes.map((f) => (
                        <NativeSelectOption key={f.value} value={f.value}>
                            {f.value} ({f.count})
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
                <NativeSelect
                    size="sm"
                    aria-label="Status"
                    value={search.status ?? ''}
                    onChange={(e) => update({ status: (e.target.value || undefined) as AuditStatus | undefined })}
                >
                    <NativeSelectOption value="">Any status</NativeSelectOption>
                    {(Object.keys(STATUS) as AuditStatus[]).map((s) => (
                        <NativeSelectOption key={s} value={s}>
                            {STATUS[s].label}
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
                {search.user && (
                    <FilterChip label={`User ${shortId(search.user)}`} onRemove={() => update({ user: undefined })} />
                )}
                {search.org && (
                    <FilterChip label={`Org ${shortId(search.org)}`} onRemove={() => update({ org: undefined })} />
                )}
                {filtered && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() =>
                            update({
                                q: undefined,
                                action: undefined,
                                type: undefined,
                                status: undefined,
                                user: undefined,
                                org: undefined,
                            })
                        }
                    >
                        Clear
                    </Button>
                )}
                {pagination && (
                    <span className={`ml-auto ${MICRO}`}>
                        {pagination.total} {pagination.total === 1 ? 'entry' : 'entries'}
                    </span>
                )}
            </div>

            {logs.isError && <ApiErrorDisplay error={logs.error} onRetry={() => void logs.refetch()} />}

            {logs.isPending ? (
                <LoadingState count={8} height="h-12" />
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={<ScrollText />}
                    title={filtered ? 'Nothing matches these filters' : 'No activity yet'}
                    description={
                        filtered
                            ? 'Loosen the filters, or clear them.'
                            : 'What people do here will show up as it happens.'
                    }
                />
            ) : (
                <div className="space-y-6">
                    {groups.map((group) => (
                        <section key={group.key} aria-label={group.label}>
                            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                                {group.label}
                                <span className={MICRO}>{group.logs.length}</span>
                            </h2>
                            <ol>
                                {group.logs.map((log) => (
                                    <Entry
                                        key={log.id}
                                        log={log}
                                        open={open === log.id}
                                        onToggle={() => setOpen(open === log.id ? null : log.id)}
                                        onUser={search.user ? undefined : () => update({ user: log.user_id })}
                                        onOrg={
                                            search.org
                                                ? undefined
                                                : () => update({ org: log.organization_id ?? undefined })
                                        }
                                    />
                                ))}
                            </ol>
                        </section>
                    ))}
                    {pagination && pagination.totalPages > 1 && (
                        <nav className="flex items-center justify-between" aria-label="Pages">
                            <span className={MICRO}>
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => update({ page: page - 1 })}
                                >
                                    Newer
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= pagination.totalPages}
                                    onClick={() => update({ page: page + 1 })}
                                >
                                    Older
                                </Button>
                            </div>
                        </nav>
                    )}
                </div>
            )}
        </div>
    );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <Chip className="gap-1 normal-case tracking-normal">
            {label}
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${label} filter`}
                className="rounded-full hover:text-foreground"
            >
                <X className="h-3 w-3" />
            </button>
        </Chip>
    );
}

/** One row of the timeline: when, who, what, on which resource, and the details on demand */
function Entry({
    log,
    open,
    onToggle,
    onUser,
    onOrg,
}: {
    log: AuditLogRecord;
    open: boolean;
    onToggle: () => void;
    onUser?: () => void;
    onOrg?: () => void;
}) {
    const status = STATUS[log.status] ?? STATUS.error;
    const who = log.user_email || (log.user_id ? shortId(log.user_id) : '');
    const summary = summarize(log);
    const detailsId = `audit-${log.id}`;
    return (
        <li className="group flex gap-3">
            <time
                dateTime={new Date(log.created_at).toISOString()}
                title={fullDate(log.created_at)}
                className="w-[5.5rem] shrink-0 whitespace-nowrap pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground"
            >
                {clock(log.created_at)}
            </time>
            <div className="flex flex-col items-center">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} title={status.label} />
                <span className="w-px flex-1 bg-border/60 group-last:hidden" />
            </div>
            <div className="min-w-0 flex-1 pb-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="sr-only">{status.label}.</span>
                    {who ? (
                        onUser ? (
                            <button
                                type="button"
                                onClick={onUser}
                                title={`Only ${who}`}
                                className="max-w-[16rem] truncate font-medium hover:underline"
                            >
                                {who}
                            </button>
                        ) : (
                            <span className="max-w-[16rem] truncate font-medium">{who}</span>
                        )
                    ) : (
                        <span className="text-muted-foreground">System</span>
                    )}
                    <Chip className={isDestructive(log.action) ? 'text-destructive ring-destructive/30' : undefined}>
                        {humanizeAction(log.action)}
                    </Chip>
                    <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs">{log.resource_type}</code>
                    {log.resource_id && (
                        <span className="font-mono text-xs text-muted-foreground" title={log.resource_id}>
                            {shortId(log.resource_id)}
                        </span>
                    )}
                    {log.organization_id && onOrg && (
                        <button
                            type="button"
                            onClick={onOrg}
                            title={`Only organization ${log.organization_id}`}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                            org {shortId(log.organization_id)}
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    aria-controls={detailsId}
                    className="mt-0.5 flex max-w-full items-center gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
                >
                    <span className={`truncate ${log.status === 'success' ? '' : 'text-destructive'}`}>
                        {summary || 'Details'}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && <Details id={detailsId} log={log} />}
            </div>
        </li>
    );
}

function Details({ id, log }: { id: string; log: AuditLogRecord }) {
    const metadata = parseJson(log.metadata);
    const changes = parseJson(log.changes);
    return (
        <div id={id} className="mt-3 grid gap-4 rounded-xl bg-muted/40 p-4 text-sm md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
                <p className={MICRO}>Identifiers</p>
                <Field label="Log" value={log.id} mono />
                <Field label="User" value={log.user_id} mono />
                <Field label="Email" value={log.user_email} />
                <Field label="Org" value={log.organization_id} mono />
                <Field label="App" value={log.app_id} mono />
                <Field label="Resource" value={log.resource_id} mono />
            </div>
            <div className="space-y-1.5">
                <p className={MICRO}>Context</p>
                <Field label="Status" value={STATUS[log.status]?.label ?? log.status} />
                <Field label="Error" value={log.error_message} className="text-destructive" />
                <Field label="IP" value={log.ip_address} mono />
                <Field label="Agent" value={log.user_agent} className="text-xs" />
                <Field label="Time" value={fullDate(log.created_at)} />
            </div>
            <div className="space-y-1.5">
                {metadata && <Json label="Metadata" value={metadata} />}
                {changes && <Json label="Changes" value={changes} />}
            </div>
        </div>
    );
}

function Field({
    label,
    value,
    mono,
    className,
}: {
    label: string;
    value?: string | null;
    mono?: boolean;
    className?: string;
}) {
    if (!value) return null;
    return (
        <div className="flex gap-2 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
            <span className={`break-all ${mono ? 'font-mono' : ''} ${className ?? ''}`}>{value}</span>
        </div>
    );
}

function Json({ label, value }: { label: string; value: Record<string, unknown> }) {
    return (
        <>
            <p className={MICRO}>{label}</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background p-2 text-xs ring-1 ring-border">
                {JSON.stringify(value, null, 2)}
            </pre>
        </>
    );
}
