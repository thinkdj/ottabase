import { describe, expect, it } from 'vitest';
import {
    DEFAULT_HEADING_LABELS,
    DEFAULT_SECTION_ORDER,
    FONT_SIZE_DEFAULT,
    FONT_SIZE_MAX,
    FONT_SIZE_MIN,
    formatDateRange,
    formatResumeDate,
    moveSectionDown,
    moveSectionUp,
    resolveHeadingLabel,
    RESUME_TEMPLATES,
    type SectionKey,
} from '../pages/resume/types';

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
        it('includes all eight templates', () => {
            expect(RESUME_TEMPLATES).toHaveLength(8);
            expect(RESUME_TEMPLATES.map((t) => t.id)).toEqual([
                'classic',
                'modern',
                'lisbon',
                'executive',
                'minimal',
                'clean',
                'creative',
                'bold',
            ]);
        });

        it('each template has required metadata', () => {
            for (const template of RESUME_TEMPLATES) {
                expect(template.id).toBeTruthy();
                expect(template.name).toBeTruthy();
                expect(template.description).toBeTruthy();
            }
        });

        it('all template IDs are unique', () => {
            const ids = RESUME_TEMPLATES.map((t) => t.id);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('Font size constants', () => {
        it('defines valid font size range', () => {
            expect(FONT_SIZE_MIN).toBeLessThan(FONT_SIZE_MAX);
            expect(FONT_SIZE_DEFAULT).toBeGreaterThanOrEqual(FONT_SIZE_MIN);
            expect(FONT_SIZE_DEFAULT).toBeLessThanOrEqual(FONT_SIZE_MAX);
        });

        it('has sensible defaults', () => {
            expect(FONT_SIZE_MIN).toBe(80);
            expect(FONT_SIZE_MAX).toBe(130);
            expect(FONT_SIZE_DEFAULT).toBe(100);
        });
    });

    describe('Section ordering', () => {
        it('DEFAULT_SECTION_ORDER contains all 6 section keys', () => {
            expect(DEFAULT_SECTION_ORDER).toHaveLength(6);
            expect(DEFAULT_SECTION_ORDER).toContain('summary');
            expect(DEFAULT_SECTION_ORDER).toContain('workExperiences');
            expect(DEFAULT_SECTION_ORDER).toContain('educations');
            expect(DEFAULT_SECTION_ORDER).toContain('skillSets');
            expect(DEFAULT_SECTION_ORDER).toContain('projects');
            expect(DEFAULT_SECTION_ORDER).toContain('certifications');
        });

        it('default order starts with summary, then work experience', () => {
            expect(DEFAULT_SECTION_ORDER[0]).toBe('summary');
            expect(DEFAULT_SECTION_ORDER[1]).toBe('workExperiences');
        });

        describe('moveSectionUp', () => {
            const order: SectionKey[] = ['summary', 'workExperiences', 'educations'];

            it('swaps section with the one above', () => {
                const result = moveSectionUp(order, 'educations');
                expect(result).toEqual(['summary', 'educations', 'workExperiences']);
            });

            it('returns same array when section is already first', () => {
                const result = moveSectionUp(order, 'summary');
                expect(result).toBe(order);
            });

            it('returns same array for unknown key', () => {
                const result = moveSectionUp(order, 'unknown' as SectionKey);
                expect(result).toBe(order);
            });

            it('does not mutate the original array', () => {
                const original = [...order];
                moveSectionUp(order, 'educations');
                expect(order).toEqual(original);
            });
        });

        describe('moveSectionDown', () => {
            const order: SectionKey[] = ['summary', 'workExperiences', 'educations'];

            it('swaps section with the one below', () => {
                const result = moveSectionDown(order, 'workExperiences');
                expect(result).toEqual(['summary', 'educations', 'workExperiences']);
            });

            it('returns same array when summary is pinned at first', () => {
                const result = moveSectionDown(order, 'summary');
                expect(result).toBe(order);
            });

            it('returns same array when section is already last', () => {
                const result = moveSectionDown(order, 'educations');
                expect(result).toBe(order);
            });

            it('returns same array for unknown key', () => {
                const result = moveSectionDown(order, 'unknown' as SectionKey);
                expect(result).toBe(order);
            });

            it('does not mutate the original array', () => {
                const original = [...order];
                moveSectionDown(order, 'workExperiences');
                expect(order).toEqual(original);
            });
        });

        describe('summary pinning', () => {
            const order: SectionKey[] = ['summary', 'workExperiences', 'educations', 'skillSets'];

            it('prevents moving workExperiences above summary', () => {
                const result = moveSectionUp(order, 'workExperiences');
                expect(result).toBe(order);
            });

            it('allows moving educations up (not into summary position)', () => {
                const result = moveSectionUp(order, 'educations');
                expect(result).toEqual(['summary', 'educations', 'workExperiences', 'skillSets']);
            });

            it('prevents summary from moving down', () => {
                const result = moveSectionDown(order, 'summary');
                expect(result).toBe(order);
            });
        });
    });

    describe('Heading labels', () => {
        it('DEFAULT_HEADING_LABELS has all section keys', () => {
            for (const key of DEFAULT_SECTION_ORDER) {
                expect(DEFAULT_HEADING_LABELS[key]).toBeTruthy();
            }
        });

        it('resolveHeadingLabel returns override when provided', () => {
            const overrides = { summary: 'About Me' };
            expect(resolveHeadingLabel('summary', overrides)).toBe('About Me');
        });

        it('resolveHeadingLabel falls back to template default', () => {
            expect(resolveHeadingLabel('summary', {}, 'Profile')).toBe('Profile');
        });

        it('resolveHeadingLabel falls back to global default', () => {
            expect(resolveHeadingLabel('summary')).toBe('Summary');
        });
    });
});
