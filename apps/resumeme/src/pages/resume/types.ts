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
    /** Zoom scale percentage (default 100). Applied as CSS zoom for proportional scaling. */
    fontSize: number;
    /** Ordered section keys — templates render sections in this order */
    sectionOrder: SectionKey[];
    /** Optional heading label overrides — keys match SectionKey, values are custom labels */
    headingLabels?: Partial<Record<SectionKey, string>>;
    /** Callback fired when user edits a heading inline in the preview */
    onHeadingChange?: (key: SectionKey, label: string) => void;
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
    {
        id: 'lisbon',
        name: 'Lisbon',
        description: 'Light sidebar with skill dots, airy professional layout',
    },
    {
        id: 'executive',
        name: 'Executive',
        description: 'Premium corporate design with elegant typography',
    },
    {
        id: 'minimal',
        name: 'Minimal',
        description: 'Ultra-clean, typography-focused with maximum whitespace',
    },
    {
        id: 'clean',
        name: 'Clean',
        description: 'Structured two-column body with full-width header and thin divider',
    },
    {
        id: 'creative',
        name: 'Creative',
        description: 'Editorial portfolio style with avatar hero and timeline experience',
    },
    {
        id: 'bold',
        name: 'Bold',
        description: 'Structured two-column with avatar blob and accent-bar job titles',
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

// ---------------------------------------------------------------------------
// Section reordering
// ---------------------------------------------------------------------------

/** All reorderable section keys */
export type SectionKey = 'summary' | 'workExperiences' | 'educations' | 'skillSets' | 'projects' | 'certifications';

/** Default section order for new resumes */
export const DEFAULT_SECTION_ORDER: SectionKey[] = [
    'summary',
    'workExperiences',
    'educations',
    'skillSets',
    'projects',
    'certifications',
];

/** Move a section one position earlier in the order. Returns new array.
 *  'summary' is pinned at index 0 and cannot be displaced. */
export function moveSectionUp(order: SectionKey[], key: SectionKey): SectionKey[] {
    if (key === 'summary') return order; // summary stays at 0
    const idx = order.indexOf(key);
    if (idx <= 0) return order;
    if (idx === 1 && order[0] === 'summary') return order; // can't swap above pinned summary
    const next = [...order];
    next[idx] = next[idx - 1]!;
    next[idx - 1] = key;
    return next;
}

/** Move a section one position later in the order. Returns new array.
 *  'summary' is pinned at index 0 and cannot move down. */
export function moveSectionDown(order: SectionKey[], key: SectionKey): SectionKey[] {
    if (key === 'summary') return order; // summary stays at 0
    const idx = order.indexOf(key);
    if (idx < 0 || idx >= order.length - 1) return order;
    const next = [...order];
    next[idx] = next[idx + 1]!;
    next[idx + 1] = key;
    return next;
}

// ---------------------------------------------------------------------------
// Font size (zoom percentage — proportional scaling)
// ---------------------------------------------------------------------------

/** Font scale limits for the resume (percentage; 100 = normal size) */
export const FONT_SIZE_MIN = 80;
export const FONT_SIZE_MAX = 130;
export const FONT_SIZE_DEFAULT = 100;

// ---------------------------------------------------------------------------
// Heading labels
// ---------------------------------------------------------------------------

/** Default heading labels per section — templates may use different labels */
export const DEFAULT_HEADING_LABELS: Record<SectionKey, string> = {
    summary: 'Summary',
    workExperiences: 'Experience',
    educations: 'Education',
    skillSets: 'Skills',
    projects: 'Projects',
    certifications: 'Certifications',
};

/** Resolve the effective heading label for a section */
export function resolveHeadingLabel(
    key: SectionKey,
    overrides?: Partial<Record<SectionKey, string>>,
    templateDefault?: string,
): string {
    return overrides?.[key] || templateDefault || DEFAULT_HEADING_LABELS[key] || '';
}

// ---------------------------------------------------------------------------
// Saved resume snapshot
// ---------------------------------------------------------------------------

/** Full serialisable resume state for save/load */
export interface SavedResumeSnapshot {
    id: string;
    name: string;
    savedAt: string;
    templateId: string;
    accentColor: string;
    fontSize: number;
    sectionOrder: SectionKey[];
    headingLabels: Partial<Record<SectionKey, string>>;
    data: ResumeTemplateData;
}
