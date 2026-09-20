import { describe, expect, it } from 'vitest';
import { getPublicContentPath } from '../blogAdminPaths';

describe('getPublicContentPath', () => {
    it('maps saved content to its public route and safely encodes the slug', () => {
        expect(getPublicContentPath('dry season', 'blog')).toBe('/blog/dry%20season');
        expect(getPublicContentPath('release-1', 'changelog')).toBe('/changelog/release-1');
        expect(getPublicContentPath('getting-started', 'docs')).toBe('/docs/getting-started');
    });
});
