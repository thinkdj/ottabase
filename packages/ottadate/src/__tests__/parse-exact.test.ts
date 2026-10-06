import { describe, expect, it } from 'vitest';
import { parseExactDate } from '../core/parse-exact';

const now = new Date(2026, 0, 15, 10, 30);
const day = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m, d, h, min, s);

describe('parseExactDate', () => {
    it('reads ISO and month-name dates, with or without a year', () => {
        expect(parseExactDate('2026-03-09', { now })).toEqual(day(2026, 2, 9));
        expect(parseExactDate('5 jan 2026', { now })).toEqual(day(2026, 0, 5));
        expect(parseExactDate('January 5, 2026', { now })).toEqual(day(2026, 0, 5));
        expect(parseExactDate('jan 5 2026', { now })).toEqual(day(2026, 0, 5));
        expect(parseExactDate('5 March', { now })).toEqual(day(2026, 2, 5));
        expect(parseExactDate('mar 5', { now })).toEqual(day(2026, 2, 5));
    });

    it('reads relative days and weekdays from now', () => {
        expect(parseExactDate('today', { now })).toEqual(day(2026, 0, 15));
        expect(parseExactDate('Tomorrow', { now })).toEqual(day(2026, 0, 16));
        expect(parseExactDate('yesterday', { now })).toEqual(day(2026, 0, 14));
        expect(parseExactDate('friday', { now })).toEqual(day(2026, 0, 16));
        expect(parseExactDate('next thursday', { now })).toEqual(day(2026, 0, 22));
    });

    it('takes a time at the end, on either clock', () => {
        expect(parseExactDate('5 jan 2026 14:30', { now })).toEqual(day(2026, 0, 5, 14, 30));
        expect(parseExactDate('tomorrow 9am', { now })).toEqual(day(2026, 0, 16, 9));
        expect(parseExactDate('tomorrow 12:15 pm', { now })).toEqual(day(2026, 0, 16, 12, 15));
        expect(parseExactDate('12 am', { now })).toEqual(day(2026, 0, 15, 0));
        expect(parseExactDate('23:59:59', { now })).toEqual(day(2026, 0, 15, 23, 59, 59));
        expect(parseExactDate('5 jan 2026 14:30', { now, time: false })).toBeNull();
    });

    it('never guesses', () => {
        expect(parseExactDate('', { now })).toBeNull();
        expect(parseExactDate('5/1/2026', { now })).toBeNull();
        expect(parseExactDate('may 2010', { now })).toBeNull();
        expect(parseExactDate('32 jan 2026', { now })).toBeNull();
        expect(parseExactDate('tomorrow 25:00', { now })).toBeNull();
        expect(parseExactDate('tomorrow 13pm', { now })).toBeNull();
        expect(parseExactDate('someday', { now })).toBeNull();
    });
});
