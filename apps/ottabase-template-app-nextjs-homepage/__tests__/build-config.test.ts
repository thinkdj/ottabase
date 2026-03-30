import { describe, expect, it } from 'vitest';

import packageJson from '../package.json';

describe('Build configuration', () => {
    it('uses webpack for production build to keep OpenNext server chunks runtime-compatible', () => {
        expect(packageJson.scripts.build).toBe('next build --webpack');
    });
});
