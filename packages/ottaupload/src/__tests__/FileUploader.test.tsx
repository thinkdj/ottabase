import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileUploader } from '../client/FileUploader';

describe('FileUploader', () => {
    it('forwards provider to the upload request', async () => {
        const sent: FormData[] = [];
        const OriginalXhr = XMLHttpRequest;
        // The setup mock defines `send` per instance; wrap it to capture the request body.
        globalThis.XMLHttpRequest = class extends OriginalXhr {
            constructor() {
                super();
                const original = this.send;
                this.send = vi.fn((data: FormData) => {
                    sent.push(data);
                    return original(data);
                }) as typeof this.send;
            }
        } as typeof XMLHttpRequest;

        try {
            const { getByLabelText } = render(<FileUploader provider="cloudflare-images" autoUpload />);
            fireEvent.change(getByLabelText('File input'), {
                target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] },
            });

            await waitFor(() => expect(sent).toHaveLength(1));
            expect(sent[0].get('provider')).toBe('cloudflare-images');
        } finally {
            globalThis.XMLHttpRequest = OriginalXhr;
        }
    });
});
