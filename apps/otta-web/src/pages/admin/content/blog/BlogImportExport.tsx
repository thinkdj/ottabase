/**
 * Import / Export controls for the content list.
 *
 * Export downloads every post you can read as one ottablog JSON file. Import accepts that file
 * or Markdown posts (.md with front matter), shows what will be created, then sends batches to
 * POST /api/blog/import. The server decides what actually lands (drafts without publish rights,
 * existing slugs skipped) and the dialog reports it.
 */
import {
    BLOG_IMPORT_BATCH_SIZE,
    readBlogImportFile,
    type BlogExportFile,
    type BlogExportPost,
    type BlogImportResult,
} from '@ottabase/ottablog';
import { useApiClient } from '@ottabase/ottaorm/client';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@ottabase/ui-shadcn';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

interface ImportPlan {
    posts: BlogExportPost[];
    errors: string[];
}

export function BlogImportExport() {
    const apiClient = useApiClient();
    const queryClient = useQueryClient();
    const fileInput = useRef<HTMLInputElement>(null);
    const [exporting, setExporting] = useState(false);
    const [plan, setPlan] = useState<ImportPlan | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<BlogImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleExport = async () => {
        setExporting(true);
        setError(null);
        try {
            const file = await apiClient<BlogExportFile>('/api/blog/export');
            const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `blog-export-${file.exportedAt.slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (files.length === 0) return;
        const next: ImportPlan = { posts: [], errors: [] };
        for (const file of files) {
            try {
                next.posts.push(...readBlogImportFile(await file.text(), file.name));
            } catch (err) {
                next.errors.push(err instanceof Error ? err.message : `${file.name}: could not be read`);
            }
        }
        setResult(null);
        setError(null);
        setPlan(next);
    };

    const handleImport = async () => {
        if (!plan) return;
        setImporting(true);
        setError(null);
        const total: BlogImportResult = { created: [], skipped: [], warnings: [] };
        try {
            for (let i = 0; i < plan.posts.length; i += BLOG_IMPORT_BATCH_SIZE) {
                const batch = await apiClient<BlogImportResult>('/api/blog/import', {
                    method: 'POST',
                    body: { posts: plan.posts.slice(i, i + BLOG_IMPORT_BATCH_SIZE) },
                });
                total.created.push(...batch.created);
                total.skipped.push(...batch.skipped);
                total.warnings.push(...batch.warnings);
            }
        } catch (err) {
            // Earlier batches are already saved; say so instead of implying nothing happened.
            setError(
                `${err instanceof Error ? err.message : 'Import failed'}. ${total.created.length} post(s) were imported before the error.`,
            );
        } finally {
            setResult(total);
            setImporting(false);
            await queryClient.invalidateQueries({ queryKey: ['posts'] });
        }
    };

    const closeDialog = (open: boolean) => {
        if (open || importing) return;
        setPlan(null);
        setResult(null);
        setError(null);
    };

    const published = plan?.posts.filter((post) => post.status === 'published').length ?? 0;

    return (
        <>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Import
            </Button>
            <input
                ref={fileInput}
                type="file"
                accept=".json,.md,.markdown"
                multiple
                className="hidden"
                onChange={handleFiles}
            />
            {error && !plan && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            <Dialog open={!!plan} onOpenChange={closeDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{result ? 'Import finished' : 'Import posts'}</DialogTitle>
                        <DialogDescription>
                            {result
                                ? `${result.created.length} created, ${result.skipped.length} skipped.`
                                : `${plan?.posts.length ?? 0} post(s) ready, ${published} published, ${
                                      (plan?.posts.length ?? 0) - published
                                  } not published. Published posts go live immediately; posts whose slug already exists are skipped.`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-72 space-y-3 overflow-y-auto text-sm">
                        {error && (
                            <p role="alert" className="text-destructive">
                                {error}
                            </p>
                        )}
                        {!result && plan && plan.errors.length > 0 && (
                            <IssueList title="Files that could not be read" items={plan.errors} />
                        )}
                        {result && result.skipped.length > 0 && (
                            <IssueList
                                title="Skipped"
                                items={result.skipped.map((item) => `${item.slug || '(untitled)'}: ${item.reason}`)}
                            />
                        )}
                        {result && result.warnings.length > 0 && (
                            <IssueList
                                title="Notes"
                                items={result.warnings.map((item) => `${item.slug}: ${item.message}`)}
                            />
                        )}
                    </div>

                    <DialogFooter>
                        {result ? (
                            <Button onClick={() => closeDialog(false)}>Done</Button>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => closeDialog(false)} disabled={importing}>
                                    Cancel
                                </Button>
                                <Button onClick={handleImport} disabled={importing || !plan?.posts.length}>
                                    {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Import {plan?.posts.length ?? 0} post(s)
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function IssueList({ title, items }: { title: string; items: string[] }) {
    return (
        <div className="space-y-1">
            <p className="font-medium">{title}</p>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                {items.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
        </div>
    );
}
