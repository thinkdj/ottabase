import { describe, expect, it } from 'vitest';
import { parseDefaultSize } from '../hooks/useSplitPane';

describe('parseDefaultSize', () => {
    it('parses percent, px strings, bare numbers and falls back to 50%', () => {
        expect(parseDefaultSize('30%')).toEqual({ size: 30, isPercentage: true });
        expect(parseDefaultSize('200px')).toEqual({ size: 200, isPercentage: false });
        expect(parseDefaultSize('200')).toEqual({ size: 200, isPercentage: false });
        expect(parseDefaultSize(240)).toEqual({ size: 240, isPercentage: false });
        expect(parseDefaultSize('wide')).toEqual({ size: 50, isPercentage: true });
    });
});
