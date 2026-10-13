import { describe, expect, it } from 'vitest';
import * as root from '..';
import * as browser from '../react';

// The root is imported by Workers (e.g. otta-web's media-library route), so it must carry no React
// and no DOM-bound code. Everything browser-bound lives behind `/react`.
describe('entrypoint boundary', () => {
    it('keeps browser-bound exports off the pure root', () => {
        for (const name of ['useMediaLightboxUrlSync', 'MediaLightbox', 'MediaLightboxProvider', 'MediaPreview']) {
            expect(root).not.toHaveProperty(name);
        }
    });

    it('exposes the browser surface from /react', () => {
        for (const name of ['useMediaLightboxUrlSync', 'MediaLightbox', 'MediaLightboxProvider', 'MediaPreview']) {
            expect(browser).toHaveProperty(name);
        }
    });
});
