import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPlainText, exportAsPlainText } from '../lib/resume-export';
import type { ResumeTemplateData } from '../pages/resume/types';

// ---------------------------------------------------------------------------
// Test fixture — minimal resume sample
// ---------------------------------------------------------------------------

const SAMPLE_DATA: ResumeTemplateData = {
    fullName: 'Jane Smith',
    profile: {
        headline: 'Senior Software Engineer',
        summary: 'Seasoned engineer with 10 years of experience.',
        email: 'jane@example.com',
        phone: '+1-555-0100',
        location: 'San Francisco, CA',
        website: 'https://janesmith.dev',
        linkedinUrl: 'https://linkedin.com/in/janesmith',
        githubUrl: 'https://github.com/janesmith',
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
        expect(text).toContain('Seasoned engineer');
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
