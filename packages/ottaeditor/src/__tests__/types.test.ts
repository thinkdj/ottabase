import { describe, expect, it } from 'vitest';
import type { OttaEditorPlugin } from '../types';

describe('OttaEditor plugin types', () => {
    it('accepts tool-specific constructor options as plugin config', () => {
        const config: NonNullable<OttaEditorPlugin['config']> = {
            provider: 'r2',
            uploadEndpoint: '/api/upload',
        };

        expect(config).toEqual({ provider: 'r2', uploadEndpoint: '/api/upload' });
    });
});
