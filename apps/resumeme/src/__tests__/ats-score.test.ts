import { describe, expect, it } from 'vitest';
import { calculateAtsScore, scoreLabel } from '../lib/ats-score';
import { GUEST_DATA } from '../pages/resume/guestData';
import type { ResumeTemplateData } from '../pages/resume/types';

// ---------------------------------------------------------------------------
// Helper: empty resume shell
// ---------------------------------------------------------------------------
function emptyResume(): ResumeTemplateData {
    return {
        fullName: '',
        summary: null,
        profile: null,
        skillSets: [],
        workExperiences: [],
        educations: [],
        projects: [],
        certifications: [],
    };
}

// ---------------------------------------------------------------------------
// scoreLabel
// ---------------------------------------------------------------------------
describe('scoreLabel', () => {
    it('returns "Excellent" for 85+', () => {
        expect(scoreLabel(85)).toBe('Excellent');
        expect(scoreLabel(100)).toBe('Excellent');
    });

    it('returns "Good" for 70–84', () => {
        expect(scoreLabel(70)).toBe('Good');
        expect(scoreLabel(84)).toBe('Good');
    });

    it('returns "Fair" for 50–69', () => {
        expect(scoreLabel(50)).toBe('Fair');
        expect(scoreLabel(69)).toBe('Fair');
    });

    it('returns "Needs Work" below 50', () => {
        expect(scoreLabel(0)).toBe('Needs Work');
        expect(scoreLabel(49)).toBe('Needs Work');
    });
});

// ---------------------------------------------------------------------------
// calculateAtsScore — overall
// ---------------------------------------------------------------------------
describe('calculateAtsScore', () => {
    it('returns a score between 0 and 100', () => {
        const result = calculateAtsScore(emptyResume());
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
    });

    it('returns a label string', () => {
        const result = calculateAtsScore(emptyResume());
        expect(typeof result.label).toBe('string');
        expect(result.label.length).toBeGreaterThan(0);
    });

    it('returns breakdown with all 8 categories', () => {
        const result = calculateAtsScore(emptyResume());
        const keys = Object.keys(result.breakdown);
        expect(keys).toHaveLength(8);
        expect(keys).toContain('Contact Info');
        expect(keys).toContain('Summary');
        expect(keys).toContain('Work Experience');
        expect(keys).toContain('Education');
        expect(keys).toContain('Skills');
        expect(keys).toContain('Measurable Impact');
        expect(keys).toContain('Structure');
        expect(keys).toContain('Content Length');
    });

    it('breakdown earned never exceeds max', () => {
        const result = calculateAtsScore(GUEST_DATA);
        for (const [, val] of Object.entries(result.breakdown)) {
            expect(val.earned).toBeLessThanOrEqual(val.max);
            expect(val.earned).toBeGreaterThanOrEqual(0);
        }
    });

    it('sum of max points across categories equals 100', () => {
        const result = calculateAtsScore(emptyResume());
        const totalMax = Object.values(result.breakdown).reduce((sum, v) => sum + v.max, 0);
        expect(totalMax).toBe(100);
    });

    it('tips are sorted by severity (critical → warning → info)', () => {
        const result = calculateAtsScore(emptyResume());
        const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
        for (let i = 1; i < result.tips.length; i++) {
            expect(severityOrder[result.tips[i]!.severity]).toBeGreaterThanOrEqual(
                severityOrder[result.tips[i - 1]!.severity]!,
            );
        }
    });

    // ------------------------------------------------------------------
    // Empty resume should score very low
    // ------------------------------------------------------------------
    it('empty resume scores below 10', () => {
        const result = calculateAtsScore(emptyResume());
        expect(result.score).toBeLessThan(10);
        expect(result.label).toBe('Needs Work');
    });

    it('empty resume generates critical tips', () => {
        const result = calculateAtsScore(emptyResume());
        const criticals = result.tips.filter((t) => t.severity === 'critical');
        expect(criticals.length).toBeGreaterThanOrEqual(3);
    });

    // ------------------------------------------------------------------
    // Guest data (well-populated) should score well
    // ------------------------------------------------------------------
    it('GUEST_DATA scores Good or Excellent', () => {
        const result = calculateAtsScore(GUEST_DATA);
        expect(result.score).toBeGreaterThanOrEqual(70);
        expect(['Good', 'Excellent']).toContain(result.label);
    });

    it('GUEST_DATA has few or no critical tips', () => {
        const result = calculateAtsScore(GUEST_DATA);
        const criticals = result.tips.filter((t) => t.severity === 'critical');
        expect(criticals.length).toBeLessThanOrEqual(1);
    });
});

// ---------------------------------------------------------------------------
// Category-specific tests
// ---------------------------------------------------------------------------

describe('ATS score — Contact Info', () => {
    it('earns full 15 pts with complete profile', () => {
        const data = {
            ...emptyResume(),
            fullName: 'Jane Smith',
            profile: {
                email: 'jane@example.com',
                phone: '+1 555-1234',
                location: 'London, UK',
                linkedinUrl: 'https://linkedin.com/in/jane',
                website: 'https://janesmith.dev',
            },
        };
        const result = calculateAtsScore(data);
        expect(result.breakdown['Contact Info']!.earned).toBe(15);
    });

    it('earns 0 pts with totally empty profile', () => {
        const result = calculateAtsScore(emptyResume());
        // No name, no profile at all
        expect(result.breakdown['Contact Info']!.earned).toBe(0);
    });
});

describe('ATS score — Summary', () => {
    it('earns full 10 pts for 30–80 word summary', () => {
        const words = Array(50).fill('word').join(' ');
        const data: ResumeTemplateData = {
            ...emptyResume(),
            summary: { id: 's1', content: words },
        };
        const result = calculateAtsScore(data);
        expect(result.breakdown['Summary']!.earned).toBe(10);
    });

    it('earns 0 pts for missing summary', () => {
        const result = calculateAtsScore(emptyResume());
        expect(result.breakdown['Summary']!.earned).toBe(0);
    });

    it('earns partial for short summary', () => {
        const data: ResumeTemplateData = {
            ...emptyResume(),
            summary: { id: 's1', content: 'Brief summary here.' },
        };
        const result = calculateAtsScore(data);
        expect(result.breakdown['Summary']!.earned).toBeGreaterThan(0);
        expect(result.breakdown['Summary']!.earned).toBeLessThan(10);
    });
});

describe('ATS score — Work Experience', () => {
    it('earns 0 pts with no work entries', () => {
        const result = calculateAtsScore(emptyResume());
        expect(result.breakdown['Work Experience']!.earned).toBe(0);
    });

    it('earns more pts with dates and highlights', () => {
        const data: ResumeTemplateData = {
            ...emptyResume(),
            workExperiences: [
                {
                    id: 'w1',
                    company: 'BigCo',
                    designation: 'Engineer',
                    startDate: '2020-01',
                    endDate: null,
                    isCurrent: true,
                    highlights: ['Built feature X', 'Reduced errors by 50%'],
                },
                {
                    id: 'w2',
                    company: 'SmallCo',
                    designation: 'Intern',
                    startDate: '2019-06',
                    endDate: '2019-12',
                    isCurrent: false,
                    highlights: ['Implemented login system', 'Wrote unit tests'],
                },
            ],
        };
        const result = calculateAtsScore(data);
        expect(result.breakdown['Work Experience']!.earned).toBeGreaterThanOrEqual(20);
    });
});

describe('ATS score — Skills', () => {
    it('earns 0 pts with no skills', () => {
        const result = calculateAtsScore(emptyResume());
        expect(result.breakdown['Skills']!.earned).toBe(0);
    });

    it('earns more pts with multiple categories and 8+ skills', () => {
        const data: ResumeTemplateData = {
            ...emptyResume(),
            skillSets: [
                { id: 's1', name: 'Languages', skills: ['TypeScript', 'Python', 'Go', 'Rust'] },
                { id: 's2', name: 'Tools', skills: ['Docker', 'Git', 'Terraform', 'K8s'] },
            ],
        };
        const result = calculateAtsScore(data);
        expect(result.breakdown['Skills']!.earned).toBe(15);
    });
});

describe('ATS score — Measurable Impact', () => {
    it('earns 0 pts when no highlights at all', () => {
        const result = calculateAtsScore(emptyResume());
        expect(result.breakdown['Measurable Impact']!.earned).toBe(0);
    });

    it('earns full pts when ≥50% highlights have numbers', () => {
        const data: ResumeTemplateData = {
            ...emptyResume(),
            workExperiences: [
                {
                    id: 'w1',
                    company: 'Co',
                    designation: 'Dev',
                    isCurrent: false,
                    highlights: ['Reduced latency by 40%', 'Served 10M users', 'Built a cool thing'],
                },
            ],
        };
        const result = calculateAtsScore(data);
        // 2/3 = 66% have numbers → full 10 pts
        expect(result.breakdown['Measurable Impact']!.earned).toBe(10);
    });

    it('earns 0 pts when no highlights have numbers', () => {
        const data: ResumeTemplateData = {
            ...emptyResume(),
            workExperiences: [
                {
                    id: 'w1',
                    company: 'Co',
                    designation: 'Dev',
                    isCurrent: false,
                    highlights: ['Built features', 'Worked with team', 'Improved processes'],
                },
            ],
        };
        const result = calculateAtsScore(data);
        expect(result.breakdown['Measurable Impact']!.earned).toBe(0);
    });
});

describe('ATS score — Content Length', () => {
    it('earns minimal pts for very sparse resume', () => {
        const data: ResumeTemplateData = {
            ...emptyResume(),
            summary: { id: 's1', content: 'Hello' },
        };
        const result = calculateAtsScore(data);
        expect(result.breakdown['Content Length']!.earned).toBeLessThanOrEqual(3);
    });
});
