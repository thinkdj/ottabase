import { describe, expect, it } from 'vitest';
import { clampCronPage, formatCronPayload } from '../cron-page-utils';

describe('AdminCronPage helpers', () => {
    it('moves an empty deleted last page back into the refreshed page range', () => {
        expect(clampCronPage(3, 2)).toBe(2);
        expect(clampCronPage(2, 1)).toBe(1);
        expect(clampCronPage(1, 0)).toBe(1);
    });

    it('renders a corrupt legacy payload without crashing the page', () => {
        expect(formatCronPayload('{"ok":true}')).toBe('{\n  "ok": true\n}');
        expect(formatCronPayload('{broken')).toBe('{broken');
    });
});
