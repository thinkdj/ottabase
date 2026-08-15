import { describe, expect, it } from 'vitest';
import { sanitizeFileName } from '../client';

describe('sanitizeFileName', () => {
    it('replaces Windows-illegal characters with underscores', () => {
        expect(sanitizeFileName('file:name?test')).toBe('file_name_test');
    });

    it('trims leading and trailing whitespace', () => {
        expect(sanitizeFileName('  my file  ')).toBe('my file');
    });

    it('replaces all illegal characters', () => {
        expect(sanitizeFileName('a\\b/c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
    });

    it('returns "document" for empty string after trim', () => {
        expect(sanitizeFileName('   ')).toBe('document');
    });

    it('passes through clean filenames unchanged', () => {
        expect(sanitizeFileName('my-resume')).toBe('my-resume');
    });

    it('removes HTTP header control characters', () => {
        expect(sanitizeFileName('resume\r\nX-Test: injected')).toBe('resumeX-Test_ injected');
    });
});
