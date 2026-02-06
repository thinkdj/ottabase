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
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Switch,
    Textarea,
} from '@ottabase/ui-shadcn';
import { api, isApiError } from '@/lib/api';
import { ArrowLeft, Flag, Plus, RefreshCw, Trash2 } from 'lucide-react';

interface FeatureFlagItem {
    id: string;
    key: string;
    name: string;
    description: string | null;
    enabled: boolean;
    rules: {
        plans?: string[];
        orgIds?: string[];
        userIds?: string[];
        percentage?: number;
    };
    createdAt: string;
    updatedAt: string;
}

interface FlagsListResponse {
    data: FeatureFlagItem[];
    total: number;
    page: number;
    perPage: number;
}

const EMPTY_FORM = {
    key: '',
    name: '',
    description: '',
    enabled: false,
    rulesText: '{}',
};

export function AdminFlagsPage() {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [rulesError, setRulesError] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);
    const queryClient = useQueryClient();

    const {
        data: flagsData,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['admin', 'flags'],
        queryFn: () => api<FlagsListResponse>('/api/flags', { params: { perPage: 100 } }),
    });

    const flags = flagsData?.data ?? [];

    const validateRules = (text: string): boolean => {
        if (!text.trim() || text.trim() === '{}') {
            setRulesError(null);
            return true;
        }
        try {
            JSON.parse(text);
            setRulesError(null);
            return true;
        } catch {
            setRulesError('Invalid JSON');
            return false;
        }
    };

    const createMutation = useMutation({
        mutationFn: (payload: { key: string; name: string; description: string; enabled: boolean; rules: object }) =>
            api('/api/flags', { method: 'POST', body: payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] });
            setIsCreating(false);
            setForm(EMPTY_FORM);
            setRulesError(null);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            payload,
        }: {
            id: string;
            payload: { name?: string; description?: string; enabled?: boolean; rules?: object };
        }) => api(`/api/flags/${id}`, { method: 'PATCH', body: payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] });
            setEditingId(null);
            setForm(EMPTY_FORM);
            setRulesError(null);
        },
    });

    const toggleMutation = useMutation({
        mutationFn: (id: string) => api(`/api/flags/${id}/toggle`, { method: 'POST' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api(`/api/flags/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] });
        },
        onSettled: () => setDeleteDialog(null),
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.key || !form.name) return;
        if (!validateRules(form.rulesText)) return;
        const rules = form.rulesText.trim() ? JSON.parse(form.rulesText) : {};
        createMutation.mutate({
            key: form.key,
            name: form.name,
            description: form.description,
            enabled: form.enabled,
            rules,
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;
        if (!validateRules(form.rulesText)) return;
        const rules = form.rulesText.trim() ? JSON.parse(form.rulesText) : {};
        updateMutation.mutate({
            id: editingId,
            payload: { name: form.name, description: form.description, enabled: form.enabled, rules },
        });
    };

    const startEdit = (flag: FeatureFlagItem) => {
        setEditingId(flag.id);
        setIsCreating(false);
        setForm({
            key: flag.key,
            name: flag.name,
            description: flag.description || '',
            enabled: flag.enabled,
            rulesText: JSON.stringify(flag.rules || {}, null, 2),
        });
        setRulesError(null);
    };

    const cancelForm = () => {
        setIsCreating(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        setRulesError(null);
    };

    const enabledCount = flags.filter((f) => f.enabled).length;

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
                    <h1 className="mb-2 text-3xl font-semibold">Feature Flags</h1>
                    <p className="text-muted-foreground">Gate features by plan, org, user, or percentage rollout</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            setIsCreating(true);
                            setEditingId(null);
                            setForm(EMPTY_FORM);
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        New Flag
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Flags</CardDescription>
                        <CardTitle className="text-3xl">{flags.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Enabled</CardDescription>
                        <CardTitle className="text-3xl text-green-600">{enabledCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Disabled</CardDescription>
                        <CardTitle className="text-3xl text-muted-foreground">{flags.length - enabledCount}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Create / Edit Form */}
            {(isCreating || editingId) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{editingId ? 'Edit Flag' : 'Create Feature Flag'}</CardTitle>
                        <CardDescription>
                            {editingId ? `Editing: ${form.key}` : 'Define a new flag with optional targeting rules'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={editingId ? handleUpdate : handleCreate} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="flag-key">
                                        Flag Key <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="flag-key"
                                        placeholder="billing.invoices"
                                        value={form.key}
                                        onChange={(e) => setForm({ ...form, key: e.target.value })}
                                        disabled={!!editingId}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Used in code: useFlag("billing.invoices")
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="flag-name">
                                        Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="flag-name"
                                        placeholder="Invoice Generation"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="flag-desc">Description</Label>
                                <Input
                                    id="flag-desc"
                                    placeholder="What this flag controls"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="flag-rules">Targeting Rules (JSON)</Label>
                                <Textarea
                                    id="flag-rules"
                                    placeholder={'{\n  "plans": ["pro", "enterprise"],\n  "percentage": 50\n}'}
                                    value={form.rulesText}
                                    onChange={(e) => {
                                        setForm({ ...form, rulesText: e.target.value });
                                        validateRules(e.target.value);
                                    }}
                                    className={`font-mono text-sm min-h-[100px] ${rulesError ? 'border-red-500' : ''}`}
                                />
                                {rulesError && <p className="text-xs text-red-600">{rulesError}</p>}
                                <p className="text-xs text-muted-foreground">
                                    Supported keys: plans (string[]), orgIds (string[]), userIds (string[]), percentage
                                    (0-100). Empty = globally enabled when on.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="flag-enabled"
                                    checked={form.enabled}
                                    onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
                                />
                                <Label htmlFor="flag-enabled">Enabled</Label>
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                    {editingId
                                        ? updateMutation.isPending
                                            ? 'Saving...'
                                            : 'Save Changes'
                                        : createMutation.isPending
                                          ? 'Creating...'
                                          : 'Create Flag'}
                                </Button>
                                <Button type="button" variant="outline" onClick={cancelForm}>
                                    Cancel
                                </Button>
                            </div>

                            {(createMutation.isError || updateMutation.isError) && (
                                <p className="text-sm text-red-600">
                                    {isApiError(createMutation.error || updateMutation.error)
                                        ? (createMutation.error || updateMutation.error)?.message
                                        : 'Operation failed'}
                                </p>
                            )}
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Flags List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">All Feature Flags</CardTitle>
                    <CardDescription>Toggle, edit, or delete flags</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : flags.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-center">
                            <Flag className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                No feature flags yet. Create one to start gating features.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {flags.map((flag) => (
                                <div
                                    key={flag.id}
                                    className={`rounded-lg border p-4 ${!flag.enabled ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Switch
                                                    checked={flag.enabled}
                                                    onCheckedChange={() => toggleMutation.mutate(flag.id)}
                                                    disabled={toggleMutation.isPending}
                                                />
                                                <span className="font-medium">{flag.name}</span>
                                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                                    {flag.key}
                                                </code>
                                            </div>

                                            {flag.description && (
                                                <p className="text-sm text-muted-foreground mb-2 ml-11">
                                                    {flag.description}
                                                </p>
                                            )}

                                            <div className="flex flex-wrap gap-1.5 ml-11">
                                                {flag.rules?.plans && flag.rules.plans.length > 0 && (
                                                    <Badge variant="secondary">
                                                        Plans: {flag.rules.plans.join(', ')}
                                                    </Badge>
                                                )}
                                                {flag.rules?.orgIds && flag.rules.orgIds.length > 0 && (
                                                    <Badge variant="secondary">{flag.rules.orgIds.length} org(s)</Badge>
                                                )}
                                                {flag.rules?.userIds && flag.rules.userIds.length > 0 && (
                                                    <Badge variant="secondary">
                                                        {flag.rules.userIds.length} user(s)
                                                    </Badge>
                                                )}
                                                {flag.rules?.percentage !== undefined &&
                                                    flag.rules.percentage !== null && (
                                                        <Badge variant="secondary">
                                                            {flag.rules.percentage}% rollout
                                                        </Badge>
                                                    )}
                                                {!flag.rules?.plans?.length &&
                                                    !flag.rules?.orgIds?.length &&
                                                    !flag.rules?.userIds?.length &&
                                                    flag.rules?.percentage === undefined && (
                                                        <Badge variant="outline">Global</Badge>
                                                    )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => startEdit(flag)}
                                                className="h-8 px-3"
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setDeleteDialog({ id: flag.id, name: flag.name })}
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

            {/* Usage Guide */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Usage</CardTitle>
                    <CardDescription>How to use feature flags in your code</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <p className="text-sm font-medium mb-1">React Hook</p>
                        <pre className="rounded bg-muted p-3 text-xs overflow-auto">
                            {`import { useFlag } from "@ottabase/flags/react";

function BillingPage() {
  const invoicesEnabled = useFlag("billing.invoices");
  if (!invoicesEnabled) return <UpgradeBanner />;
  return <InvoiceList />;
}`}
                        </pre>
                    </div>
                    <div>
                        <p className="text-sm font-medium mb-1">Conditional Render</p>
                        <pre className="rounded bg-muted p-3 text-xs overflow-auto">
                            {`import { Feature } from "@ottabase/flags/react";

<Feature flag="ai.assist" fallback={<UpgradePrompt />}>
  <AIAssistButton />
</Feature>`}
                        </pre>
                    </div>
                    <div>
                        <p className="text-sm font-medium mb-1">Targeting Rules JSON</p>
                        <pre className="rounded bg-muted p-3 text-xs overflow-auto">
                            {`{
  "plans": ["pro", "enterprise"],
  "orgIds": ["org-abc123"],
  "userIds": ["user-xyz"],
  "percentage": 25
}`}
                        </pre>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Feature Flag?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete flag "{deleteDialog?.name}"? Any code checking this flag will default to false.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
                            disabled={deleteMutation.isPending}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
