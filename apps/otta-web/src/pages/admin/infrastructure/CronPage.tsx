import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
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
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
    Switch,
} from '@ottabase/ui-shadcn';
import { isApiError } from '@/lib/api';
import { clampCronPage, formatCronPayload } from './cron-page-utils';
import {
    ArrowLeft,
    RefreshCw,
    CheckCircle,
    Play,
    Pause,
    Plus,
    Trash2,
    Calendar,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

interface ScheduledTask {
    id: string;
    name: string;
    description: string | null;
    schedule: string;
    taskType: string;
    task: string;
    payload: string | null;
    isActive: boolean;
    timezone: string | null;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
    runCount: number;
    failCount: number;
    createdAt: string;
    updatedAt: string;
}

interface CronOverview {
    tasks: ScheduledTask[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
    registeredHandlers: Array<{ name: string; description: string }>;
    stats: {
        total: number;
        active: number;
        totalRuns: number;
        totalFails: number;
    };
}

const CRON_PRESETS = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every 30 minutes', value: '*/30 * * * *' },
    { label: 'Hourly', value: '0 * * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Daily at 9am', value: '0 9 * * *' },
    { label: 'Weekly (Sunday)', value: '0 0 * * 0' },
    { label: 'Monthly (1st)', value: '0 0 1 * *' },
    { label: 'Weekdays at 9am', value: '0 9 * * 1-5' },
];

const MICRO_LABEL = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

export function AdminCronPage() {
    const [page, setPage] = useState(1);
    const [isCreating, setIsCreating] = useState(false);
    const [newTask, setNewTask] = useState({
        name: '',
        description: '',
        schedule: '0 0 * * *',
        taskType: 'handler',
        task: '',
        payload: '',
        isActive: true,
    });
    const [payloadError, setPayloadError] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ taskId: string; taskName: string } | null>(null);
    const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: '',
        message: '',
    });

    // Validate payload is valid JSON (or empty)
    const validatePayload = (payload: string): boolean => {
        if (!payload.trim()) {
            setPayloadError(null);
            return true;
        }
        try {
            JSON.parse(payload);
            setPayloadError(null);
            return true;
        } catch {
            setPayloadError('Invalid JSON. Please enter valid JSON or leave empty.');
            return false;
        }
    };

    // Fetch cron overview
    const {
        data: overview,
        isLoading,
        refetch,
    } = useApiQuery<CronOverview>({
        entity: 'scheduled_tasks',
        queryKey: ['admin', 'cron', 'overview', page],
        endpoint: `/api/admin/cron?page=${page}&per_page=50`,
        queryOptions: { refetchInterval: 30000 },
    });

    useEffect(() => {
        if (!overview?.pagination) return;
        const clamped = clampCronPage(page, overview.pagination.totalPages);
        if (clamped !== page) setPage(clamped);
    }, [overview?.pagination, page]);

    const createMutation = useApiMutation<ScheduledTask, typeof newTask>({
        endpoint: '/api/admin/cron',
        method: 'POST',
        invalidateEntities: ['scheduled_tasks'],
        mutationOptions: {
            onSuccess: () => {
                setIsCreating(false);
                setPage(1);
                setPayloadError(null);
                setNewTask({
                    name: '',
                    description: '',
                    schedule: '0 0 * * *',
                    taskType: 'handler',
                    task: '',
                    payload: '',
                    isActive: true,
                });
            },
        },
    });

    const toggleMutation = useApiMutation<unknown, string>({
        endpoint: (taskId) => `/api/admin/cron/${taskId}/toggle`,
        method: 'POST',
        invalidateEntities: ['scheduled_tasks'],
    });

    const deleteMutation = useApiMutation<unknown, string>({
        endpoint: (taskId) => `/api/admin/cron/${taskId}`,
        method: 'DELETE',
        invalidateEntities: ['scheduled_tasks'],
        mutationOptions: {
            onSuccess: () => setDeleteDialog(null),
            onError: (error) => {
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: isApiError(error) ? error.message : 'Failed to delete task',
                });
            },
        },
    });

    const runNowMutation = useApiMutation<unknown, string>({
        endpoint: (taskId) => `/api/admin/cron/${taskId}/run`,
        method: 'POST',
        invalidateEntities: ['scheduled_tasks'],
    });

    const handleCreateTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.task) {
            return; // Handler is required
        }
        if (!validatePayload(newTask.payload)) {
            return;
        }
        createMutation.mutate(newTask);
    };

    const handleConfirmDelete = () => {
        if (deleteDialog) {
            deleteMutation.mutate(deleteDialog.taskId);
        }
    };

    const stats = overview?.stats;

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
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Scheduled Tasks</h1>
                        <p className="max-w-3xl text-muted-foreground">
                            Manage DB-driven cron jobs (Laravel-style scheduler)
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-muted-foreground"
                            onClick={() => refetch()}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={() => setIsCreating(true)}>
                            <Plus className="h-4 w-4" />
                            Add Task
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Total Tasks</CardDescription>
                        <CardTitle className="text-2xl font-semibold">{stats?.total ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Scheduled tasks in database</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Active</CardDescription>
                        <CardTitle className="text-2xl font-semibold text-success">{stats?.active ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Currently enabled</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Total Runs</CardDescription>
                        <CardTitle className="text-2xl font-semibold">{stats?.totalRuns ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">All-time executions</p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader className="pb-2">
                        <CardDescription className={MICRO_LABEL}>Failed</CardDescription>
                        <CardTitle className="text-2xl font-semibold text-destructive">
                            {stats?.totalFails ?? 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">All-time failures</p>
                    </CardContent>
                </Card>
            </div>

            {/* Create Task Form */}
            {isCreating && (
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Add Scheduled Task</CardTitle>
                        <CardDescription>Create a new DB-driven cron job</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="daily-cleanup"
                                        value={newTask.name}
                                        onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="task">
                                        Handler <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={newTask.task}
                                        onValueChange={(value) => setNewTask({ ...newTask, task: value })}
                                        required
                                    >
                                        <SelectTrigger className={!newTask.task ? 'border-muted-foreground/50' : ''}>
                                            <SelectValue placeholder="Select handler" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {overview?.registeredHandlers?.map((handler) => (
                                                <SelectItem key={handler.name} value={handler.name}>
                                                    {handler.name}
                                                </SelectItem>
                                            )) ?? (
                                                <SelectItem value="" disabled>
                                                    No handlers registered
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {!newTask.task && <p className="text-xs text-muted-foreground">Required</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="schedule">Schedule (UTC)</Label>
                                    <Select
                                        value={newTask.schedule}
                                        onValueChange={(value) => setNewTask({ ...newTask, schedule: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CRON_PRESETS.map((preset) => (
                                                <SelectItem key={preset.value} value={preset.value}>
                                                    {preset.label} ({preset.value})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        placeholder="Or enter custom cron expression"
                                        value={newTask.schedule}
                                        onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
                                        className="mt-2"
                                    />
                                    <p className="text-xs text-muted-foreground">All schedules run in UTC timezone</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        placeholder="What this task does"
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="payload">Payload (JSON)</Label>
                                <Textarea
                                    id="payload"
                                    placeholder='{"key": "value"}'
                                    value={newTask.payload}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setNewTask({ ...newTask, payload: value });
                                        validatePayload(value);
                                    }}
                                    className={`font-mono text-sm ${payloadError ? 'border-destructive' : ''}`}
                                />
                                {payloadError && <p className="text-xs text-destructive">{payloadError}</p>}
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="isActive"
                                    checked={newTask.isActive}
                                    onCheckedChange={(checked) => setNewTask({ ...newTask, isActive: checked })}
                                />
                                <Label htmlFor="isActive">Active</Label>
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Creating...' : 'Create Task'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsCreating(false);
                                        setPayloadError(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>

                            {createMutation.isError && (
                                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                    {isApiError(createMutation.error)
                                        ? createMutation.error.message
                                        : 'Failed to create task'}
                                </div>
                            )}
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Tasks List */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Scheduled Tasks</CardTitle>
                    <CardDescription>All tasks in the database</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3" aria-busy="true">
                            <span className="sr-only">Loading scheduled tasks…</span>
                            {Array.from({ length: 3 }, (_, index) => (
                                <div key={index} className="h-20 animate-pulse rounded-lg bg-background/60" />
                            ))}
                        </div>
                    ) : !overview?.tasks?.length ? (
                        <div className="py-10 text-center">
                            <Calendar className="mx-auto h-8 w-8 text-muted-foreground opacity-40" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                No scheduled tasks yet. Create one to get started.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {overview.tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className={`rounded-lg bg-background p-4 ring-1 ring-border ${!task.isActive ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                {task.isActive ? (
                                                    <CheckCircle className="h-4 w-4 text-success" />
                                                ) : (
                                                    <Pause className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="font-medium">{task.name}</span>
                                                <code className="rounded-md bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
                                                    {task.schedule}
                                                </code>
                                                {task.lastStatus === 'failed' && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-destructive ring-1 ring-border">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Failed
                                                    </span>
                                                )}
                                                {task.lastStatus === 'running' && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                                        Running
                                                    </span>
                                                )}
                                            </div>

                                            {task.description && (
                                                <p className="mb-2 text-sm leading-relaxed text-muted-foreground">
                                                    {task.description}
                                                </p>
                                            )}

                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                <span>
                                                    Handler: <code className="text-foreground">{task.task}</code>
                                                </span>
                                                <span>
                                                    Runs: <strong>{task.runCount}</strong>
                                                </span>
                                                {task.failCount > 0 && (
                                                    <span className="text-destructive">
                                                        Fails: <strong>{task.failCount}</strong>
                                                    </span>
                                                )}
                                                {task.lastRunAt && (
                                                    <span>Last run: {new Date(task.lastRunAt).toLocaleString()}</span>
                                                )}
                                                {task.nextRunAt && (
                                                    <span>Next run: {new Date(task.nextRunAt).toLocaleString()}</span>
                                                )}
                                            </div>

                                            {task.lastError && (
                                                <details className="mt-2">
                                                    <summary className="cursor-pointer text-xs text-destructive">
                                                        View last error
                                                    </summary>
                                                    <pre className="mt-1 overflow-auto rounded-lg border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">
                                                        {task.lastError}
                                                    </pre>
                                                </details>
                                            )}

                                            {task.payload && (
                                                <details className="mt-2">
                                                    <summary className="cursor-pointer text-xs text-muted-foreground transition-colors duration-normal hover:text-foreground">
                                                        View payload
                                                    </summary>
                                                    <pre className="mt-1 overflow-auto rounded-lg bg-muted/40 p-2 font-mono text-xs">
                                                        {formatCronPayload(task.payload)}
                                                    </pre>
                                                </details>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => runNowMutation.mutate(task.id)}
                                                disabled={runNowMutation.isPending}
                                                title="Run now"
                                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                            >
                                                <Play className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleMutation.mutate(task.id)}
                                                disabled={toggleMutation.isPending}
                                                title={task.isActive ? 'Pause' : 'Enable'}
                                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                            >
                                                {task.isActive ? (
                                                    <Pause className="h-4 w-4" />
                                                ) : (
                                                    <CheckCircle className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setDeleteDialog({ taskId: task.id, taskName: task.name })
                                                }
                                                disabled={deleteMutation.isPending}
                                                title="Delete"
                                                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {overview?.pagination && overview.pagination.totalPages > 1 && (
                        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                            <span className="text-xs text-muted-foreground">
                                Page {overview.pagination.page} of {overview.pagination.totalPages} ·{' '}
                                {overview.pagination.total} tasks
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                    disabled={!overview.pagination.hasPrevPage || isLoading}
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((current) => current + 1)}
                                    disabled={!overview.pagination.hasNextPage || isLoading}
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Registered Handlers */}
            {overview?.registeredHandlers && overview.registeredHandlers.length > 0 && (
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Registered Handlers</CardTitle>
                        <CardDescription>Available task handlers in your scheduler</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {overview.registeredHandlers.map((handler) => (
                                <div
                                    key={handler.name}
                                    className="rounded-lg bg-background px-3 py-2 text-xs ring-1 ring-border"
                                >
                                    <code className="font-mono text-foreground">{handler.name}</code>
                                    {handler.description && (
                                        <p className="mt-1 text-muted-foreground">{handler.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <ConfirmDialog
                open={deleteDialog !== null}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete Scheduled Task?"
                description={`Delete scheduled task "${deleteDialog?.taskName}"?`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
                confirmProps={{ disabled: deleteMutation.isPending }}
                cancelProps={{ disabled: deleteMutation.isPending }}
            />

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
