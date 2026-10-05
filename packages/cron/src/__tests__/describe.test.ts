import { describe, expect, it } from 'vitest';
import { CronPresets } from '../cron-parser';
import { describeCron } from '../describe';

describe('describeCron', () => {
    it('puts the presets into words', () => {
        expect(describeCron(CronPresets.EVERY_MINUTE)).toBe('Every minute');
        expect(describeCron(CronPresets.EVERY_5_MINUTES)).toBe('Every 5 minutes');
        expect(describeCron(CronPresets.EVERY_30_MINUTES)).toBe('Every 30 minutes');
        expect(describeCron(CronPresets.HOURLY)).toBe('Every hour');
        expect(describeCron(CronPresets.DAILY)).toBe('Every day at 00:00');
        expect(describeCron(CronPresets.DAILY_AT_9AM)).toBe('Every day at 09:00');
        expect(describeCron(CronPresets.WEEKLY)).toBe('Every Sunday at 00:00');
        expect(describeCron(CronPresets.MONTHLY)).toBe('On the 1st of every month at 00:00');
        expect(describeCron(CronPresets.WEEKDAYS_9AM)).toBe('Weekdays at 09:00');
    });

    it('handles minutes, steps, ranges and lists', () => {
        expect(describeCron('30 * * * *')).toBe('Every hour at :30');
        expect(describeCron('0,30 * * * *')).toBe('Every 30 minutes');
        expect(describeCron('5,35 * * * *')).toBe('Every hour at :05 and :35');
        expect(describeCron('0 */6 * * *')).toBe('Every 6 hours');
        expect(describeCron('15 */2 * * *')).toBe('Every 2 hours at :15');
        expect(describeCron('0 9-17 * * 1-5')).toBe('Every hour from 09:00 to 17:00 on weekdays');
        expect(describeCron('*/15 9-17 * * *')).toBe('Every 15 minutes from 09:00 to 17:59');
        expect(describeCron('0 9,17 * * *')).toBe('Every day at 09:00 and 17:00');
        expect(describeCron('0,30 9,17 * * *')).toBe('Every day at 09:00, 09:30, 17:00 and 17:30');
        expect(describeCron('0,15,30,45 9,12,15 * * *')).toBe('Every 15 minutes at hours 09, 12 and 15');
        expect(describeCron('5,25 9,12,15,18 * * *')).toBe(
            'Every day at minutes 5 and 25 past hours 09, 12, 15 and 18',
        );
    });

    it('says which days', () => {
        expect(describeCron('0 12 * * 1,3,5')).toBe('Every Monday, Wednesday and Friday at 12:00');
        expect(describeCron('*/15 * * * 0,6')).toBe('Every 15 minutes on weekends');
        expect(describeCron('0 * * * 1')).toBe('Every hour on Mondays');
        expect(describeCron('0 0 1,15 * *')).toBe('On the 1st and 15th of every month at 00:00');
        expect(describeCron('0 0 22 * *')).toBe('On the 22nd of every month at 00:00');
        expect(describeCron('0 0 1 1,7 *')).toBe('On the 1st of January and July at 00:00');
        expect(describeCron('0 8 * 12 *')).toBe('Every day in December at 08:00');
        expect(describeCron('0 8 * 12 1-5')).toBe('Weekdays in December at 08:00');
        expect(describeCron('0 0 13 * 5')).toBe('On the 13th of every month or on Fridays at 00:00');
    });

    it('rejects what the parser rejects', () => {
        expect(() => describeCron('bad')).toThrow();
        expect(() => describeCron('60 * * * *')).toThrow();
    });
});
