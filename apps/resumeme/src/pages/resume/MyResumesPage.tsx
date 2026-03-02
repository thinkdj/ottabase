// ---------------------------------------------------------------------------
// MyResumesPage — Lists all saved (built) resumes for the current user.
// Users can open a saved resume in the builder (view-only), edit & overwrite,
// or delete it.
// ---------------------------------------------------------------------------

import { ShareResumeDialog } from '@/components/ShareResumeDialog';
import { useDeleteResumeSaved, useResumeSavedList } from '@/ottabase/hooks/useResume';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@ottabase/ui-shadcn';
import { IconShare } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, FileText, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { RESUME_TEMPLATES } from './types';

/** Format an epoch timestamp to a readable date */
function formatDate(ts: unknown): string {
    if (!ts) return '';
    const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MyResumesPage() {
    const { data: resumesRaw, isLoading } = useResumeSavedList();
    const deleteResume = useDeleteResumeSaved();
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null);

    // Normalise list data (API may wrap in pagination envelope)
    const resumes = (Array.isArray(resumesRaw) ? resumesRaw : ((resumesRaw as any)?.data ?? [])) as any[];

    const handleDelete = useCallback(
        (id: string) => {
            deleteResume.mutate(id);
            setDeleteConfirmId(null);
        },
        [deleteResume],
    );

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            {/* Page header */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Resumes</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Saved resumes you&apos;ve built. Open one in the builder to view, edit, or print.
                    </p>
                </div>
                <Button asChild>
                    <Link
                        to="/resume-builder"
                        search={{ resumeId: undefined, dataSetId: undefined }}
                        className="flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        New Resume
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-base">Saved Resumes</CardTitle>
                            <CardDescription className="text-xs">
                                Each resume is a frozen snapshot — open it to view, refresh data, or overwrite.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
                    ) : resumes.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            You haven&apos;t saved any resumes yet.{' '}
                            <Link
                                to="/resume-builder"
                                search={{ resumeId: undefined, dataSetId: undefined }}
                                className="text-primary underline"
                            >
                                Open the builder
                            </Link>{' '}
                            and hit "Save" to create one.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {resumes.map((r: any) => {
                                const templateMeta = RESUME_TEMPLATES.find((t) => t.id === r.templateId);
                                return (
                                    <div
                                        key={r.id}
                                        className="flex items-center justify-between rounded-md border px-3 py-3 text-sm"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-foreground truncate">{r.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {templateMeta?.name ?? r.templateId} · Saved{' '}
                                                {formatDate(r.updatedAt || r.createdAt)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 ml-3">
                                            {/* Share link */}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                                onClick={() => setShareTarget({ id: r.id, name: r.name })}
                                                title="Share resume"
                                            >
                                                <IconShare className="h-4 w-4" />
                                            </Button>
                                            {/* Open in builder (view-only mode) */}
                                            <Button size="sm" variant="outline" asChild>
                                                <Link
                                                    to="/resume-builder"
                                                    search={{ resumeId: r.id, dataSetId: undefined }}
                                                    className="flex items-center gap-1.5"
                                                >
                                                    Open
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Link>
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => setDeleteConfirmId(r.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete confirmation dialog */}
            <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Resume?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete this saved resume. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Share dialog */}
            <ShareResumeDialog
                resumeId={shareTarget?.id ?? ''}
                resumeName={shareTarget?.name ?? ''}
                open={!!shareTarget}
                onOpenChange={(open) => !open && setShareTarget(null)}
            />
        </div>
    );
}
