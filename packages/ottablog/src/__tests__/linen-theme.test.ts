import { describe, expect, it } from 'vitest';
import { linenTheme } from '../themes/linen';

describe('linen theme', () => {
    it('is a typography-first personal blog theme', () => {
        expect(linenTheme.metadata.id).toBe('linen');
        expect(linenTheme.config?.classes?.container).toContain('blog-post-linen');
        expect(linenTheme.config?.classes?.title).toContain('font-serif');
        expect(linenTheme.renderers.renderCard).toBeTypeOf('function');
        expect(linenTheme.renderers.renderTitle).toBeTypeOf('function');
    });
});
