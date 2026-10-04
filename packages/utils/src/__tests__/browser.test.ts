import { describe, expect, it } from 'vitest';
import { toCsv } from '../browser';

describe('toCsv', () => {
    it('quotes commas, quotes and newlines', () => {
        expect(
            toCsv(
                ['a', 'b'],
                [
                    ['x,y', 'say "hi"'],
                    ['line\nbreak', null],
                ],
            ),
        ).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",');
    });

    it('neutralises formula injection', () => {
        expect(toCsv(['v'], [['=SUM(A1)'], ['+1'], ['-2'], ['@cmd'], [42]])).toBe(
            "v\r\n'=SUM(A1)\r\n'+1\r\n'-2\r\n'@cmd\r\n42",
        );
    });
});
