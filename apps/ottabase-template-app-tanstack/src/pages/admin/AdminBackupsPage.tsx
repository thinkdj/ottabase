import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    Download,
    Trash2,
    Plus,
    HardDrive,
    Database,
    Clock,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Shield,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types (matching @ottabase/backups)
// ============================================================

interface BackupMetadata {
    id: string;
    createdAt: string;
    sizeBytes: number;
    tableCount: number;
    totalRows: number;
    tables: string[];
    type: 'full' | 'diff';
    label?: string;
    durationMs: number;
    contentHash: string;
}

interface BackupSetupStatus {
    d1Configured: boolean;
    r2Configured: boolean;
    hasBackups: boolean;
    cronConfigured: boolean;
    pendingItems: string[];
    ready: boolean;
}

interface BackupsResponse {
    backups: BackupMetadata[];
    stats: {
        totalBackups: number;
        totalSizeBytes: number;
        oldestBackup: string | null;
        newestBackup: string | null;
    };
    setup: BackupSetupStatus;
}

// ============================================================
// Helpers
// ============================================================

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

// ============================================================
// Component
// ============================================================

export function AdminBackupsPage() {
    const queryClient = useQueryClient();
    const [deleteDialog, setDeleteDialog] = useState<{ id: string; label?: string } | null>(null);

    // Fetch backups + setup status
    const {
        data: response,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['admin', 'backups'],
        queryFn: () => api<BackupsResponse>('/api/admin/backups'),
        refetchInterval: 30000,
    });

    // Create backup mutation
    const createMutation = useMutation({
        mutationFn: (label?: string) =>
            api<{ success: boolean; metadata: BackupMetadata }>('/api/admin/backups', {
                method: 'POST',
                body: { label: label || 'manual' },
            }),
        onSuccess: () => {
            toast.success('Backup created successfully');
            queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
        },
        onError: (error) => {
            toast.error(isApiError(error) ? error.message : 'Failed to create backup');
        },
    });

    // Delete backup mutation
    const deleteMutation = useMutation({
        mutationFn: (backupId: string) => api(`/api/admin/backups/${backupId}`, { method: 'DELETE' }),
        onSuccess: () => {
            toast.success('Backup deleted');
            setDeleteDialog(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
        },
        onError: (error) => {
            toast.error(isApiError(error) ? error.message : 'Failed to delete backup');
        },
    });

    const handleDownload = (backup: BackupMetadata) => {
        // Trigger download via direct link
        const link = document.createElement('a');
        link.href = `/api/admin/backups/${backup.id}`;
        link.download = `backup-${backup.id}.sql`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const setup = response?.setup;
    const stats = response?.stats;
    const backups = response?.backups ?? [];

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
                    <h1 className="mb-2 text-3xl font-semibold">Database Backups</h1>
                    <p className="text-muted-foreground">Automated D1→R2 database backups with retention management</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => createMutation.mutate('manual')}
                        disabled={createMutation.isPending || !setup?.d1Configured || !setup?.r2Configured}
                    >
                        {createMutation.isPending ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        {createMutation.isPending ? 'Creating...' : 'Backup Now'}
                    </Button>
                </div>
            </div>

            {/* Pending Setup Banner */}
            {setup && !setup.ready && (
                <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="h-5 w-5" />
                            Setup Required
                        </CardTitle>
                        <CardDescription className="text-amber-700 dark:text-amber-300">
                            Some items need your attention before automated backups are fully operational.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {setup.pendingItems.map((item, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200"
                                >
                                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Setup Status Checklist */}
            {setup && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-1.5">
                                <Database className="h-3.5 w-3.5" />
                                D1 Database
                            </CardDescription>
                            <CardTitle className={`text-lg ${setup.d1Configured ? 'text-green-600' : 'text-red-600'}`}>
                                {setup.d1Configured ? (
                                    <span className="flex items-center gap-1">
                                        <CheckCircle className="h-5 w-5" /> Connected
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <XCircle className="h-5 w-5" /> Not Configured
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-1.5">
                                <HardDrive className="h-3.5 w-3.5" />
                                R2 Storage
                            </CardDescription>
                            <CardTitle className={`text-lg ${setup.r2Configured ? 'text-green-600' : 'text-red-600'}`}>
                                {setup.r2Configured ? (
                                    <span className="flex items-center gap-1">
                                        <CheckCircle className="h-5 w-5" /> Connected
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <XCircle className="h-5 w-5" /> Not Configured
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Scheduled Backup
                            </CardDescription>
                            <CardTitle
                                className={`text-lg ${setup.cronConfigured ? 'text-green-600' : 'text-amber-600'}`}
                            >
                                {setup.cronConfigured ? (
                                    <span className="flex items-center gap-1">
                                        <CheckCircle className="h-5 w-5" /> Active
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <AlertTriangle className="h-5 w-5" /> Not Set
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        {!setup.cronConfigured && (
                            <CardContent className="pt-0">
                                <Link to="/admin/cron" className="text-xs text-primary hover:underline">
                                    Configure in Scheduled Tasks →
                                </Link>
                            </CardContent>
                        )}
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5" />
                                Backups
                            </CardDescription>
                            <CardTitle className="text-lg">
                                {stats?.totalBackups ?? 0}
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                    ({formatBytes(stats?.totalSizeBytes ?? 0)})
                                </span>
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            {/* Backups List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Backup History</CardTitle>
                    <CardDescription>
                        {stats?.newestBackup ? `Latest backup: ${timeAgo(stats.newestBackup)}` : 'No backups yet'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : backups.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-center">
                            <HardDrive className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                No backups yet. Click "Backup Now" to create your first backup.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {backups.map((backup) => (
                                <div
                                    key={backup.id}
                                    className="flex items-center justify-between rounded-lg border p-4"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-sm">{backup.label || 'Backup'}</span>
                                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                                {backup.type}
                                            </code>
                                            <span className="text-xs text-muted-foreground">
                                                {timeAgo(backup.createdAt)}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <span>{backup.tableCount} tables</span>
                                            <span>{backup.totalRows.toLocaleString()} rows</span>
                                            <span>{formatBytes(backup.sizeBytes)}</span>
                                            <span>{backup.durationMs}ms</span>
                                            <span title={backup.createdAt}>
                                                {new Date(backup.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        {backup.tables.length > 0 && (
                                            <details className="mt-2">
                                                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                                    View tables ({backup.tables.length})
                                                </summary>
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {backup.tables.map((t) => (
                                                        <code
                                                            key={t}
                                                            className="rounded bg-muted px-1.5 py-0.5 text-xs"
                                                        >
                                                            {t}
                                                        </code>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 ml-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownload(backup)}
                                            title="Download SQL"
                                            className="h-8 px-2"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDeleteDialog({ id: backup.id, label: backup.label })}
                                            title="Delete backup"
                                            className="h-8 px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the backup
                            {deleteDialog?.label ? ` "${deleteDialog.label}"` : ''}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
