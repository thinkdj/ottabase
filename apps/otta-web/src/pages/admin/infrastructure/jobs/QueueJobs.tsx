/**
 * Queue jobs: the dead-letter queue first, because that is where the retry button is, then what
 * failed and what ran lately, and the totals per job type.
 */
import { timeAgo } from '@/hooks/useLastRefreshed';
import { isApiError } from '@ottabase/api';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import { Chip, ConfirmDialog } from '@ottabase/ui-components';
import { useDataTable } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable } from '@ottabase/ui-datatable/react';
import { Alert, Button, Sheet, SheetContent, SheetHeader, SheetTitle, toast } from '@ottabase/ui-shadcn';
import { AlertTriangle, CheckCircle2, Inbox, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { utcStamp } from './schedule';
import type { DeadLetterJob, DeadLetterPage, JobTypeStat, ProcessedJob, QueueOverview } from './types';

const NO_JOBS: DeadLetterJob[] = [];
const NO_RUNS: ProcessedJob[] = [];
const errorText = (err: unknown, fallback: string) => (isApiError(err) ? err.message : fallback);
const local = { meta: { errorPresentation: 'local' as const } };

export function QueueJobs() {
    const overview = useApiQuery<QueueOverview>({
        entity: 'queues',
        queryKey: ['overview'],
        endpoint: '/api/admin/queues',
        queryOptions: { refetchInterval: 10_000, ...local },
    });
    const deadLetters = useApiQuery<DeadLetterPage>({
        entity: 'queues',
        queryKey: ['dlq'],
        endpoint: '/api/admin/queues/dlq?limit=100',
        queryOptions: local,
    });
    const failed = useApiQuery<{ jobs: ProcessedJob[] }>({
        entity: 'queues',
        queryKey: ['failed'],
        endpoint: '/api/admin/queues/failed',
        queryOptions: local,
    });
    const processed = useApiQuery<{ jobs: ProcessedJob[] }>({
        entity: 'queues',
        queryKey: ['processed'],
        endpoint: '/api/admin/queues/processed',
        queryOptions: local,
    });

    const [openJob, setOpenJob] = useState<DeadLetterJob | null>(null);
    const [confirm, setConfirm] = useState<'retry-all' | 'purge' | 'reset' | DeadLetterJob | null>(null);

    const retry = useApiMutation<unknown, string>({
        endpoint: (id) => `/api/admin/queues/dlq/${id}/retry`,
        method: 'POST',
        invalidateEntities: ['queues'],
        mutationOptions: local,
    });
    const remove = useApiMutation<unknown, string>({
        endpoint: (id) => `/api/admin/queues/dlq/${id}`,
        method: 'DELETE',
        invalidateEntities: ['queues'],
        mutationOptions: local,
    });
    const retryAll = useApiMutation<{ success: number; failed: number }>({
        endpoint: '/api/admin/queues/dlq/retry-all',
        method: 'POST',
        invalidateEntities: ['queues'],
        mutationOptions: local,
    });
    const purge = useApiMutation<{ deleted: number }>({
        endpoint: '/api/admin/queues/dlq',
        method: 'DELETE',
        invalidateEntities: ['queues'],
        mutationOptions: local,
    });
    const resetStats = useApiMutation({
        endpoint: '/api/admin/queues/reset-stats',
        method: 'POST',
        invalidateEntities: ['queues'],
        mutationOptions: local,
    });

    const retryJob = async (job: DeadLetterJob) => {
        try {
            await retry.mutateAsync(job.id);
            toast.success(`${job.type} queued again`);
            if (openJob?.id === job.id) setOpenJob(null);
        } catch (err) {
            toast.error(errorText(err, 'Could not retry the job'));
        }
    };
    const runConfirmed = async () => {
        const action = confirm;
        setConfirm(null);
        try {
            if (action === 'retry-all') {
                const result = await retryAll.mutateAsync({});
                toast.success(
                    `${result.success} jobs queued again${result.failed ? `, ${result.failed} could not be` : ''}`,
                );
            } else if (action === 'purge') {
                const result = await purge.mutateAsync({});
                toast.success(`${result.deleted} jobs removed`);
            } else if (action === 'reset') {
                await resetStats.mutateAsync({});
                toast.success('Statistics reset');
            } else if (action) {
                await remove.mutateAsync(action.id);
                toast.success(`${action.type} removed`);
                if (openJob?.id === action.id) setOpenJob(null);
            }
        } catch (err) {
            toast.error(errorText(err, 'That did not work'));
        }
    };

    const stats = overview.data?.stats;
    const total = (stats?.totalProcessed ?? 0) + (stats?.totalFailed ?? 0);
    const successRate = stats && total > 0 ? Math.round((stats.totalProcessed / total) * 1000) / 10 : null;
    const byType = useMemo<JobTypeStat[]>(
        () => Object.entries(stats?.byJobType ?? {}).map(([type, counts]) => ({ type, ...counts })),
        [stats],
    );

    const dlqColumns = useMemo(
        () => [
            ...createColumns<DeadLetterJob>([
                { key: 'type', header: 'Job', cell: ({ row }) => <JobCell type={row.type} id={row.id} /> },
                {
                    key: 'failedAt',
                    header: 'Failed',
                    width: 120,
                    cell: ({ row }) => <span title={utcStamp(row.failedAt)}>{timeAgo(row.failedAt)}</span>,
                },
                { key: 'attempts', header: 'Attempts', width: 100, align: 'right' },
                {
                    key: 'error',
                    header: 'Error',
                    cell: ({ row }) => (
                        <span className="line-clamp-1 max-w-[24rem] text-destructive" title={row.error}>
                            {row.error}
                        </span>
                    ),
                },
            ]),
            actionsColumn<DeadLetterJob>([
                { label: 'Retry', icon: RotateCcw, onClick: (job) => void retryJob(job) },
                { label: 'Remove', icon: Trash2, variant: 'destructive', onClick: setConfirm },
            ]),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const runColumns = useMemo(
        () =>
            createColumns<ProcessedJob>([
                { key: 'type', header: 'Job', cell: ({ row }) => <JobCell type={row.type} id={row.id} /> },
                {
                    key: 'processedAt',
                    header: 'When',
                    width: 120,
                    cell: ({ row }) => <span title={utcStamp(row.processedAt)}>{timeAgo(row.processedAt)}</span>,
                },
                { key: 'attempts', header: 'Attempts', width: 100, align: 'right' },
                {
                    key: 'duration',
                    header: 'Took',
                    width: 100,
                    align: 'right',
                    cell: ({ row }) => (row.duration ? `${row.duration} ms` : ''),
                },
                {
                    key: 'error',
                    header: 'Error',
                    cell: ({ row }) =>
                        row.error ? (
                            <span className="line-clamp-1 max-w-[24rem] text-destructive" title={row.error}>
                                {row.error}
                            </span>
                        ) : null,
                },
            ]),
        [],
    );
    const typeColumns = useMemo(
        () =>
            createColumns<JobTypeStat>([
                { key: 'type', header: 'Job type', cell: ({ row }) => <code className="text-xs">{row.type}</code> },
                { key: 'dispatched', header: 'Dispatched', align: 'right', width: 120 },
                { key: 'processed', header: 'Processed', align: 'right', width: 120 },
                {
                    key: 'failed',
                    header: 'Failed',
                    align: 'right',
                    width: 120,
                    cell: ({ row }) => <span className={row.failed ? 'text-destructive' : ''}>{row.failed}</span>,
                },
            ]),
        [],
    );

    const dlqRows = deadLetters.data?.jobs ?? NO_JOBS;
    const dlqTable = useDataTable<DeadLetterJob>({ data: dlqRows, columns: dlqColumns, initialPageSize: 25 });
    const failedTable = useDataTable<ProcessedJob>({
        data: failed.data?.jobs ?? NO_RUNS,
        columns: runColumns,
        initialPageSize: 10,
    });
    const processedTable = useDataTable<ProcessedJob>({
        data: processed.data?.jobs?.filter((job) => job.status === 'completed') ?? NO_RUNS,
        columns: runColumns,
        initialPageSize: 10,
    });
    const typeTable = useDataTable<JobTypeStat>({
        data: byType,
        columns: typeColumns,
        getRowId: (row) => row.type,
        enablePagination: false,
    });
    const busy = retry.isPending || remove.isPending || retryAll.isPending || purge.isPending;

    return (
        <div className="space-y-10">
            <div className="space-y-4">
                {overview.data && (
                    <p className="flex items-center gap-2 text-sm">
                        {overview.data.queueBinding === 'configured' ? (
                            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                        ) : (
                            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                        )}
                        {overview.data.queueBinding === 'configured'
                            ? `Queue connected. ${overview.data.pendingCount.toLocaleString()} ${overview.data.pendingCount === 1 ? 'message' : 'messages'} waiting.`
                            : 'No queue binding, so nothing is processed. Add one in wrangler.jsonc.'}
                    </p>
                )}
                {overview.error && <Alert variant="destructive">{overview.error.message}</Alert>}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <dl className="flex flex-wrap gap-x-8 gap-y-3">
                        <Stat label="Dispatched" value={stats?.totalDispatched} />
                        <Stat label="Processed" value={stats?.totalProcessed} />
                        <Stat
                            label="Failed"
                            value={stats?.totalFailed}
                            tone={stats?.totalFailed ? 'destructive' : undefined}
                        />
                        <Stat
                            label="Dead-letter"
                            value={stats?.totalDLQ}
                            tone={stats?.totalDLQ ? 'warning' : undefined}
                        />
                        {successRate !== null && <Stat label="Success rate" value={`${successRate}%`} />}
                    </dl>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        onClick={() => setConfirm('reset')}
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset statistics
                    </Button>
                </div>
            </div>

            <section aria-labelledby="dlq-title" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 id="dlq-title" className="text-[0.9375rem] font-semibold">
                            Dead-letter queue
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Jobs that failed every retry. They stay seven days; retry them or let them go.
                        </p>
                    </div>
                    {dlqRows.length > 0 && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={busy}
                                onClick={() => setConfirm('retry-all')}
                            >
                                <RotateCcw className="h-4 w-4" />
                                Retry all
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-destructive hover:text-destructive"
                                disabled={busy}
                                onClick={() => setConfirm('purge')}
                            >
                                <Trash2 className="h-4 w-4" />
                                Remove all
                            </Button>
                        </div>
                    )}
                </div>
                <DataTable
                    table={dlqTable.table}
                    isLoading={deadLetters.isLoading}
                    onRowClick={setOpenJob}
                    emptyIcon={Inbox}
                    emptyMessage="Nothing here. Every job got through."
                    showColumnVisibility={false}
                />
                {deadLetters.data?.hasMore && (
                    <p className="text-xs text-muted-foreground">
                        Showing the first 100. Retry or remove some to see more.
                    </p>
                )}
            </section>

            <section aria-labelledby="failed-title" className="space-y-3">
                <h2 id="failed-title" className="text-[0.9375rem] font-semibold">
                    Recently failed
                </h2>
                <DataTable
                    table={failedTable.table}
                    isLoading={failed.isLoading}
                    emptyIcon={XCircle}
                    emptyMessage="No failures lately."
                    showColumnVisibility={false}
                    showSearch={false}
                />
            </section>

            <section aria-labelledby="processed-title" className="space-y-3">
                <h2 id="processed-title" className="text-[0.9375rem] font-semibold">
                    Recently processed
                </h2>
                <DataTable
                    table={processedTable.table}
                    isLoading={processed.isLoading}
                    emptyIcon={CheckCircle2}
                    emptyMessage="Nothing processed in the last day."
                    showColumnVisibility={false}
                    showSearch={false}
                />
            </section>

            {byType.length > 0 && (
                <section aria-labelledby="types-title" className="space-y-3">
                    <h2 id="types-title" className="text-[0.9375rem] font-semibold">
                        By job type
                    </h2>
                    <DataTable
                        table={typeTable.table}
                        showColumnVisibility={false}
                        showSearch={false}
                        showPagination={false}
                    />
                </section>
            )}

            <Sheet open={openJob !== null} onOpenChange={(open) => !open && setOpenJob(null)}>
                <SheetContent
                    side="right"
                    className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
                    aria-describedby={undefined}
                >
                    <SheetHeader className="border-b border-border px-6 py-4 text-left">
                        <SheetTitle>{openJob?.type}</SheetTitle>
                    </SheetHeader>
                    {openJob && (
                        <div className="flex flex-1 flex-col">
                            <div className="flex-1 space-y-5 px-6 py-5 text-sm">
                                <p className="text-muted-foreground">
                                    <code className="text-xs">{openJob.id}</code>. Failed {timeAgo(openJob.failedAt)}{' '}
                                    after {openJob.attempts} {openJob.attempts === 1 ? 'attempt' : 'attempts'}.
                                </p>
                                <pre className="overflow-auto rounded-lg border border-destructive/40 bg-destructive/10 p-3 font-mono text-xs text-destructive">
                                    {openJob.error}
                                </pre>
                                <div>
                                    <h3 className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Payload
                                    </h3>
                                    <pre className="overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
                                        {JSON.stringify(openJob.payload, null, 2)}
                                    </pre>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
                                <Button
                                    variant="ghost"
                                    className="gap-2 text-destructive hover:text-destructive"
                                    onClick={() => setConfirm(openJob)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Remove
                                </Button>
                                <Button onClick={() => void retryJob(openJob)} disabled={busy} className="gap-2">
                                    <RotateCcw className="h-4 w-4" />
                                    Retry
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={confirm !== null}
                onOpenChange={(open) => !open && setConfirm(null)}
                title={
                    confirm === 'retry-all'
                        ? 'Retry every dead-letter job?'
                        : confirm === 'purge'
                          ? 'Remove every dead-letter job?'
                          : confirm === 'reset'
                            ? 'Reset the statistics?'
                            : 'Remove this job?'
                }
                description={
                    confirm === 'retry-all'
                        ? 'Each one goes back on the queue and runs again.'
                        : confirm === 'purge'
                          ? 'They are gone for good, payloads included.'
                          : confirm === 'reset'
                            ? 'The counters start again from zero. Jobs themselves are untouched.'
                            : 'The job and its payload are gone for good.'
                }
                tone={confirm === 'retry-all' ? 'default' : 'destructive'}
                secondaryActionText="Cancel"
                primaryActionText={confirm === 'retry-all' ? 'Retry all' : confirm === 'reset' ? 'Reset' : 'Remove'}
                onConfirm={runConfirmed}
            />
        </div>
    );
}

function Stat({
    label,
    value,
    tone,
}: {
    label: string;
    value: number | string | undefined;
    tone?: 'destructive' | 'warning';
}) {
    const color = tone === 'destructive' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : '';
    return (
        <div>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={`text-2xl font-semibold tabular-nums ${color}`}>
                {value === undefined ? '' : typeof value === 'number' ? value.toLocaleString() : value}
            </dd>
        </div>
    );
}

function JobCell({ type, id }: { type: string; id: string }) {
    return (
        <span className="block min-w-[10rem]">
            <span className="flex items-center gap-2">
                <code className="text-sm font-medium">{type}</code>
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">{id}</span>
        </span>
    );
}

export { Chip as JobChip };
