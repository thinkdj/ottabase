import { describe, expect, it } from 'vitest';
import * as core from '../index';
import * as rendered from '../renderer';
import * as share from '../components/ShareButton';

describe('ottablog entrypoint boundaries', () => {
    it('keeps rendered UI out of the headless package root', () => {
        expect(core).not.toHaveProperty('BlogRenderer');
        expect(core).not.toHaveProperty('PhotoJournalRenderer');
        expect(core).not.toHaveProperty('PhotoJournalGallery');
    });

    it('exposes article, blurb, and photo-journal UI from the renderer subpath', () => {
        expect(rendered.BlogRenderer).toBeTypeOf('function');
        expect(rendered.BlurbRenderer).toBeTypeOf('function');
        expect(rendered.PhotoJournalRenderer).toBeTypeOf('function');
        expect(rendered.PhotoJournalGallery).toBeTypeOf('function');
        expect(rendered).not.toHaveProperty('ShareButton');
    });

    it('exposes ShareButton from its standalone subpath', () => {
        expect(share.ShareButton).toBeTypeOf('function');
    });
});
