import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
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
} from "@ottabase/ui-shadcn";
import { api, isApiError } from "@/lib/api";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
} from "lucide-react";

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
  registeredHandlers: string[];
  stats: {
    total: number;
    active: number;
    totalRuns: number;
    totalFails: number;
  };
}

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 9am", value: "0 9 * * *" },
  { label: "Weekly (Sunday)", value: "0 0 * * 0" },
  { label: "Monthly (1st)", value: "0 0 1 * *" },
  { label: "Weekdays at 9am", value: "0 9 * * 1-5" },
];

export function AdminCronPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    name: "",
    description: "",
    schedule: "0 0 * * *",
    taskType: "handler",
    task: "",
    payload: "",
    isActive: true,
  });
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
      setPayloadError("Invalid JSON. Please enter valid JSON or leave empty.");
      return false;
    }
  };

  // Fetch cron overview
  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ["admin", "cron", "overview"],
    queryFn: () => api<CronOverview>("/api/admin/cron"),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (task: typeof newTask) =>
      api<ScheduledTask>("/api/admin/cron", {
        method: "POST",
        body: JSON.stringify(task),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cron"] });
      setIsCreating(false);
      setPayloadError(null);
      setNewTask({
        name: "",
        description: "",
        schedule: "0 0 * * *",
        taskType: "handler",
        task: "",
        payload: "",
        isActive: true,
      });
    },
  });

  // Toggle task mutation
  const toggleMutation = useMutation({
    mutationFn: (taskId: string) =>
      api(`/api/admin/cron/${taskId}/toggle`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cron"] });
    },
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) =>
      api(`/api/admin/cron/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cron"] });
    },
  });

  // Run task now mutation
  const runNowMutation = useMutation({
    mutationFn: (taskId: string) =>
      api(`/api/admin/cron/${taskId}/run`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cron"] });
    },
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

  const handleDeleteTask = (taskId: string, taskName: string) => {
    if (confirm(`Delete scheduled task "${taskName}"?`)) {
      deleteMutation.mutate(taskId);
    }
  };

  const stats = overview?.stats;

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
          <h1 className="mb-2 text-3xl font-semibold">Scheduled Tasks</h1>
          <p className="text-muted-foreground">
            Manage DB-driven cron jobs (Laravel-style scheduler)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tasks</CardDescription>
            <CardTitle className="text-3xl">{stats?.total ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Scheduled tasks in database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats?.active ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently enabled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Runs</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalRuns ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All-time executions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats?.totalFails ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All-time failures</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Task Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Scheduled Task</CardTitle>
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
                    Handler <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={newTask.task}
                    onValueChange={(value) => setNewTask({ ...newTask, task: value })}
                    required
                  >
                    <SelectTrigger className={!newTask.task ? "border-muted-foreground/50" : ""}>
                      <SelectValue placeholder="Select handler" />
                    </SelectTrigger>
                    <SelectContent>
                      {overview?.registeredHandlers?.map((handler) => (
                        <SelectItem key={handler} value={handler}>
                          {handler}
                        </SelectItem>
                      )) ?? (
                        <SelectItem value="" disabled>
                          No handlers registered
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {!newTask.task && (
                    <p className="text-xs text-muted-foreground">Required</p>
                  )}
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
                  <p className="text-xs text-muted-foreground">
                    All schedules run in UTC timezone
                  </p>
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
                  className={`font-mono text-sm ${payloadError ? "border-red-500" : ""}`}
                />
                {payloadError && (
                  <p className="text-xs text-red-600">{payloadError}</p>
                )}
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
                  {createMutation.isPending ? "Creating..." : "Create Task"}
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
                <p className="text-sm text-red-600">
                  {isApiError(createMutation.error)
                    ? createMutation.error.message
                    : "Failed to create task"}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled Tasks</CardTitle>
          <CardDescription>All tasks in the database</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !overview?.tasks?.length ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No scheduled tasks yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {overview.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded-lg border p-4 ${
                    !task.isActive ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {task.isActive ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Pause className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{task.name}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {task.schedule}
                        </code>
                        {task.lastStatus === "failed" && (
                          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                        {task.lastStatus === "running" && (
                          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Running
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-2">
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
                          <span className="text-red-600">
                            Fails: <strong>{task.failCount}</strong>
                          </span>
                        )}
                        {task.lastRunAt && (
                          <span>
                            Last run: {new Date(task.lastRunAt).toLocaleString()}
                          </span>
                        )}
                        {task.nextRunAt && (
                          <span>
                            Next run: {new Date(task.nextRunAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {task.lastError && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-red-600">
                            View last error
                          </summary>
                          <pre className="mt-1 overflow-auto rounded bg-red-50 p-2 text-xs text-red-700">
                            {task.lastError}
                          </pre>
                        </details>
                      )}

                      {task.payload && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            View payload
                          </summary>
                          <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                            {JSON.stringify(JSON.parse(task.payload), null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runNowMutation.mutate(task.id)}
                        disabled={runNowMutation.isPending || !task.isActive}
                        title="Run now"
                        className="h-8 px-2"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMutation.mutate(task.id)}
                        disabled={toggleMutation.isPending}
                        title={task.isActive ? "Pause" : "Enable"}
                        className="h-8 px-2"
                      >
                        {task.isActive ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id, task.name)}
                        disabled={deleteMutation.isPending}
                        title="Delete"
                        className="h-8 px-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registered Handlers */}
      {overview?.registeredHandlers && overview.registeredHandlers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registered Handlers</CardTitle>
            <CardDescription>Available task handlers in your scheduler</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {overview.registeredHandlers.map((handler) => (
                <code
                  key={handler}
                  className="rounded bg-muted px-2 py-1 text-sm"
                >
                  {handler}
                </code>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
