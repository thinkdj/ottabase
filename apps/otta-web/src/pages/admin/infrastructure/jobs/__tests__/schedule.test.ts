import { describe, expect, it } from 'vitest';
import { formatJson, nextRuns, scheduleWords, utcStamp } from '../schedule';

describe('schedule helpers', () => {
    it('turns a schedule into words and says when it is not one', () => {
        expect(scheduleWords('0 9 * * 1-5')).toBe('Weekdays at 09:00');
        expect(scheduleWords('whenever')).toBeNull();
    });

    it('lists the next runs in order', () => {
        const after = new Date('2026-10-05T10:30:00Z');
        expect(nextRuns('0 * * * *', 3, after).map((d) => d.toISOString())).toEqual([
            '2026-10-05T11:00:00.000Z',
            '2026-10-05T12:00:00.000Z',
            '2026-10-05T13:00:00.000Z',
        ]);
        expect(nextRuns('nope', 3, after)).toEqual([]);
        expect(utcStamp(after)).toBe('2026-10-05 10:30 UTC');
    });

    it('pretty-prints a payload and leaves a broken one alone', () => {
        expect(formatJson('{"ok":true}')).toBe('{\n  "ok": true\n}');
        expect(formatJson('{broken')).toBe('{broken');
    });
});
