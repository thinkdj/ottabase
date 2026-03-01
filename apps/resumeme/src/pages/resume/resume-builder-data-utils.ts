export function normalizeList<T>(result: unknown): T[] {
    if (Array.isArray(result)) return result as T[];
    if (result && typeof result === 'object') {
        const data = (result as { data?: unknown }).data;
        if (Array.isArray(data)) return data as T[];
    }
    return [];
}

export function parseIdSelection(value: unknown): string[] | null {
    if (value == null || value === '') return null;
    if (Array.isArray(value)) {
        return value.map((v) => String(v)).filter(Boolean);
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((v) => String(v)).filter(Boolean);
            }
        } catch {
            return null;
        }
    }
    return null;
}

export function parseStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((v) => String(v)).filter(Boolean);
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((v) => String(v)).filter(Boolean);
            }
        } catch {
            const csv = value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            if (csv.length > 0) return csv;
        }
    }
    return [];
}

export function sortByUpdatedAtDesc(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return [...items].sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
}

export function toggleSelectedId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((itemId) => itemId !== id) : [...list, id];
}

export interface ResumeDataSetPersistInput {
    templateId: string;
    accentColor: string;
    profileId: string;
    selectedSkillSetIds: string[];
    selectedWorkExperienceIds: string[];
    selectedEducationIds: string[];
    selectedProjectIds: string[];
    selectedCertificationIds: string[];
}

export function buildResumeDataSetPersistData(input: ResumeDataSetPersistInput): Record<string, string> {
    return {
        templateId: input.templateId,
        accentColor: input.accentColor,
        profileId: input.profileId,
        selectedSkillSetIds: JSON.stringify(input.selectedSkillSetIds),
        selectedWorkExperienceIds: JSON.stringify(input.selectedWorkExperienceIds),
        selectedEducationIds: JSON.stringify(input.selectedEducationIds),
        selectedProjectIds: JSON.stringify(input.selectedProjectIds),
        selectedCertificationIds: JSON.stringify(input.selectedCertificationIds),
    };
}

export function buildDefaultResumeFileName(
    fullName: string | null | undefined,
    templateName: string | null | undefined,
    now: Date = new Date(),
): string {
    const rawName = (fullName || '').trim();
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    const firstName = (nameParts[0] || 'First').replace(/[^a-zA-Z0-9]/g, '') || 'First';
    const lastName = (nameParts[nameParts.length - 1] || 'Last').replace(/[^a-zA-Z0-9]/g, '') || 'Last';
    const safeTemplateName = (templateName || 'Theme').replace(/[^a-zA-Z0-9]/g, '') || 'Theme';

    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    return `${firstName}_${lastName}_Resume_${safeTemplateName}_${yyyy}${mm}${dd}`;
}
