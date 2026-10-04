import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({ apiHeaders: () => ({ Accept: 'application/json', 'X-Org-Id': 'org_1' }) }));

import { MAX_UPLOAD_BYTES, uploadMedia } from '../upload';

class FakeXhr {
    static last: FakeXhr;
    headers: Record<string, string> = {};
    upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
    status = 0;
    response: unknown = null;
    responseType = '';
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    method = '';
    url = '';
    body: unknown;
    constructor() {
        FakeXhr.last = this;
    }
    open(method: string, url: string) {
        this.method = method;
        this.url = url;
    }
    setRequestHeader(name: string, value: string) {
        this.headers[name] = value;
    }
    send(body: unknown) {
        this.body = body;
    }
    abort() {
        this.onabort?.();
    }
    respond(status: number, response: unknown) {
        this.status = status;
        this.response = response;
        this.onload?.();
    }
}

const file = (size = 3, name = 'a.jpg') => new File(['x'.repeat(size)], name, { type: 'image/jpeg' });

describe('uploadMedia', () => {
    const original = globalThis.XMLHttpRequest;
    beforeEach(() => {
        globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
    });
    afterEach(() => {
        globalThis.XMLHttpRequest = original;
    });

    it('posts the file with the api headers and reports byte progress', async () => {
        const onProgress = vi.fn();
        const done = uploadMedia(file(), { onProgress });
        const xhr = FakeXhr.last;

        expect([xhr.method, xhr.url]).toEqual(['POST', '/api/upload']);
        expect(xhr.headers['X-Org-Id']).toBe('org_1');
        expect((xhr.body as FormData).get('file')).toBeInstanceOf(File);

        xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 });
        expect(onProgress).toHaveBeenCalledWith(0.25);

        xhr.respond(200, { success: true, media: { id: 'm1' } });
        await expect(done).resolves.toEqual({ success: true, media: { id: 'm1' } });
    });

    it('rejects with the server message', async () => {
        const done = uploadMedia(file());
        FakeXhr.last.respond(413, { error: 'Upload exceeds the 10 MB limit' });
        await expect(done).rejects.toThrow('Upload exceeds the 10 MB limit');
    });

    it('refuses files over the limit before sending anything', async () => {
        const big = file(1, 'huge.jpg');
        Object.defineProperty(big, 'size', { value: MAX_UPLOAD_BYTES + 1 });
        await expect(uploadMedia(big)).rejects.toThrow('huge.jpg is over the 10 MB limit');
    });

    it('cancels through an AbortSignal', async () => {
        const controller = new AbortController();
        const done = uploadMedia(file(), { signal: controller.signal });
        controller.abort();
        await expect(done).rejects.toMatchObject({ name: 'AbortError' });
    });
});
