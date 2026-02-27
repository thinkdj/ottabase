import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@ottabase/ottaorm/client';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
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
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/admin">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Admin
                </Link>
            </Button>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="mb-2 text-3xl font-semibold">Queue Management</h1>
                    <p className="text-muted-foreground">Monitor and manage background job queues</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchOverview()} disabled={loadingOverview}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loadingOverview ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetStats} disabled={isResetting}>
                        <RotateCcw className={`mr-2 h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                        Reset Stats
                    </Button>
                </div>
            </div>

            {/* Status Banner */}
            <Card
                className={
                    overview?.queueBinding === 'configured'
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-yellow-500/30 bg-yellow-500/5'
                }
            >
                <CardContent className="flex items-center gap-3 py-3">
                    {overview?.queueBinding === 'configured' ? (
                        <>
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="text-sm">Queue binding is configured and operational</span>
                        </>
                    ) : (
                        <>
                            <Clock className="h-5 w-5 text-yellow-500" />
                            <span className="text-sm">Queue binding not configured - jobs will not be processed</span>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Dispatched</CardDescription>
                        <CardTitle className="text-3xl">{stats?.totalDispatched ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Jobs sent to queue</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Processed</CardDescription>
                        <CardTitle className="text-3xl text-green-600">{stats?.totalProcessed ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Successfully completed</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Failed</CardDescription>
                        <CardTitle className="text-3xl text-red-600">{stats?.totalFailed ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Failed after retries</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Dead Letter Queue</CardDescription>
                        <CardTitle className="text-3xl text-orange-600">{stats?.totalDLQ ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Awaiting manual retry</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                        <CardTitle className="text-3xl">{successRate}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Completion rate</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
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
                        className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition-colors ${
                            activeTab === tab.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
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
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Layers className="h-4 w-4" />
                                    Registered Job Handlers
                                </CardTitle>
                                <CardDescription>Job types that can be processed</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {overview?.registeredHandlers.map((handler) => {
                                        const typeStats = stats?.byJobType[handler.type];
                                        return (
                                            <div key={handler.type} className="rounded-lg border p-3">
                                                <p className="font-mono text-sm font-medium">{handler.type}</p>
                                                <p className="mb-2 text-xs text-muted-foreground">
                                                    {handler.description}
                                                </p>
                                                {typeStats && (
                                                    <div className="flex gap-3 text-xs">
                                                        <span className="text-green-600">
                                                            {typeStats.processed} processed
                                                        </span>
                                                        {typeStats.failed > 0 && (
                                                            <span className="text-red-600">
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
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Stats by Job Type</CardTitle>
                                    <CardDescription>Breakdown of jobs by type</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b text-left">
                                                    <th className="pb-2 font-medium">Job Type</th>
                                                    <th className="pb-2 text-right font-medium">Processed</th>
                                                    <th className="pb-2 text-right font-medium">Failed</th>
                                                    <th className="pb-2 text-right font-medium">Success Rate</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(stats.byJobType).map(([type, typeStats]) => {
                                                    const total = typeStats.processed + typeStats.failed;
                                                    const rate =
                                                        total > 0
                                                            ? ((typeStats.processed / total) * 100).toFixed(1)
                                                            : '0';
                                                    return (
                                                        <tr key={type} className="border-b">
                                                            <td className="py-2 font-mono">{type}</td>
                                                            <td className="py-2 text-right text-green-600">
                                                                {typeStats.processed}
                                                            </td>
                                                            <td className="py-2 text-right text-red-600">
                                                                {typeStats.failed}
                                                            </td>
                                                            <td className="py-2 text-right">{rate}%</td>
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
                            <p className="text-xs text-muted-foreground">
                                Last updated: {new Date(stats.lastUpdated).toLocaleString()}
                            </p>
                        )}
                    </>
                )}

                {activeTab === 'pending' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Pending Jobs</CardTitle>
                            <CardDescription>Jobs waiting to be processed</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingPending ? (
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            ) : (overview?.pendingCount ?? 0) > 0 ? (
                                <div className="space-y-3">
                                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                                        <p className="text-sm text-blue-800">
                                            <strong>{overview?.pendingCount} job(s)</strong> waiting in queue
                                        </p>
                                        <p className="mt-1 text-xs text-blue-600">
                                            Cloudflare Queues don't provide an API to inspect pending messages. Job
                                            details are only available after processing.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No pending jobs in queue</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'processed' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Processed Jobs</CardTitle>
                            <CardDescription>Recently completed jobs (last 24 hours)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingProcessed ? (
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            ) : processedData?.jobs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No processed jobs in history</p>
                            ) : (
                                <div className="space-y-2">
                                    {processedData?.jobs
                                        .filter((j) => j.status === 'completed')
                                        .map((job) => (
                                            <div key={job.id} className="rounded-lg border p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-1 flex items-center gap-2">
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                            <span className="font-mono text-sm font-medium">
                                                                {job.type}
                                                            </span>
                                                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                                                                completed
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            ID: {job.id} | Attempts: {job.attempts}
                                                            {job.duration && ` | Duration: ${job.duration}ms`}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
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
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Failed Jobs</CardTitle>
                            <CardDescription>Jobs that failed after all retry attempts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingFailed ? (
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            ) : failedData?.jobs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No failed jobs</p>
                            ) : (
                                <div className="space-y-2">
                                    {failedData?.jobs.map((job) => (
                                        <div key={job.id} className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-1 flex items-center gap-2">
                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                        <span className="font-mono text-sm font-medium">
                                                            {job.type}
                                                        </span>
                                                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                                                            failed
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        ID: {job.id} | Attempts: {job.attempts}
                                                    </p>
                                                    {job.error && (
                                                        <p className="mt-2 rounded bg-red-100 p-2 text-xs text-red-700">
                                                            Error: {job.error}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground">
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
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Dead Letter Queue</CardTitle>
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
                                        >
                                            <Play className={`mr-2 h-4 w-4 ${isRetryingAll ? 'animate-pulse' : ''}`} />
                                            Retry All
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePurgeDLQ}
                                            disabled={isPurgingDLQ}
                                            className="text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className={`mr-2 h-4 w-4 ${isPurgingDLQ ? 'animate-pulse' : ''}`} />
                                            Purge All
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingDLQ ? (
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            ) : dlqData?.jobs.length === 0 ? (
                                <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
                                    <p className="text-sm text-green-800">
                                        No jobs in Dead Letter Queue - all jobs are processing successfully!
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                                        <p className="text-sm text-orange-800">
                                            <strong>{dlqData?.jobs.length} job(s)</strong> in Dead Letter Queue. These
                                            jobs failed after exhausting all retries and are stored for 7 days.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        {dlqData?.jobs.map((job) => (
                                            <div
                                                key={job.id}
                                                className="rounded-lg border border-orange-200 bg-orange-50/30 p-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-1 flex items-center gap-2">
                                                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                            <span className="font-mono text-sm font-medium">
                                                                {job.type}
                                                            </span>
                                                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                                                                {job.attempts} attempts
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">ID: {job.id}</p>
                                                        <p className="mt-2 rounded bg-red-100 p-2 text-xs text-red-700">
                                                            Error: {job.error}
                                                        </p>
                                                        <details className="mt-2">
                                                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                                                View Payload
                                                            </summary>
                                                            <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                                                                {JSON.stringify(job.payload, null, 2)}
                                                            </pre>
                                                        </details>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(job.failedAt).toLocaleString()}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleRetryJob(job.id)}
                                                                disabled={retryingJobId === job.id}
                                                                className="h-7 px-2"
                                                            >
                                                                <Play
                                                                    className={`h-3 w-3 ${retryingJobId === job.id ? 'animate-pulse' : ''}`}
                                                                />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleDeleteJob(job.id)}
                                                                disabled={deletingJobId === job.id}
                                                                className="h-7 px-2 text-red-600 hover:bg-red-50"
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
            <AlertDialog open={resetStatsDialog} onOpenChange={setResetStatsDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Queue Statistics?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will reset all queue statistics. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmResetStats}
                            disabled={isResetting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isResetting ? 'Resetting...' : 'Reset Stats'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Job Confirmation Dialog */}
            <AlertDialog open={deleteJobDialog !== null} onOpenChange={(open) => !open && setDeleteJobDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Job from Dead Letter Queue?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This job will be permanently deleted from the queue. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingJobId !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDeleteJob}
                            disabled={deletingJobId !== null}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deletingJobId !== null ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Retry All Confirmation Dialog */}
            <AlertDialog open={retryAllDialog} onOpenChange={setRetryAllDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Retry All Dead Letter Queue Jobs?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will retry all jobs currently in the Dead Letter Queue.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRetryingAll}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRetryAll} disabled={isRetryingAll}>
                            {isRetryingAll ? 'Retrying...' : 'Retry All'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Purge DLQ Confirmation Dialog */}
            <AlertDialog open={purgeDLQDialog} onOpenChange={setPurgeDLQDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Permanently Delete All DLQ Jobs?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete ALL jobs from the Dead Letter Queue. This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPurgingDLQ}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmPurgeDLQ}
                            disabled={isPurgingDLQ}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isPurgingDLQ ? 'Purging...' : 'Delete All'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
