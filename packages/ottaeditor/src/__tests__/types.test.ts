import { describe, expect, it } from 'vitest';
import type { OttaEditorPlugin } from '../types';

describe('OttaEditor plugin types', () => {
    it('accepts tool-specific constructor options as plugin config', () => {
        const config: NonNullable<OttaEditorPlugin['config']> = {
            purpose: 'media',
            uploadEndpoint: '/api/files',
        };

        expect(config).toEqual({ purpose: 'media', uploadEndpoint: '/api/files' });
    });
});
