/**
 * uploadMedia: POST one file to /api/upload with byte progress.
 *
 * fetch has no upload progress and api() has a 30s timeout, which a large photo
 * on a phone connection can exceed. This uses XHR with the same headers as
 * api() and no fixed timeout; pass a signal to cancel.
 */

import { apiHeaders } from './api';

/** Same limit the worker enforces (MAX_UPLOAD_BYTES in worker/routes/cloudflare-storage.ts) */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface UploadedMedia {
    success?: boolean;
    url?: string;
    cfImageId?: string;
    media?: { id?: string };
    error?: string;
}

export function uploadMedia(
    file: File,
    opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedMedia> {
    return new Promise((resolve, reject) => {
        // Fail before sending rather than after pushing 10+ MB up a phone connection
        if (file.size > MAX_UPLOAD_BYTES) return reject(new Error(`${file.name} is over the 10 MB limit`));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        for (const [name, value] of Object.entries(apiHeaders())) xhr.setRequestHeader(name, value);
        xhr.responseType = 'json';

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
        };
        xhr.onload = () => {
            const body = (xhr.response ?? {}) as UploadedMedia & { message?: string };
            if (xhr.status >= 200 && xhr.status < 300) resolve(body);
            else reject(new Error(body.error || body.message || `Upload failed (HTTP ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
        xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

        if (opts.signal?.aborted) return reject(new DOMException('Upload cancelled', 'AbortError'));
        opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });

        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
    });
}
