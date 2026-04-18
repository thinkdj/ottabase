import { ConfirmDialog } from '@ottabase/ui-components';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

interface R2Object {
    key: string;
    size: number;
    uploaded: string;
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
}

export function CloudflareR2DemoPage() {
    const [file, setFile] = useState<File | null>(null);
    const [key, setKey] = useState('');
    const [objects, setObjects] = useState<R2Object[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    const loadObjects = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/cloudflare/r2?list=true');

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || 'Failed to list objects');
            }

            const data = (await response.json()) as { objects?: R2Object[] };
            setObjects(data.objects || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadObjects();
    }, []);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !key) return;

        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('key', key);

            const response = await fetch('/api/cloudflare/r2', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || 'Failed to upload file');
            }

            setSuccess('File uploaded successfully!');
            setFile(null);
            setKey('');

            const fileInput = document.getElementById('r2-file-input') as HTMLInputElement | null;
            if (fileInput) fileInput.value = '';

            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (objectKey: string) => {
        setDeleteDialog(objectKey);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        const objectKey = deleteDialog;
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const response = await fetch(`/api/cloudflare/r2?key=${encodeURIComponent(objectKey)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || 'Failed to delete file');
            }

            setSuccess('File deleted successfully!');
            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setDeleteDialog(null);
            setLoading(false);
        }
    };

    const handleDownload = async (objectKey: string) => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/cloudflare/r2?key=${encodeURIComponent(objectKey)}`);

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || 'Failed to download file');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = objectKey;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo/cloudflare">← Back to Cloudflare Features</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">R2 Storage Demo</h1>
                <p className="text-muted-foreground">Object storage for file uploads and downloads</p>
            </div>

            {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            ) : null}

            {success ? (
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm">{success}</p>
                </div>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Upload File</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpload} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">File</label>
                            <Input
                                id="r2-file-input"
                                type="file"
                                onChange={(e) => {
                                    const selectedFile = e.target.files?.[0];
                                    if (selectedFile) {
                                        setFile(selectedFile);
                                        if (!key) setKey(selectedFile.name);
                                    }
                                }}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Object Key (filename in bucket)</label>
                            <Input
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder="my-file.pdf"
                                disabled={loading}
                            />
                        </div>

                        <Button type="submit" disabled={loading || !file || !key} className="w-full">
                            {loading ? 'Uploading...' : 'Upload File'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Files in Bucket</CardTitle>
                        <Button onClick={loadObjects} disabled={loading} variant="outline" size="sm">
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {objects.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No files in bucket</p>
                    ) : (
                        objects.map((obj) => (
                            <div
                                key={obj.key}
                                className="flex items-center justify-between gap-4 rounded-lg border p-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{obj.key}</p>
                                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                        <span>{formatBytes(obj.size)}</span>
                                        <span>{new Date(obj.uploaded).toLocaleDateString()}</span>
                                        {obj.httpMetadata?.contentType ? (
                                            <span>{obj.httpMetadata.contentType}</span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => handleDownload(obj.key)}
                                        disabled={loading}
                                        size="sm"
                                        variant="outline"
                                    >
                                        Download
                                    </Button>
                                    <Button
                                        onClick={() => handleDelete(obj.key)}
                                        disabled={loading}
                                        size="sm"
                                        variant="destructive"
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={deleteDialog !== null}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete File?"
                description={`Delete ${deleteDialog}?`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
                confirmProps={{ disabled: loading }}
                cancelProps={{ disabled: loading }}
            />
        </div>
    );
}
