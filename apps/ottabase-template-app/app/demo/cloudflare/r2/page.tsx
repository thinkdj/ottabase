'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@ottabase/ui-shadcn';

interface R2Object {
    key: string;
    size: number;
    uploaded: string;
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
}

export default function R2DemoPage() {
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
                const data = await response.json();
                throw new Error(data.error || 'Failed to list objects');
            }

            const data = await response.json();
            setObjects(data.objects || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadObjects();
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
                const data = await response.json();
                throw new Error(data.error || 'Failed to upload file');
            }

            setSuccess('File uploaded successfully!');
            setFile(null);
            setKey('');

            // Reset file input
            const fileInput = document.getElementById('file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (objectKey: string) => {
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
                const data = await response.json();
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
                const data = await response.json();
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
        <div className="min-h-screen bg-[#FBFBFA] p-8">
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/demo/cloudflare"
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-8"
                >
                    ← Back to Cloudflare Features
                </Link>

                <div className="mb-8">
                    <h1 className="mb-2 text-3xl font-semibold text-gray-900">R2 Storage Demo</h1>
                    <p className="text-gray-600">Object storage for file uploads and downloads</p>
                </div>

                <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                    <h3 className="mb-2 text-sm font-medium text-green-900">✅ Full Local Development Support</h3>
                    <p className="text-sm text-green-700">
                        <strong>R2 works perfectly in local Windows development</strong> via Wrangler's local object
                        storage. All upload, download, metadata, and listing operations work identically in local dev
                        and production.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                        <p className="text-sm text-green-700">{success}</p>
                    </div>
                )}

                <div className="mb-8 space-y-6 rounded-lg border border-gray-200 bg-white p-6">
                    <h2 className="text-lg font-semibold text-gray-900">Upload File</h2>

                    <form onSubmit={handleUpload} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-900">File</label>
                            <input
                                id="file-input"
                                type="file"
                                onChange={(e) => {
                                    const selectedFile = e.target.files?.[0];
                                    if (selectedFile) {
                                        setFile(selectedFile);
                                        if (!key) {
                                            setKey(selectedFile.name);
                                        }
                                    }
                                }}
                                disabled={loading}
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-900">
                                Object Key (filename in bucket)
                            </label>
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder="my-file.pdf"
                                disabled={loading}
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !file || !key}
                            className="w-full rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                        >
                            {loading ? 'Uploading...' : 'Upload File'}
                        </button>
                    </form>
                </div>

                <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Files in Bucket</h2>
                        <button
                            onClick={loadObjects}
                            disabled={loading}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                            Refresh
                        </button>
                    </div>

                    {objects.length === 0 ? (
                        <p className="text-sm text-gray-500">No files in bucket</p>
                    ) : (
                        <div className="space-y-2">
                            {objects.map((obj) => (
                                <div
                                    key={obj.key}
                                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                                >
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{obj.key}</p>
                                        <div className="mt-1 flex gap-4 text-xs text-gray-500">
                                            <span>{formatBytes(obj.size)}</span>
                                            <span>{new Date(obj.uploaded).toLocaleDateString()}</span>
                                            {obj.httpMetadata?.contentType && (
                                                <span>{obj.httpMetadata.contentType}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDownload(obj.key)}
                                            disabled={loading}
                                            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                                        >
                                            Download
                                        </button>
                                        <button
                                            onClick={() => handleDelete(obj.key)}
                                            disabled={loading}
                                            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:bg-red-400"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-3 text-sm font-medium text-gray-900">Implementation Notes</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Uses @ottabase/cf R2 wrapper for type-safe operations</li>
                        <li>• Supports file uploads with metadata</li>
                        <li>• Download files with original content type</li>
                        <li>• List all objects in bucket</li>
                        <li>• Works locally with wrangler</li>
                    </ul>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete File?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deleteDialog}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={loading}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {loading ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
