import { describe, it, expect } from 'vitest';
import { formatResumeDate, formatDateRange, RESUME_TEMPLATES } from '../pages/resume/types';

describe('Resume Types & Utilities', () => {
    describe('formatResumeDate', () => {
        it('formats YYYY-MM to readable date', () => {
            expect(formatResumeDate('2024-01')).toBe('Jan 2024');
            expect(formatResumeDate('2023-12')).toBe('Dec 2023');
            expect(formatResumeDate('2022-06')).toBe('Jun 2022');
        });

        it('returns empty string for null/undefined', () => {
            expect(formatResumeDate(null)).toBe('');
            expect(formatResumeDate(undefined)).toBe('');
        });

        it('handles year-only input', () => {
            expect(formatResumeDate('2024')).toBe('2024');
        });

        it('handles empty string', () => {
            expect(formatResumeDate('')).toBe('');
        });
    });

    describe('formatDateRange', () => {
        it('formats start to end date', () => {
            expect(formatDateRange('2022-01', '2024-06')).toBe('Jan 2022 — Jun 2024');
        });

        it('shows Present for current positions', () => {
            expect(formatDateRange('2022-01', null, true)).toBe('Jan 2022 — Present');
        });

        it('handles missing start date', () => {
            expect(formatDateRange(null, '2024-06')).toBe('Jun 2024');
        });

        it('handles both dates missing', () => {
            expect(formatDateRange(null, null)).toBe('');
        });

        it('handles start date only', () => {
            expect(formatDateRange('2022-01', null, false)).toBe('Jan 2022');
        });
    });

    describe('RESUME_TEMPLATES', () => {
        it('includes classic and modern templates', () => {
            expect(RESUME_TEMPLATES).toHaveLength(2);
            expect(RESUME_TEMPLATES.map((t) => t.id)).toEqual(['classic', 'modern']);
        });

        it('each template has required metadata', () => {
            for (const template of RESUME_TEMPLATES) {
                expect(template.id).toBeTruthy();
                expect(template.name).toBeTruthy();
                expect(template.description).toBeTruthy();
            }
        });
    });
});
