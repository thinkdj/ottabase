import { describe, expect, it } from 'vitest';
import * as client from '../client';
import * as root from '../index';

describe('entrypoints', () => {
    it('keeps the root headless — rendered components only come from /client', () => {
        for (const name of ['FileUploader', 'FileUploadList', 'FileUploadItem']) {
            expect(root).not.toHaveProperty(name);
            expect(client).toHaveProperty(name);
        }
    });

    it('exposes the hooks from the root', () => {
        expect(root).toHaveProperty('useFileUpload');
        expect(root).toHaveProperty('useDragAndDrop');
    });
});
