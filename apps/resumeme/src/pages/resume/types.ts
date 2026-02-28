// Resume template types — shared across all templates

/** Resolved data that templates receive (all selected items pre-fetched) */
export interface ResumeTemplateData {
    /** Full name from user's app profile */
    fullName: string;
    profile: {
        headline?: string | null;
        summary?: string | null;
        avatarUrl?: string | null;
        phone?: string | null;
        email?: string | null;
        website?: string | null;
        linkedinUrl?: string | null;
        githubUrl?: string | null;
        location?: string | null;
    } | null;
    skillSets: Array<{
        id: string;
        name: string;
        skills: string[];
    }>;
    workExperiences: Array<{
        id: string;
        company: string;
        designation: string;
        location?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        isCurrent: boolean;
        description?: string | null;
        highlights: string[];
    }>;
    educations: Array<{
        id: string;
        institution: string;
        degree: string;
        field?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        grade?: string | null;
        description?: string | null;
    }>;
    projects: Array<{
        id: string;
        title: string;
        description?: string | null;
        url?: string | null;
        techStack: string[];
        startDate?: string | null;
        endDate?: string | null;
    }>;
    certifications: Array<{
        id: string;
        name: string;
        issuer: string;
        issueDate?: string | null;
        expiryDate?: string | null;
        credentialUrl?: string | null;
    }>;
}

export interface ResumeTemplateProps {
    data: ResumeTemplateData;
    accentColor: string;
}

/** Template metadata for template picker */
export interface ResumeTemplateMeta {
    id: string;
    name: string;
    description: string;
}

/** Registry of available templates */
export const RESUME_TEMPLATES: ResumeTemplateMeta[] = [
    {
        id: 'classic',
        name: 'Classic',
        description: 'Traditional single-column layout with clear sections',
    },
    {
        id: 'modern',
        name: 'Modern',
        description: 'Two-column layout with sidebar for skills and contact',
    },
];

/** Format "YYYY-MM" to readable date like "Jan 2024" */
export function formatResumeDate(date: string | null | undefined): string {
    if (!date) return '';
    const [year, month] = date.split('-');
    if (!year) return '';
    if (!month) return year;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(month, 10) - 1;
    return `${months[idx] || month} ${year}`;
}

/** Format date range like "Jan 2022 — Present" */
export function formatDateRange(
    startDate: string | null | undefined,
    endDate: string | null | undefined,
    isCurrent?: boolean,
): string {
    const start = formatResumeDate(startDate);
    const end = isCurrent ? 'Present' : formatResumeDate(endDate);
    if (!start && !end) return '';
    if (!start) return end;
    if (!end) return start;
    return `${start} — ${end}`;
}
