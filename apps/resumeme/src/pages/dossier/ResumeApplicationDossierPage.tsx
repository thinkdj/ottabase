// ---------------------------------------------------------------------------
// ResumeApplicationDossierPage — Main listing page for Application Dossier "folders".
// Each folder groups documents (JDs, company info, etc.) around a single
// job-application context, similar to NotebookLM notebooks.
// ---------------------------------------------------------------------------

import { ResumeTag } from '@/components/ResumeTag';
import {
    useApplicationDossiers,
    useCreateApplicationDossier,
    useDeleteApplicationDossier,
} from '@/hooks/useApplicationDossier';
import {
    Badge,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Textarea,
} from '@ottabase/ui-shadcn';
import {
    IconBuildingSkyscraper,
    IconFolder,
    IconFolderOpen,
    IconPlus,
    IconSparkles,
    IconTarget,
    IconTrash,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

// ── Helpers ──────────────────────────────────────────────────

/** Format an epoch timestamp to a readable short date. */
function formatDate(ts: unknown): string {
    if (!ts) return '';
    const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Safely parse the JSON analysis result and extract match score. */
function getMatchScore(analysisResult: string | null | undefined): number | null {
    if (!analysisResult) return null;
    try {
        const parsed = JSON.parse(analysisResult);
        // Support { score: number } or { matchScore: number }
        const score = parsed?.score ?? parsed?.matchScore;
        return typeof score === 'number' ? score : null;
    } catch {
        return null;
    }
}

// ── Create-Dossier form state ─────────────────────────────────

interface CreateFormState {
    name: string;
    description: string;
    targetRole: string;
    targetCompany: string;
}

const EMPTY_FORM: CreateFormState = { name: '', description: '', targetRole: '', targetCompany: '' };

// ── Component ────────────────────────────────────────────────

export function ResumeApplicationDossierPage() {
    const { data: dossiersRaw, isLoading } = useApplicationDossiers();
    const createDossier = useCreateApplicationDossier();
    const deleteDossier = useDeleteApplicationDossier();

    // Normalize API envelope — may be paginated or bare array
    const dossiers = (Array.isArray(dossiersRaw) ? dossiersRaw : ((dossiersRaw as any)?.data ?? [])) as any[];

    // Dialog state
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);

    // ── Handlers ─────────────────────────────────────────────

    const handleCreate = useCallback(async () => {
        if (!form.name.trim()) {
            toast.error('Name is required');
            return;
        }
        try {
            await createDossier.mutateAsync({
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                targetRole: form.targetRole.trim() || undefined,
                targetCompany: form.targetCompany.trim() || undefined,
            } as any);
            toast.success('Application Dossier created');
            setForm(EMPTY_FORM);
            setCreateOpen(false);
        } catch {
            toast.error('Failed to create Application Dossier');
        }
    }, [form, createDossier]);

    const handleDelete = useCallback(
        async (id: string) => {
            try {
                await deleteDossier.mutateAsync(id);
                toast.success('Application Dossier deleted');
            } catch {
                toast.error('Failed to delete Application Dossier');
            }
            setDeleteId(null);
        },
        [deleteDossier],
    );

    // ── Render ───────────────────────────────────────────────

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            {/* Page header (mirrors My Resumes layout) */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Application Dossier</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Organise job descriptions, company info, and requirements into dossiers. Use AI to match your
                        profile against each opportunity.
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
                    <IconPlus className="h-4 w-4" />
                    New Dossier
                </Button>
            </div>

            {/* Loading state */}
            {isLoading && <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>}

            {/* Empty state */}
            {!isLoading && dossiers.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <IconFolder className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                        No application dossiers yet. Create one to get started!
                    </p>
                    <Button variant="outline" onClick={() => setCreateOpen(true)} className="mt-2 gap-2">
                        <IconPlus className="h-4 w-4" />
                        Create your first dossier
                    </Button>
                </div>
            )}

            {/* Application dossier cards grid */}
            {!isLoading && dossiers.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    {dossiers.map((dossier: any) => {
                        const matchScore = getMatchScore(dossier.analysisResult);
                        const isArchived = dossier.status === 'archived';

                        return (
                            <Card
                                key={dossier.id}
                                className="group relative transition-shadow hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-white/5"
                            >
                                <CardContent className="flex flex-col gap-3 p-5">
                                    {/* Top row: icon + name + status */}
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 shrink-0 text-primary">
                                            <IconFolderOpen className="h-6 w-6 hidden group-hover:block" />
                                            <IconFolder className="h-6 w-6 block group-hover:hidden" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                to={`/dossier/${dossier.id}` as any}
                                                className="font-semibold text-foreground hover:underline line-clamp-1"
                                            >
                                                {dossier.name}
                                            </Link>
                                            {dossier.description && (
                                                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                                                    {dossier.description}
                                                </p>
                                            )}
                                        </div>
                                        <ResumeTag
                                            label={dossier.status ?? 'active'}
                                            className={
                                                isArchived
                                                    ? 'border border-border text-muted-foreground'
                                                    : 'border border-green-500/40 text-green-600 dark:text-green-300'
                                            }
                                        />
                                    </div>

                                    {/* Target role / company badges */}
                                    {(dossier.targetRole || dossier.targetCompany) && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {dossier.targetRole && (
                                                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                                                    <IconTarget className="h-3 w-3" />
                                                    {dossier.targetRole}
                                                </Badge>
                                            )}
                                            {dossier.targetCompany && (
                                                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                                                    <IconBuildingSkyscraper className="h-3 w-3" />
                                                    {dossier.targetCompany}
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    {/* Meta row: analysis score + last analysis date */}
                                    {(matchScore !== null || dossier.lastAnalysisAt) && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {matchScore !== null && (
                                                <Badge
                                                    variant="secondary"
                                                    className="gap-1 text-xs font-medium text-violet-600 dark:text-violet-400"
                                                >
                                                    <IconSparkles className="h-3 w-3" />
                                                    {matchScore}% match
                                                </Badge>
                                            )}
                                            {dossier.lastAnalysisAt && (
                                                <span>Analysed {formatDate(dossier.lastAnalysisAt)}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center justify-between border-t pt-3 dark:border-white/10">
                                        <span className="text-xs text-muted-foreground">
                                            Created {formatDate(dossier.createdAt)}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Button size="sm" variant="outline" asChild>
                                                <Link to={`/dossier/${dossier.id}` as any} className="gap-1.5">
                                                    Open
                                                </Link>
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => setDeleteId(dossier.id)}
                                            >
                                                <IconTrash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ── Create dossier dialog ──────────────────────────── */}
            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) setForm(EMPTY_FORM);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>New Application Dossier</DialogTitle>
                        <DialogDescription>
                            Create an application dossier for a job opportunity. You can add documents later.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="dossier-name">Name *</Label>
                            <Input
                                id="dossier-name"
                                placeholder="e.g. Google SWE Application"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="dossier-role">Target Role</Label>
                                <Input
                                    id="dossier-role"
                                    placeholder="e.g. Senior SWE"
                                    value={form.targetRole}
                                    onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="dossier-company">Target Company</Label>
                                <Input
                                    id="dossier-company"
                                    placeholder="e.g. Google"
                                    value={form.targetCompany}
                                    onChange={(e) => setForm((f) => ({ ...f, targetCompany: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="dossier-desc">Description</Label>
                            <Textarea
                                id="dossier-desc"
                                placeholder="Brief description of this dossier"
                                rows={2}
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={createDossier.isPending} className="gap-1.5">
                            {createDossier.isPending ? 'Creating…' : 'Create Dossier'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete confirmation dialog ────────────────────── */}
            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Application Dossier?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete this dossier and all its files. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
