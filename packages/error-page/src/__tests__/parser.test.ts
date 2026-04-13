import { describe, it, expect } from 'vitest';
import { parseError } from '../parser';

describe('parseError', () => {
    it('should parse a standard Error', () => {
        const error = new Error('Test error message');
        const parsed = parseError(error);

        expect(parsed.type).toBe('Error');
        expect(parsed.message).toBe('Test error message');
        expect(parsed.frames.length).toBeGreaterThan(0);
        expect(parsed.rawStack).toBeDefined();
        expect(parsed.cause).toBeUndefined();
    });

    it('should parse a TypeError', () => {
        const error = new TypeError('Cannot read property');
        const parsed = parseError(error);

        expect(parsed.type).toBe('TypeError');
        expect(parsed.message).toBe('Cannot read property');
    });

    it('should parse error with cause', () => {
        const cause = new Error('Root cause');
        const error = new Error('Wrapper error', { cause });
        const parsed = parseError(error);

        expect(parsed.cause).toBeDefined();
        expect(parsed.cause!.type).toBe('Error');
        expect(parsed.cause!.message).toBe('Root cause');
    });

    it('should handle non-Error values (string)', () => {
        const parsed = parseError('something went wrong');

        expect(parsed.type).toBe('string');
        expect(parsed.message).toBe('something went wrong');
        expect(parsed.frames).toHaveLength(0);
    });

    it('should handle non-Error values (number)', () => {
        const parsed = parseError(42);

        expect(parsed.type).toBe('number');
        expect(parsed.message).toBe('42');
    });

    it('should handle non-Error values (object)', () => {
        const parsed = parseError({ code: 'FAIL', detail: 'bad request' });

        expect(parsed.type).toBe('Object');
        expect(parsed.properties).toHaveProperty('code', 'FAIL');
    });

    it('should handle null/undefined', () => {
        expect(parseError(null).message).toBe('null');
        expect(parseError(undefined).message).toBe('undefined');
    });

    it('should apply offset to skip frames', () => {
        const error = new Error('Test');
        const allFrames = parseError(error, 0);
        const offsetFrames = parseError(error, 2);

        expect(offsetFrames.frames.length).toBe(Math.max(0, allFrames.frames.length - 2));
    });

    it('should extract extra properties from error objects', () => {
        const error = new Error('Custom error');
        (error as Record<string, unknown>).code = 'CUSTOM_CODE';
        (error as Record<string, unknown>).status = 422;

        const parsed = parseError(error);

        expect(parsed.properties).toHaveProperty('code', 'CUSTOM_CODE');
        expect(parsed.properties).toHaveProperty('status', 422);
    });

    it('should mark node_modules frames as non-app', () => {
        const error = new Error('Test');
        const parsed = parseError(error);

        for (const frame of parsed.frames) {
            if (frame.file?.includes('node_modules')) {
                expect(frame.isApp).toBe(false);
            }
        }
    });

    it('should parse frames with file, line, and column', () => {
        const error = new Error('Test');
        const parsed = parseError(error);

        // At least the first frame should have file/line/column info
        const framesWithInfo = parsed.frames.filter((f) => f.file && f.line && f.column);
        expect(framesWithInfo.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested causes', () => {
        const deepCause = new Error('Level 3');
        const midCause = new Error('Level 2', { cause: deepCause });
        const error = new Error('Level 1', { cause: midCause });

        const parsed = parseError(error);

        expect(parsed.cause).toBeDefined();
        expect(parsed.cause!.cause).toBeDefined();
        expect(parsed.cause!.cause!.message).toBe('Level 3');
    });
});
