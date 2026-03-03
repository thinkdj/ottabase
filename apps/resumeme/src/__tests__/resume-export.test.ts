import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPdfMetadata, buildPlainText, convertZoomToTransform, exportAsPlainText } from '../lib/resume-export';
import type { ResumeTemplateData } from '../pages/resume/types';

// ---------------------------------------------------------------------------
// Test fixture — minimal resume sample
// ---------------------------------------------------------------------------

const SAMPLE_DATA: ResumeTemplateData = {
    fullName: 'Jane Smith',
    summary: {
        id: 'summary-1',
        title: 'Profile Summary',
        content: 'Seasoned design engineer with over 10 years of experience.',
    },
    profile: {
        headline: 'Senior Software Engineer',
        email: 'jane@example.com',
        phone: '+1-555-0100',
        location: 'San Francisco, CA',
        website: 'https://janesmith.dev',
        linkedinUrl: 'https://linkedin.com/in/janesmith.js',
        githubUrl: 'https://github.com/janesmith.js',
        avatarUrl: null,
    },
    workExperiences: [
        {
            id: 'w1',
            company: 'Acme Corp',
            designation: 'Software Engineer',
            location: 'Remote',
            startDate: '2020-01',
            endDate: null,
            isCurrent: true,
            description: 'Built scalable backend services.',
            highlights: ['Reduced latency by 40%', 'Led re-architecture initiative'],
        },
    ],
    educations: [
        {
            id: 'e1',
            institution: 'MIT',
            degree: 'B.Sc Computer Science',
            field: 'Computer Science',
            startDate: '2012-09',
            endDate: '2016-05',
            grade: 'GPA 3.9',
            description: null,
        },
    ],
    skillSets: [
        {
            id: 's1',
            name: 'Frontend',
            skills: ['React', 'TypeScript', 'CSS'],
        },
    ],
    projects: [
        {
            id: 'p1',
            title: 'OttaORM',
            description: 'Fat-model ORM for Cloudflare Workers.',
            url: 'https://github.com/thinkdj/ottabase',
            techStack: ['TypeScript', 'Drizzle'],
            startDate: '2023-03',
            endDate: null,
        },
    ],
    certifications: [
        {
            id: 'c1',
            name: 'AWS Solutions Architect',
            issuer: 'Amazon Web Services',
            issueDate: '2023-06',
            expiryDate: '2026-06',
            credentialUrl: 'https://aws.amazon.com/verify/cert-123',
        },
    ],
};

// ---------------------------------------------------------------------------
// buildPlainText
// ---------------------------------------------------------------------------

describe('buildPlainText', () => {
    it('includes the full name uppercased in the header', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('JANE SMITH');
    });

    it('includes contact details from the profile', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('jane@example.com');
        expect(text).toContain('+1-555-0100');
        expect(text).toContain('San Francisco, CA');
    });

    it('includes the profile headline', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('Senior Software Engineer');
    });

    it('includes the SUMMARY section', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('SUMMARY');
        expect(text).toContain('Seasoned design engineer');
    });

    it('includes work experience with bullet highlights', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('EXPERIENCE');
        expect(text).toContain('Software Engineer — Acme Corp');
        expect(text).toContain('• Reduced latency by 40%');
        expect(text).toContain('• Led re-architecture initiative');
    });

    it('includes education section', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('EDUCATION');
        expect(text).toContain('B.Sc Computer Science in Computer Science — MIT');
        expect(text).toContain('Grade: GPA 3.9');
    });

    it('includes skills section', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('SKILLS');
        expect(text).toContain('Frontend: React, TypeScript, CSS');
    });

    it('includes projects section', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('PROJECTS');
        expect(text).toContain('OttaORM');
        expect(text).toContain('Tech: TypeScript, Drizzle');
    });

    it('includes certifications section', () => {
        const text = buildPlainText(SAMPLE_DATA);
        expect(text).toContain('CERTIFICATIONS');
        expect(text).toContain('AWS Solutions Architect — Amazon Web Services');
        expect(text).toContain('https://aws.amazon.com/verify/cert-123');
    });

    it('gracefully handles empty sections', () => {
        const minimal: ResumeTemplateData = {
            fullName: 'John Doe',
            profile: null,
            workExperiences: [],
            educations: [],
            skillSets: [],
            projects: [],
            certifications: [],
        };
        const text = buildPlainText(minimal);
        expect(text).toContain('JOHN DOE');
        expect(text).not.toContain('EXPERIENCE');
        expect(text).not.toContain('SKILLS');
    });
});

// ---------------------------------------------------------------------------
// exportAsPlainText — tests DOM download trigger
// ---------------------------------------------------------------------------

describe('exportAsPlainText', () => {
    beforeEach(() => {
        // Mock URL.createObjectURL / revokeObjectURL
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn().mockReturnValue('blob:fake-url'),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.clearAllTimers();
    });

    it('creates and clicks a hidden anchor to trigger download', () => {
        const clickSpy = vi.fn();
        const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
        const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'a') {
                return {
                    href: '',
                    download: '',
                    style: { display: '' },
                    click: clickSpy,
                } as unknown as HTMLAnchorElement;
            }
            return document.createElement(tag);
        });

        exportAsPlainText(SAMPLE_DATA, 'dev-resume');
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(appendSpy).toHaveBeenCalledOnce();
        expect(removeSpy).toHaveBeenCalledOnce();
    });

    it('sanitises illegal filename characters', () => {
        const anchors: { download: string }[] = [];
        vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
        vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'a') {
                const a = { href: '', download: '', style: { display: '' }, click: vi.fn() };
                anchors.push(a);
                return a as unknown as HTMLAnchorElement;
            }
            return document.createElement(tag);
        });

        exportAsPlainText(SAMPLE_DATA, 'My Resume: Final/Draft');
        // Illegal chars replaced with underscores; .txt suffix appended
        expect(anchors[0]?.download).toBe('My Resume_ Final_Draft.txt');
    });
});

// ---------------------------------------------------------------------------
// buildPdfMetadata — derives PDF document metadata from resolved resume data
// ---------------------------------------------------------------------------

describe('buildPdfMetadata', () => {
    it('sets title as "fullName - headline" when headline is present', () => {
        const meta = buildPdfMetadata(SAMPLE_DATA);
        expect(meta.title).toBe('Jane Smith - Senior Software Engineer');
    });

    it('sets title to just fullName when headline is absent', () => {
        const data: ResumeTemplateData = { ...SAMPLE_DATA, profile: { ...SAMPLE_DATA.profile!, headline: null } };
        const meta = buildPdfMetadata(data);
        expect(meta.title).toBe('Jane Smith');
    });

    it('always sets author to "ResumeMe"', () => {
        const meta = buildPdfMetadata(SAMPLE_DATA);
        expect(meta.author).toBe('ResumeMe');
    });

    it('sets subject using headline when present', () => {
        const meta = buildPdfMetadata(SAMPLE_DATA);
        expect(meta.subject).toBe('Senior Software Engineer Resume');
    });

    it('falls back to first job designation for subject when no headline', () => {
        const data: ResumeTemplateData = { ...SAMPLE_DATA, profile: { ...SAMPLE_DATA.profile!, headline: '' } };
        const meta = buildPdfMetadata(data);
        expect(meta.subject).toBe('Software Engineer Resume');
    });

    it('falls back to "Professional Resume" when no headline or job', () => {
        const data: ResumeTemplateData = {
            ...SAMPLE_DATA,
            profile: { ...SAMPLE_DATA.profile!, headline: null },
            workExperiences: [],
        };
        const meta = buildPdfMetadata(data);
        expect(meta.subject).toBe('Professional Resume');
    });

    it('includes individual skills in keywords', () => {
        const meta = buildPdfMetadata(SAMPLE_DATA);
        expect(meta.keywords).toContain('React');
        expect(meta.keywords).toContain('TypeScript');
        expect(meta.keywords).toContain('CSS');
    });

    it('includes tech stack entries in keywords', () => {
        const meta = buildPdfMetadata(SAMPLE_DATA);
        expect(meta.keywords).toContain('Drizzle');
    });

    it('includes certification names in keywords', () => {
        const meta = buildPdfMetadata(SAMPLE_DATA);
        expect(meta.keywords).toContain('AWS Solutions Architect');
    });

    it('includes education degree and field in keywords', () => {
        const meta = buildPdfMetadata(SAMPLE_DATA);
        expect(meta.keywords).toContain('B.Sc Computer Science');
        expect(meta.keywords).toContain('Computer Science');
    });

    it('includes location in keywords', () => {
        const meta = buildPdfMetadata(SAMPLE_DATA);
        expect(meta.keywords).toContain('San Francisco, CA');
    });

    it('deduplicates keywords case-insensitively', () => {
        // "TypeScript" appears in both skillSets and techStack — should only appear once
        const meta = buildPdfMetadata(SAMPLE_DATA);
        const keywordList = meta.keywords.split(', ');
        const lowerList = keywordList.map((k) => k.toLowerCase());
        expect(lowerList.filter((k) => k === 'typescript')).toHaveLength(1);
    });

    it('caps keywords at 30 items', () => {
        // Build a data set with 50 unique skills
        const data: ResumeTemplateData = {
            ...SAMPLE_DATA,
            skillSets: [{ id: 's1', name: 'All', skills: Array.from({ length: 50 }, (_, i) => `Skill${i}`) }],
        };
        const meta = buildPdfMetadata(data);
        const keywordList = meta.keywords.split(', ');
        expect(keywordList.length).toBeLessThanOrEqual(30);
    });

    it('handles a resume with no skills, projects or certs gracefully', () => {
        const minimal: ResumeTemplateData = {
            fullName: 'John Doe',
            profile: {
                headline: null,
                email: null,
                phone: null,
                location: null,
                avatarUrl: null,
                website: null,
                linkedinUrl: null,
                githubUrl: null,
            },
            summary: null,
            workExperiences: [],
            educations: [],
            skillSets: [],
            projects: [],
            certifications: [],
        };
        const meta = buildPdfMetadata(minimal);
        expect(meta.title).toBe('John Doe');
        expect(meta.author).toBe('ResumeMe');
        expect(meta.subject).toBe('Professional Resume');
        expect(meta.keywords).toBe('');
    });
});

// ---------------------------------------------------------------------------
// convertZoomToTransform — CSS zoom → transform:scale() for PDF rendering
// ---------------------------------------------------------------------------

describe('convertZoomToTransform', () => {
    it('converts zoom to transform:scale() with correct origin', () => {
        const el = document.createElement('div');
        el.style.zoom = '0.9';

        convertZoomToTransform(el);

        expect(el.style.zoom).toBe('');
        expect(el.style.transform).toBe('scale(0.9)');
        expect(el.style.transformOrigin).toBe('top left');
    });

    it('adjusts width to compensate for scale factor', () => {
        const el = document.createElement('div');
        el.style.zoom = '0.8';

        convertZoomToTransform(el);

        // 100 / 0.8 = 125%
        expect(el.style.width).toBe('125%');
    });

    it('does not adjust width when zoom is 1', () => {
        const el = document.createElement('div');
        el.style.zoom = '1';

        convertZoomToTransform(el);

        expect(el.style.transform).toBe('scale(1)');
        // width should not be set when zoom is 1 (no scaling needed)
        expect(el.style.width).toBe('');
    });

    it('is a no-op when element has no zoom', () => {
        const el = document.createElement('div');
        el.style.color = 'red';

        convertZoomToTransform(el);

        expect(el.style.transform).toBe('');
        expect(el.style.color).toBe('red');
    });

    it('ignores invalid zoom values', () => {
        const el = document.createElement('div');
        el.style.zoom = 'invalid';

        convertZoomToTransform(el);

        // Should be a no-op since parseFloat('invalid') is NaN
        expect(el.style.transform).toBe('');
    });
});
