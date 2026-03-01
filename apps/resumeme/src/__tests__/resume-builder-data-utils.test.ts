import { describe, expect, it } from 'vitest';
import {
    buildResumeDataSetPersistData,
    normalizeList,
    parseIdSelection,
    parseStringArray,
    toggleSelectedId,
} from '../pages/resume/resume-builder-data-utils';

describe('ResumeBuilder data utilities', () => {
    it('normalizes plain and wrapped list responses', () => {
        expect(normalizeList([{ id: 'a' }])).toEqual([{ id: 'a' }]);
        expect(normalizeList({ data: [{ id: 'b' }] })).toEqual([{ id: 'b' }]);
        expect(normalizeList({})).toEqual([]);
    });

    it('parses array fields from JSON and CSV strings', () => {
        expect(parseStringArray('["React","TypeScript"]')).toEqual(['React', 'TypeScript']);
        expect(parseStringArray('React, TypeScript, Node')).toEqual(['React', 'TypeScript', 'Node']);
        expect(parseStringArray(null)).toEqual([]);
    });

    it('parses nullable id selections from dataset fields', () => {
        expect(parseIdSelection(null)).toBeNull();
        expect(parseIdSelection('')).toBeNull();
        expect(parseIdSelection('["1","2"]')).toEqual(['1', '2']);
        expect(parseIdSelection('[]')).toEqual([]);
        expect(parseIdSelection('not-json')).toBeNull();
    });

    it('toggles selected ids deterministically', () => {
        expect(toggleSelectedId(['1', '2'], '3')).toEqual(['1', '2', '3']);
        expect(toggleSelectedId(['1', '2'], '2')).toEqual(['1']);
        expect(toggleSelectedId(['1'], '1')).toEqual([]);
    });

    it('builds writable-only dataset persist payload with serialized selections', () => {
        const payload = buildResumeDataSetPersistData({
            templateId: 'classic',
            accentColor: '#475569',
            profileId: 'profile-1',
            selectedSkillSetIds: ['s1'],
            selectedWorkExperienceIds: ['w1'],
            selectedEducationIds: ['e1', 'e2'],
            selectedProjectIds: ['p1'],
            selectedCertificationIds: [],
        });

        expect(payload).toEqual({
            templateId: 'classic',
            accentColor: '#475569',
            profileId: 'profile-1',
            selectedSkillSetIds: '["s1"]',
            selectedWorkExperienceIds: '["w1"]',
            selectedEducationIds: '["e1","e2"]',
            selectedProjectIds: '["p1"]',
            selectedCertificationIds: '[]',
        });
        expect(payload).not.toHaveProperty('id');
    });
});
