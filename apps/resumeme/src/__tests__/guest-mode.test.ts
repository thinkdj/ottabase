import { describe, it, expect } from 'vitest';
import { GUEST_DATA, GUEST_AVATAR_URL } from '../pages/resume/guestData';
import type { ResumeTemplateData } from '../pages/resume/types';

describe('Guest Mode Data', () => {
    it('exports GUEST_DATA conforming to ResumeTemplateData', () => {
        const data: ResumeTemplateData = GUEST_DATA;
        expect(data).toBeDefined();
    });

    describe('identity lock', () => {
        it('fullName is always "John Doe"', () => {
            expect(GUEST_DATA.fullName).toBe('John Doe');
        });

        it('has a profile with avatar URL', () => {
            expect(GUEST_DATA.profile).not.toBeNull();
            expect(GUEST_DATA.profile?.avatarUrl).toBe(GUEST_AVATAR_URL);
        });

        it('avatar URL is a valid URL', () => {
            expect(GUEST_AVATAR_URL).toMatch(/^https?:\/\//);
        });
    });

    describe('mock data completeness', () => {
        it('has at least 2 skill sets', () => {
            expect(GUEST_DATA.skillSets.length).toBeGreaterThanOrEqual(2);
        });

        it('has at least 2 work experiences', () => {
            expect(GUEST_DATA.workExperiences.length).toBeGreaterThanOrEqual(2);
        });

        it('has at least 1 education entry', () => {
            expect(GUEST_DATA.educations.length).toBeGreaterThanOrEqual(1);
        });

        it('has at least 1 project', () => {
            expect(GUEST_DATA.projects.length).toBeGreaterThanOrEqual(1);
        });

        it('has at least 1 certification', () => {
            expect(GUEST_DATA.certifications.length).toBeGreaterThanOrEqual(1);
        });

        it('profile has contact details', () => {
            const p = GUEST_DATA.profile!;
            expect(p.email).toBeTruthy();
            expect(p.phone).toBeTruthy();
            expect(p.location).toBeTruthy();
        });

        it('all items have unique IDs', () => {
            const allIds = [
                ...GUEST_DATA.skillSets.map((s) => s.id),
                ...GUEST_DATA.workExperiences.map((w) => w.id),
                ...GUEST_DATA.educations.map((e) => e.id),
                ...GUEST_DATA.projects.map((p) => p.id),
                ...GUEST_DATA.certifications.map((c) => c.id),
            ];
            expect(new Set(allIds).size).toBe(allIds.length);
        });

        it('work experiences have highlights', () => {
            for (const exp of GUEST_DATA.workExperiences) {
                expect(exp.highlights.length).toBeGreaterThan(0);
            }
        });
    });
});
