import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@ottabase/ui-shadcn';
import { api, isApiError } from '@/lib/api';
import {
    ArrowLeft,
    RefreshCw,
    Clock,
    CheckCircle,
    XCircle,
    Activity,
    Layers,
    RotateCcw,
    AlertTriangle,
    Play,
    Trash2,
} from 'lucide-react';

interface QueueStats {
    totalDispatched: number;
    totalProcessed: number;
    totalFailed: number;
    totalDLQ: number;
    byJobType: Record<string, { dispatched: number; processed: number; failed: number }>;
    lastUpdated: number;
}

interface QueueOverview {
    stats: QueueStats;
    pendingCount: number;
    registeredHandlers: Array<{ type: string; description: string }>;
    queueBinding: string;
}

interface ProcessedJob {
    id: string;
    type: string;
    status: 'completed' | 'failed';
    processedAt: number;
    duration?: number;
    error?: string;
    attempts: number;
}

interface PendingJob {
    key: string;
    action?: string;
    userId?: string;
    data?: unknown;
    sentAt: number;
    type: 'single' | 'batch';
}

interface DLQJob {
    id: string;
    type: string;
    payload: unknown;
    error: string;
    failedAt: number;
    attempts: number;
}

interface PaginatedDLQResult {
    jobs: DLQJob[];
    cursor?: string;
    hasMore: boolean;
}

type TabType = 'overview' | 'pending' | 'processed' | 'failed' | 'dlq';

const MICRO_LABEL = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const STATUS_CHIP =
    'inline-flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border';

export function AdminQueuePage() {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isResetting, setIsResetting] = useState(false);
    const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
    const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
    const [isRetryingAll, setIsRetryingAll] = useState(false);
    const [isPurgingDLQ, setIsPurgingDLQ] = useState(false);
    const [resetStatsDialog, setResetStatsDialog] = useState(false);
    const [deleteJobDialog, setDeleteJobDialog] = useState<string | null>(null);
    const [retryAllDialog, setRetryAllDialog] = useState(false);
    const [purgeDLQDialog, setPurgeDLQDialog] = useState(false);
    const [alertDialog, setAlertDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
    }>({ open: false, title: '', message: '' });
    // Fetch queue overview
    const {
        data: overview,
        isLoading: loadingOverview,
        refetch: refetchOverview,
    } = useQuery({
        queryKey: ['admin', 'queues', 'overview'],
        queryFn: () => api<QueueOverview>('/api/admin/queues'),
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    // Fetch pending jobs
    const { data: pendingData, isLoading: loadingPending } = useQuery({
        queryKey: ['admin', 'queues', 'pending'],
        queryFn: () => api<{ jobs: PendingJob[] }>('/api/admin/queues/pending'),
        enabled: activeTab === 'pending',
    });

    // Fetch processed jobs
    const { data: processedData, isLoading: loadingProcessed } = useQuery({
        queryKey: ['admin', 'queues', 'processed'],
        queryFn: () => api<{ jobs: ProcessedJob[] }>('/api/admin/queues/processed'),
        enabled: activeTab === 'processed',
    });

    // Fetch failed jobs
    const { data: failedData, isLoading: loadingFailed } = useQuery({
        queryKey: ['admin', 'queues', 'failed'],
        queryFn: () => api<{ jobs: ProcessedJob[] }>('/api/admin/queues/failed'),
        enabled: activeTab === 'failed',
    });

    // Fetch DLQ jobs
    const {
        data: dlqData,
        isLoading: loadingDLQ,
        refetch: refetchDLQ,
    } = useQuery({
        queryKey: ['admin', 'queues', 'dlq'],
        queryFn: () => api<PaginatedDLQResult>('/api/admin/queues/dlq?limit=100'),
        enabled: activeTab === 'dlq',
    });

    const resetStatsMutation = useApiMutation({
        endpoint: '/api/admin/queues/reset-stats',
        method: 'POST',
        invalidateKeys: [['admin', 'queues']],
        mutationOptions: {
            onSuccess: () => {
                setIsResetting(false);
                setResetStatsDialog(false);
            },
            onError: (err) => {
                setIsResetting(false);
                setResetStatsDialog(false);
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: isApiError(err) ? err.message : 'Failed to reset stats',
                });
            },
        },
    });

    const retryJobMutation = useApiMutation<unknown, string>({
        endpoint: (jobId) => `/api/admin/queues/dlq/${jobId}/retry`,
        method: 'POST',
        invalidateKeys: [['admin', 'queues']],
        mutationOptions: {
            onSuccess: () => setRetryingJobId(null),
            onError: (err) => {
                setRetryingJobId(null);
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: isApiError(err) ? err.message : 'Failed to retry job',
                });
            },
        },
    });

    const deleteJobMutation = useApiMutation<unknown, string>({
        endpoint: (jobId) => `/api/admin/queues/dlq/${jobId}`,
        method: 'DELETE',
        invalidateKeys: [['admin', 'queues']],
        mutationOptions: {
            onSuccess: () => {
                setDeletingJobId(null);
                setDeleteJobDialog(null);
            },
            onError: (err) => {
                setDeletingJobId(null);
                setDeleteJobDialog(null);
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: isApiError(err) ? err.message : 'Failed to delete job',
                });
            },
        },
    });

    const retryAllMutation = useApiMutation<{ success: number; failed: number }>({
        endpoint: '/api/admin/queues/dlq/retry-all',
        method: 'POST',
        invalidateKeys: [['admin', 'queues']],
        mutationOptions: {
            onSuccess: (result) => {
                setIsRetryingAll(false);
                setRetryAllDialog(false);
                setAlertDialog({
                    open: true,
                    title: 'Success',
                    message: `Retried ${result.success} jobs. ${result.failed} failed.`,
                });
            },
            onError: (err) => {
                setIsRetryingAll(false);
                setRetryAllDialog(false);
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: isApiError(err) ? err.message : 'Failed to retry jobs',
                });
            },
        },
    });

    const purgeDLQMutation = useApiMutation<{ deleted: number }>({
        endpoint: '/api/admin/queues/dlq',
        method: 'DELETE',
        invalidateKeys: [['admin', 'queues']],
        mutationOptions: {
            onSuccess: (result) => {
                setIsPurgingDLQ(false);
                setPurgeDLQDialog(false);
                setAlertDialog({ open: true, title: 'Success', message: `Deleted ${result.deleted} jobs from DLQ.` });
            },
            onError: (err) => {
                setIsPurgingDLQ(false);
                setPurgeDLQDialog(false);
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: isApiError(err) ? err.message : 'Failed to purge DLQ',
                });
            },
        },
    });

    const handleResetStats = () => setResetStatsDialog(true);
    const handleConfirmResetStats = () => {
        setIsResetting(true);
        resetStatsMutation.mutate({});
    };

    const handleRetryJob = (jobId: string) => {
        setRetryingJobId(jobId);
        retryJobMutation.mutate(jobId);
    };
    const handleDeleteJob = (jobId: string) => setDeleteJobDialog(jobId);
    const handleConfirmDeleteJob = () => {
        if (!deleteJobDialog) return;
        setDeletingJobId(deleteJobDialog);
        deleteJobMutation.mutate(deleteJobDialog);
    };

    const handleRetryAll = () => setRetryAllDialog(true);
    const handleConfirmRetryAll = () => {
        setIsRetryingAll(true);
        retryAllMutation.mutate({});
    };

    const handlePurgeDLQ = () => setPurgeDLQDialog(true);
    const handleConfirmPurgeDLQ = () => {
        setIsPurgingDLQ(true);
        purgeDLQMutation.mutate({});
    };

    const stats = overview?.stats;
    const successRate =
        stats && stats.totalProcessed > 0
            ? ((stats.totalProcessed / (stats.totalProcessed + stats.totalFailed)) * 100).toFixed(1)
            : '0';

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Admin
                    </Link>
                </Button>

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Queue Management</h1>
                        <p className="max-w-3xl text-muted-foreground">Monitor and manage background job queues</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-muted-foreground"
                            onClick={() => refetchOverview()}
                            disabled={loadingOverview}
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingOverview ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-muted-foreground"
                            onClick={handleResetStats}
                            disabled={isResetting}
                        >
                            <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                            Reset Stats
                        </Button>
                    </div>
                </div>
            </div>

            {/* Status Banner */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardContent className="flex items-center gap-3 py-3">
                    {overview?.queueBinding === 'configured' ? (
                        <>
                            <CheckCircle className="h-5 w-5 text-success" />
                            <span className="text-sm">Queue binding is configured and operational</span>
                        </>
                    ) : (
                        <>
                            <Clock className="h-5 w-5 text-warning" />
                            <span className="text-sm">Queue binding not configured - jobs will not be processed</span>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Total Dispatched</CardDescription>
                        <CardTitle className="text-2xl font-semibold">{stats?.totalDispatched ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Jobs sent to queue</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Processed</CardDescription>
                        <CardTitle className="text-2xl font-semibold text-success">
                            {stats?.totalProcessed ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Successfully completed</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Failed</CardDescription>
                        <CardTitle className="text-2xl font-semibold text-destructive">
                            {stats?.totalFailed ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Failed after retries</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Dead Letter Queue</CardDescription>
                        <CardTitle className="text-2xl font-semibold text-warning">{stats?.totalDLQ ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Awaiting manual retry</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Success Rate</CardDescription>
                        <CardTitle className="text-2xl font-semibold">{successRate}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Completion rate</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/40 p-1">
                {[
                    { id: 'overview' as const, label: 'Overview', icon: Activity },
                    {
                        id: 'pending' as const,
                        label: 'Pending',
                        icon: Clock,
                        count: overview?.pendingCount,
                    },
                    { id: 'processed' as const, label: 'Processed', icon: CheckCircle },
                    {
                        id: 'failed' as const,
                        label: 'Failed',
                        icon: XCircle,
                        count: stats?.totalFailed,
                    },
                    {
                        id: 'dlq' as const,
                        label: 'Dead Letter',
                        icon: AlertTriangle,
                        count: stats?.totalDLQ,
                    },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm outline-none transition-colors duration-normal focus-visible:ring-2 focus-visible:ring-ring ${
                            activeTab === tab.id
                                ? 'bg-background font-medium text-foreground ring-1 ring-border'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
                {activeTab === 'overview' && (
                    <>
                        {/* Registered Handlers */}
                        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                    Registered Job Handlers
                                </CardTitle>
                                <CardDescription>Job types that can be processed</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {overview?.registeredHandlers.map((handler) => {
                                        const typeStats = stats?.byJobType[handler.type];
                                        return (
                                            <div
                                                key={handler.type}
                                                className="rounded-lg bg-background p-3 ring-1 ring-border"
                                            >
                                                <p className="font-mono text-sm font-medium">{handler.type}</p>
                                                <p className="mb-2 text-xs text-muted-foreground">
                                                    {handler.description}
                                                </p>
                                                {typeStats && (
                                                    <div className="flex gap-3 text-xs">
                                                        <span className="text-success">
                                                            {typeStats.processed} processed
                                                        </span>
                                                        {typeStats.failed > 0 && (
                                                            <span className="text-destructive">
                                                                {typeStats.failed} failed
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Stats by Job Type */}
                        {stats && Object.keys(stats.byJobType).length > 0 && (
                            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                                <CardHeader>
                                    <CardTitle className="text-[0.9375rem] font-semibold">Stats by Job Type</CardTitle>
                                    <CardDescription>Breakdown of jobs by type</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto rounded-lg bg-background ring-1 ring-border">
                                        <table className="min-w-full divide-y divide-border/60 text-sm">
                                            <thead className="bg-muted/40">
                                                <tr className="text-left">
                                                    <th className={`px-4 py-3 ${MICRO_LABEL}`}>Job Type</th>
                                                    <th className={`px-4 py-3 text-right ${MICRO_LABEL}`}>Processed</th>
                                                    <th className={`px-4 py-3 text-right ${MICRO_LABEL}`}>Failed</th>
                                                    <th className={`px-4 py-3 text-right ${MICRO_LABEL}`}>
                                                        Success Rate
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/60">
                                                {Object.entries(stats.byJobType).map(([type, typeStats]) => {
                                                    const total = typeStats.processed + typeStats.failed;
                                                    const rate =
                                                        total > 0
                                                            ? ((typeStats.processed / total) * 100).toFixed(1)
                                                            : '0';
                                                    return (
                                                        <tr
                                                            key={type}
                                                            className="transition-colors duration-normal hover:bg-muted/40"
                                                        >
                                                            <td className="px-4 py-3 font-mono">{type}</td>
                                                            <td className="px-4 py-3 text-right text-success">
                                                                {typeStats.processed}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-destructive">
                                                                {typeStats.failed}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">{rate}%</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {stats?.lastUpdated && (
                            <p className={MICRO_LABEL}>Last updated: {new Date(stats.lastUpdated).toLocaleString()}</p>
                        )}
                    </>
                )}

                {activeTab === 'pending' && (
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Pending Jobs</CardTitle>
                            <CardDescription>Jobs waiting to be processed</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingPending ? (
                                <div className="space-y-3" aria-busy="true">
                                    <span className="sr-only">Loading pending jobs…</span>
                                    <div className="h-16 animate-pulse rounded-lg bg-background/60" />
                                </div>
                            ) : (overview?.pendingCount ?? 0) > 0 ? (
                                <div className="space-y-3">
                                    <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                                        <p className="text-sm">
                                            <strong>{overview?.pendingCount} job(s)</strong> waiting in queue
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Cloudflare Queues don't provide an API to inspect pending messages. Job
                                            details are only available after processing.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No pending jobs in queue
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'processed' && (
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Processed Jobs</CardTitle>
                            <CardDescription>Recently completed jobs (last 24 hours)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingProcessed ? (
                                <div className="space-y-3" aria-busy="true">
                                    <span className="sr-only">Loading processed jobs…</span>
                                    {Array.from({ length: 3 }, (_, index) => (
                                        <div key={index} className="h-16 animate-pulse rounded-lg bg-background/60" />
                                    ))}
                                </div>
                            ) : processedData?.jobs.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No processed jobs in history
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {processedData?.jobs
                                        .filter((j) => j.status === 'completed')
                                        .map((job) => (
                                            <div
                                                key={job.id}
                                                className="rounded-lg bg-background p-3 ring-1 ring-border"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-1 flex items-center gap-2">
                                                            <CheckCircle className="h-4 w-4 text-success" />
                                                            <span className="font-mono text-sm font-medium">
                                                                {job.type}
                                                            </span>
                                                            <span className={STATUS_CHIP}>
                                                                <span
                                                                    className="h-1.5 w-1.5 rounded-full bg-success"
                                                                    aria-hidden="true"
                                                                />
                                                                completed
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            ID: {job.id} | Attempts: {job.attempts}
                                                            {job.duration && ` | Duration: ${job.duration}ms`}
                                                        </p>
                                                    </div>
                                                    <span className={MICRO_LABEL}>
                                                        {new Date(job.processedAt).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'failed' && (
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Failed Jobs</CardTitle>
                            <CardDescription>Jobs that failed after all retry attempts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingFailed ? (
                                <div className="space-y-3" aria-busy="true">
                                    <span className="sr-only">Loading failed jobs…</span>
                                    {Array.from({ length: 3 }, (_, index) => (
                                        <div key={index} className="h-16 animate-pulse rounded-lg bg-background/60" />
                                    ))}
                                </div>
                            ) : failedData?.jobs.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">No failed jobs</p>
                            ) : (
                                <div className="space-y-2">
                                    {failedData?.jobs.map((job) => (
                                        <div key={job.id} className="rounded-lg bg-background p-3 ring-1 ring-border">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-1 flex items-center gap-2">
                                                        <XCircle className="h-4 w-4 text-destructive" />
                                                        <span className="font-mono text-sm font-medium">
                                                            {job.type}
                                                        </span>
                                                        <span className={STATUS_CHIP}>
                                                            <span
                                                                className="h-1.5 w-1.5 rounded-full bg-destructive"
                                                                aria-hidden="true"
                                                            />
                                                            failed
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        ID: {job.id} | Attempts: {job.attempts}
                                                    </p>
                                                    {job.error && (
                                                        <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">
                                                            Error: {job.error}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={MICRO_LABEL}>
                                                    {new Date(job.processedAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'dlq' && (
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-[0.9375rem] font-semibold">Dead Letter Queue</CardTitle>
                                    <CardDescription>
                                        Jobs that failed permanently and can be retried manually
                                    </CardDescription>
                                </div>
                                {(dlqData?.jobs.length ?? 0) > 0 && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleRetryAll}
                                            disabled={isRetryingAll}
                                            className="gap-1.5"
                                        >
                                            <Play className={`h-4 w-4 ${isRetryingAll ? 'animate-pulse' : ''}`} />
                                            Retry All
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePurgeDLQ}
                                            disabled={isPurgingDLQ}
                                            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <Trash2 className={`h-4 w-4 ${isPurgingDLQ ? 'animate-pulse' : ''}`} />
                                            Purge All
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingDLQ ? (
                                <div className="space-y-3" aria-busy="true">
                                    <span className="sr-only">Loading dead letter queue…</span>
                                    {Array.from({ length: 3 }, (_, index) => (
                                        <div key={index} className="h-16 animate-pulse rounded-lg bg-background/60" />
                                    ))}
                                </div>
                            ) : dlqData?.jobs.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No jobs in Dead Letter Queue - all jobs are processing successfully!
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="rounded-lg bg-background p-3 ring-1 ring-border">
                                        <p className="text-sm text-muted-foreground">
                                            <strong className="text-warning">{dlqData?.jobs.length} job(s)</strong> in
                                            Dead Letter Queue. These jobs failed after exhausting all retries and are
                                            stored for 7 days.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        {dlqData?.jobs.map((job) => (
                                            <div
                                                key={job.id}
                                                className="rounded-lg bg-background p-3 ring-1 ring-border"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-1 flex items-center gap-2">
                                                            <AlertTriangle className="h-4 w-4 text-warning" />
                                                            <span className="font-mono text-sm font-medium">
                                                                {job.type}
                                                            </span>
                                                            <span className={STATUS_CHIP}>
                                                                <span
                                                                    className="h-1.5 w-1.5 rounded-full bg-warning"
                                                                    aria-hidden="true"
                                                                />
                                                                {job.attempts} attempts
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">ID: {job.id}</p>
                                                        <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">
                                                            Error: {job.error}
                                                        </p>
                                                        <details className="mt-2">
                                                            <summary className="cursor-pointer text-xs text-muted-foreground transition-colors duration-normal hover:text-foreground">
                                                                View Payload
                                                            </summary>
                                                            <pre className="mt-1 overflow-auto rounded-lg bg-muted/40 p-2 font-mono text-xs">
                                                                {JSON.stringify(job.payload, null, 2)}
                                                            </pre>
                                                        </details>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className={MICRO_LABEL}>
                                                            {new Date(job.failedAt).toLocaleString()}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRetryJob(job.id)}
                                                                disabled={retryingJobId === job.id}
                                                                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                                            >
                                                                <Play
                                                                    className={`h-3 w-3 ${retryingJobId === job.id ? 'animate-pulse' : ''}`}
                                                                />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteJob(job.id)}
                                                                disabled={deletingJobId === job.id}
                                                                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                                                            >
                                                                <Trash2
                                                                    className={`h-3 w-3 ${deletingJobId === job.id ? 'animate-pulse' : ''}`}
                                                                />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {dlqData?.hasMore && (
                                        <p className="text-center text-xs text-muted-foreground">
                                            More jobs available. Showing first 100.
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Reset Stats Confirmation Dialog */}
            <ConfirmDialog
                open={resetStatsDialog}
                onOpenChange={setResetStatsDialog}
                title="Reset Queue Statistics?"
                description="This will reset all queue statistics. This action cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={isResetting ? 'Resetting...' : 'Reset Stats'}
                onConfirm={handleConfirmResetStats}
                confirmProps={{ disabled: isResetting }}
                cancelProps={{ disabled: isResetting }}
            />

            {/* Delete Job Confirmation Dialog */}
            <ConfirmDialog
                open={deleteJobDialog !== null}
                onOpenChange={(open) => !open && setDeleteJobDialog(null)}
                title="Remove Job from Dead Letter Queue?"
                description="This job will be permanently deleted from the queue. This action cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={deletingJobId !== null ? 'Deleting...' : 'Delete'}
                onConfirm={handleConfirmDeleteJob}
                confirmProps={{ disabled: deletingJobId !== null }}
                cancelProps={{ disabled: deletingJobId !== null }}
            />

            {/* Retry All Confirmation Dialog */}
            <ConfirmDialog
                open={retryAllDialog}
                onOpenChange={setRetryAllDialog}
                title="Retry All Dead Letter Queue Jobs?"
                description="This will retry all jobs currently in the Dead Letter Queue."
                secondaryActionText="Cancel"
                primaryActionText={isRetryingAll ? 'Retrying...' : 'Retry All'}
                onConfirm={handleConfirmRetryAll}
                confirmProps={{ disabled: isRetryingAll }}
                cancelProps={{ disabled: isRetryingAll }}
            />

            {/* Purge DLQ Confirmation Dialog */}
            <ConfirmDialog
                open={purgeDLQDialog}
                onOpenChange={setPurgeDLQDialog}
                title="Permanently Delete All DLQ Jobs?"
                description="This will permanently delete ALL jobs from the Dead Letter Queue. This action cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={isPurgingDLQ ? 'Purging...' : 'Delete All'}
                onConfirm={handleConfirmPurgeDLQ}
                confirmProps={{ disabled: isPurgingDLQ }}
                cancelProps={{ disabled: isPurgingDLQ }}
            />

            {/* Alert/Info Dialog */}
            <AlertDialog
                open={alertDialog.open}
                onOpenChange={(open) => !open && setAlertDialog({ ...alertDialog, open: false })}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>{alertDialog.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setAlertDialog({ ...alertDialog, open: false })}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
