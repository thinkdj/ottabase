/**
 * Scheduled tasks: what runs when, in words, with a Run now button. Opening a row shows the
 * next runs, the payload and the last error; New task adds one.
 */
import { timeAgo, timeUntil } from '@/hooks/useLastRefreshed';
import { isApiError } from '@ottabase/api';
import { CronPresets } from '@ottabase/cron';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import { Chip, ConfirmDialog } from '@ottabase/ui-components';
import { useDataTable, useListState } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable } from '@ottabase/ui-datatable/react';
import {
    Alert,
    Button,
    Input,
    Label,
    NativeSelect,
    NativeSelectOption,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    Switch,
    Textarea,
    toast,
} from '@ottabase/ui-shadcn';
import { keepPreviousData } from '@tanstack/react-query';
import { Clock, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { formatJson, nextRuns, scheduleWords, toMs, utcStamp } from './schedule';
import type { CronOverview, NewTask, ScheduledTask } from './types';

const NO_TASKS: ScheduledTask[] = [];
const PRESETS = Object.values(CronPresets).map((value) => ({ value, label: scheduleWords(value) ?? value }));
const errorText = (err: unknown, fallback: string) => (isApiError(err) ? err.message : fallback);

export function ScheduledTasks() {
    const list = useListState();
    const overview = useApiQuery<CronOverview>({
        entity: 'scheduled_tasks',
        queryKey: ['admin', 'cron', list.params],
        endpoint: `/api/admin/cron?${list.params}`,
        queryOptions: {
            refetchInterval: 30_000,
            placeholderData: keepPreviousData,
            meta: { errorPresentation: 'local' },
        },
    });
    const tasks = overview.data?.tasks ?? NO_TASKS;
    const stats = overview.data?.stats;

    /** `'new'` opens the form; an id opens that task */
    const [panel, setPanel] = useState<'new' | string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ScheduledTask | null>(null);
    const selected = panel && panel !== 'new' ? (tasks.find((task) => task.id === panel) ?? null) : null;

    const local = { meta: { errorPresentation: 'local' as const } };
    const run = useApiMutation<unknown, string>({
        endpoint: (id) => `/api/admin/cron/${id}/run`,
        method: 'POST',
        invalidateEntities: ['scheduled_tasks'],
        mutationOptions: local,
    });
    const toggle = useApiMutation<unknown, string>({
        endpoint: (id) => `/api/admin/cron/${id}/toggle`,
        method: 'POST',
        invalidateEntities: ['scheduled_tasks'],
        mutationOptions: local,
    });
    const remove = useApiMutation<unknown, string>({
        endpoint: (id) => `/api/admin/cron/${id}`,
        method: 'DELETE',
        invalidateEntities: ['scheduled_tasks'],
        mutationOptions: local,
    });

    const runNow = async (task: ScheduledTask) => {
        try {
            await run.mutateAsync(task.id);
            toast.success(`${task.name} ran`);
        } catch (err) {
            toast.error(errorText(err, `${task.name} did not run`));
        }
    };
    const pauseOrResume = async (task: ScheduledTask) => {
        try {
            await toggle.mutateAsync(task.id);
            toast.success(task.isActive ? `${task.name} paused` : `${task.name} resumed`);
        } catch (err) {
            toast.error(errorText(err, 'Could not change the task'));
        }
    };
    const confirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            await remove.mutateAsync(pendingDelete.id);
            toast.success(`${pendingDelete.name} deleted`);
            if (panel === pendingDelete.id) setPanel(null);
        } catch (err) {
            toast.error(errorText(err, 'Could not delete the task'));
        } finally {
            setPendingDelete(null);
        }
    };

    const columns = useMemo(
        () => [
            ...createColumns<ScheduledTask>([
                {
                    key: 'name',
                    header: 'Task',
                    cell: ({ row }) => (
                        <span className={`block min-w-[12rem] ${row.isActive ? '' : 'text-muted-foreground'}`}>
                            <span className="flex items-center gap-2">
                                <span className="truncate font-medium">{row.name}</span>
                                {!row.isActive && <Chip dot="muted">Paused</Chip>}
                            </span>
                            {row.description && (
                                <span className="line-clamp-1 block text-xs text-muted-foreground">
                                    {row.description}
                                </span>
                            )}
                        </span>
                    ),
                },
                {
                    key: 'schedule',
                    header: 'Schedule',
                    cell: ({ row }) => (
                        <span className="block min-w-[10rem]">
                            <span className="block">{scheduleWords(row.schedule) ?? 'Not a valid schedule'}</span>
                            <code className="text-xs text-muted-foreground">{row.schedule}</code>
                        </span>
                    ),
                },
                {
                    key: 'nextRunAt',
                    header: 'Next run',
                    width: 120,
                    cell: ({ row }) =>
                        row.isActive && row.nextRunAt ? (
                            <span title={utcStamp(row.nextRunAt)}>{timeUntil(toMs(row.nextRunAt))}</span>
                        ) : (
                            <span className="text-muted-foreground">Paused</span>
                        ),
                },
                {
                    key: 'lastRunAt',
                    header: 'Last run',
                    width: 170,
                    cell: ({ row }) => <LastRun task={row} />,
                },
                {
                    key: 'runCount',
                    header: 'Runs',
                    width: 110,
                    cell: ({ row }) => (
                        <span className="tabular-nums">
                            {row.runCount}
                            {row.failCount > 0 && <span className="text-destructive"> ({row.failCount} failed)</span>}
                        </span>
                    ),
                },
                { key: 'task', header: 'Handler', visible: false },
            ]),
            actionsColumn<ScheduledTask>([
                { label: 'Run now', icon: Play, onClick: (task) => void runNow(task) },
                {
                    label: 'Pause',
                    icon: Pause,
                    hidden: (task) => !task.isActive,
                    onClick: (task) => void pauseOrResume(task),
                },
                {
                    label: 'Resume',
                    icon: Play,
                    hidden: (task) => task.isActive,
                    onClick: (task) => void pauseOrResume(task),
                },
            ]),
        ],
        // The mutation callbacks read fresh state through mutateAsync, so the columns can stay put.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const { table } = useDataTable<ScheduledTask>({
        data: tasks,
        columns,
        getRowId: (task) => task.id,
        list,
        rowCount: overview.data?.pagination.total,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <dl className="flex flex-wrap gap-x-8 gap-y-3">
                    <Stat label="Tasks" value={stats?.total} />
                    <Stat label="Active" value={stats?.active} />
                    <Stat label="Runs" value={stats?.totalRuns} />
                    <Stat
                        label="Failed runs"
                        value={stats?.totalFails}
                        tone={stats?.totalFails ? 'destructive' : undefined}
                    />
                </dl>
                <Button onClick={() => setPanel('new')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New task
                </Button>
            </div>

            {overview.error && <Alert variant="destructive">{overview.error.message}</Alert>}

            <DataTable
                table={table}
                isLoading={overview.isLoading}
                onRowClick={(task) => setPanel(task.id)}
                emptyIcon={Clock}
                emptyMessage="No scheduled tasks yet. Add one and it runs on the cron trigger."
                pageSizeOptions={[25, 50]}
            />

            <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
                <SheetContent
                    side="right"
                    className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
                    aria-describedby={undefined}
                >
                    <SheetHeader className="border-b border-border px-6 py-4 text-left">
                        <SheetTitle>{panel === 'new' ? 'New scheduled task' : (selected?.name ?? 'Task')}</SheetTitle>
                    </SheetHeader>
                    {panel === 'new' ? (
                        <TaskForm
                            handlers={overview.data?.registeredHandlers ?? []}
                            onSaved={() => {
                                setPanel(null);
                                list.reset();
                            }}
                            onCancel={() => setPanel(null)}
                        />
                    ) : (
                        selected && (
                            <TaskDetails
                                task={selected}
                                busy={run.isPending || toggle.isPending}
                                onRun={() => void runNow(selected)}
                                onToggle={() => void pauseOrResume(selected)}
                                onDelete={() => setPendingDelete(selected)}
                            />
                        )
                    )}
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title={`Delete ${pendingDelete?.name ?? 'this task'}?`}
                description="It stops running and its run history goes with it."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={confirmDelete}
                confirmProps={{ disabled: remove.isPending }}
            />
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone?: 'destructive' }) {
    return (
        <div>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={`text-2xl font-semibold tabular-nums ${tone === 'destructive' ? 'text-destructive' : ''}`}>
                {value === undefined ? '' : value.toLocaleString()}
            </dd>
        </div>
    );
}

function LastRun({ task }: { task: ScheduledTask }) {
    if (!task.lastRunAt) return <span className="text-muted-foreground">Never</span>;
    const status = task.lastStatus;
    return (
        <span className="flex items-center gap-2">
            <span title={utcStamp(task.lastRunAt)}>{timeAgo(toMs(task.lastRunAt))}</span>
            {status === 'failed' && <Chip dot="destructive">Failed</Chip>}
            {status === 'running' && <Chip dot="info">Running</Chip>}
        </span>
    );
}

function TaskDetails({
    task,
    busy,
    onRun,
    onToggle,
    onDelete,
}: {
    task: ScheduledTask;
    busy: boolean;
    onRun: () => void;
    onToggle: () => void;
    onDelete: () => void;
}) {
    const upcoming = task.isActive ? nextRuns(task.schedule) : [];
    return (
        <div className="flex flex-1 flex-col">
            <div className="flex-1 space-y-6 px-6 py-5 text-sm">
                {task.description && <p className="text-muted-foreground">{task.description}</p>}

                <Section title="Schedule">
                    <p className="font-medium">{scheduleWords(task.schedule) ?? 'Not a valid schedule'}</p>
                    <code className="text-xs text-muted-foreground">{task.schedule}</code>
                    {upcoming.length > 0 ? (
                        <ol className="mt-2 space-y-0.5 text-muted-foreground">
                            {upcoming.map((date) => (
                                <li key={date.toISOString()} className="tabular-nums">
                                    {utcStamp(date)}
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="mt-2 text-muted-foreground">Paused, so nothing is planned.</p>
                    )}
                </Section>

                <Section title="Handler">
                    <code className="text-xs">{task.task}</code>
                    {task.payload && (
                        <pre className="mt-2 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
                            {formatJson(task.payload)}
                        </pre>
                    )}
                </Section>

                <Section title="Last run">
                    <LastRun task={task} />
                    <p className="mt-1 text-muted-foreground">
                        {task.runCount.toLocaleString()} runs, {task.failCount.toLocaleString()} failed
                    </p>
                    {task.lastError && (
                        <pre className="mt-2 overflow-auto rounded-lg border border-destructive/40 bg-destructive/10 p-3 font-mono text-xs text-destructive">
                            {task.lastError}
                        </pre>
                    )}
                </Section>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
                <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onToggle} disabled={busy} className="gap-2">
                        {task.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {task.isActive ? 'Pause' : 'Resume'}
                    </Button>
                    <Button onClick={onRun} disabled={busy} className="gap-2">
                        <Play className="h-4 w-4" />
                        Run now
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-1">
            <h3 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
            {children}
        </section>
    );
}

const EMPTY_TASK: NewTask = {
    name: '',
    description: '',
    schedule: CronPresets.DAILY,
    taskType: 'handler',
    task: '',
    payload: '',
    isActive: true,
};

function TaskForm({
    handlers,
    onSaved,
    onCancel,
}: {
    handlers: { name: string; description: string }[];
    onSaved: () => void;
    onCancel: () => void;
}) {
    const [draft, setDraft] = useState<NewTask>({ ...EMPTY_TASK, task: handlers[0]?.name ?? '' });
    const [error, setError] = useState<string | null>(null);
    const create = useApiMutation<ScheduledTask, NewTask>({
        endpoint: '/api/admin/cron',
        method: 'POST',
        invalidateEntities: ['scheduled_tasks'],
        mutationOptions: { meta: { errorPresentation: 'local' } },
    });
    const words = scheduleWords(draft.schedule);
    const firstRun = words ? nextRuns(draft.schedule, 1)[0] : undefined;
    const handler = handlers.find((item) => item.name === draft.task);
    const set = <K extends keyof NewTask>(key: K, value: NewTask[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        if (!words) return setError('The schedule is not a valid five-field cron expression.');
        if (draft.payload.trim()) {
            try {
                JSON.parse(draft.payload);
            } catch {
                return setError('The payload must be valid JSON, or empty.');
            }
        }
        try {
            await create.mutateAsync({ ...draft, name: draft.name.trim(), payload: draft.payload.trim() });
            toast.success(`${draft.name.trim()} scheduled`);
            onSaved();
        } catch (err) {
            setError(errorText(err, 'Could not create the task'));
        }
    };

    return (
        <form onSubmit={submit} className="flex flex-1 flex-col">
            <div className="flex-1 space-y-5 px-6 py-5">
                <div className="space-y-1.5">
                    <Label htmlFor="task-name">Name</Label>
                    <Input
                        id="task-name"
                        required
                        value={draft.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="daily-cleanup"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="task-handler">Handler</Label>
                    <NativeSelect
                        id="task-handler"
                        required
                        value={draft.task}
                        onChange={(e) => set('task', e.target.value)}
                        wrapperClassName="w-full"
                    >
                        {handlers.length === 0 && (
                            <NativeSelectOption value="">No handlers registered</NativeSelectOption>
                        )}
                        {handlers.map((item) => (
                            <NativeSelectOption key={item.name} value={item.name}>
                                {item.name}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                    {handler?.description && <p className="text-xs text-muted-foreground">{handler.description}</p>}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="task-preset">Schedule (UTC)</Label>
                    <NativeSelect
                        id="task-preset"
                        value={PRESETS.some((preset) => preset.value === draft.schedule) ? draft.schedule : ''}
                        onChange={(e) => e.target.value && set('schedule', e.target.value)}
                        wrapperClassName="w-full"
                    >
                        <NativeSelectOption value="">Custom</NativeSelectOption>
                        {PRESETS.map((preset) => (
                            <NativeSelectOption key={preset.value} value={preset.value}>
                                {preset.label}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                    <Input
                        aria-label="Cron expression"
                        value={draft.schedule}
                        onChange={(e) => set('schedule', e.target.value)}
                        className="font-mono"
                        placeholder="minute hour day month weekday"
                    />
                    <p className={`text-xs ${words ? 'text-muted-foreground' : 'text-destructive'}`}>
                        {words
                            ? `${words}${firstRun ? `. First run ${utcStamp(firstRun)}.` : ''}`
                            : 'Not a valid schedule: five fields, minute hour day month weekday.'}
                    </p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="task-description">Description</Label>
                    <Input
                        id="task-description"
                        value={draft.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="What this task does"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="task-payload">Payload (JSON, optional)</Label>
                    <Textarea
                        id="task-payload"
                        value={draft.payload}
                        onChange={(e) => set('payload', e.target.value)}
                        rows={4}
                        className="font-mono text-sm"
                        placeholder='{"key": "value"}'
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Switch id="task-active" checked={draft.isActive} onCheckedChange={(on) => set('isActive', on)} />
                    <Label htmlFor="task-active">Active</Label>
                </div>
                {error && <Alert variant="destructive">{error}</Alert>}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" disabled={create.isPending || handlers.length === 0}>
                    {create.isPending ? 'Saving' : 'Save task'}
                </Button>
            </div>
        </form>
    );
}
