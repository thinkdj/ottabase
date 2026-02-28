import { useState, useCallback } from 'react';
import ResumePreview from './ResumePreview';
import { RESUME_TEMPLATES, type ResumeTemplateData } from './types';

// ---------------------------------------------------------------------------
// Sample data — realistic placeholder content for the builder shell.
// Will be replaced by API-fetched data sets once the backend is wired.
// ---------------------------------------------------------------------------
const SAMPLE_DATA: ResumeTemplateData = {
    fullName: 'Alex Johnson',
    profile: {
        headline: 'Senior Software Engineer',
        summary:
            'Experienced full-stack engineer with 8+ years building scalable web applications. ' +
            'Passionate about clean architecture, developer tooling, and mentoring teams. ' +
            'Track record of delivering high-impact features in fast-paced startup and enterprise environments.',
        email: 'alex@example.com',
        phone: '+1 555-123-4567',
        location: 'San Francisco, CA',
        website: 'https://alexjohnson.dev',
        linkedinUrl: 'https://linkedin.com/in/alexjohnson',
        githubUrl: 'https://github.com/alexjohnson',
    },
    skillSets: [
        { id: '1', name: 'Frontend', skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Vue.js'] },
        { id: '2', name: 'Backend', skills: ['Node.js', 'Python', 'PostgreSQL', 'Redis', 'GraphQL'] },
        { id: '3', name: 'DevOps', skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform'] },
    ],
    workExperiences: [
        {
            id: '1',
            company: 'TechCorp',
            designation: 'Senior Software Engineer',
            location: 'San Francisco, CA',
            startDate: '2021-03',
            endDate: null,
            isCurrent: true,
            description: null,
            highlights: [
                'Led migration of monolithic application to microservices, reducing deployment time by 70%',
                'Mentored team of 4 junior engineers through code reviews and pair programming',
                'Designed and implemented real-time notification system serving 50K+ concurrent users',
            ],
        },
        {
            id: '2',
            company: 'StartupXYZ',
            designation: 'Full Stack Developer',
            location: 'Remote',
            startDate: '2018-06',
            endDate: '2021-02',
            isCurrent: false,
            description: null,
            highlights: [
                'Built customer-facing dashboard from scratch using React and Node.js',
                'Optimised database queries reducing average response time from 800ms to 120ms',
                'Implemented automated testing pipeline achieving 90% code coverage',
            ],
        },
    ],
    educations: [
        {
            id: '1',
            institution: 'University of California, Berkeley',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            startDate: '2014-08',
            endDate: '2018-05',
            grade: '3.8 GPA',
            description: null,
        },
    ],
    projects: [
        {
            id: '1',
            title: 'DevMetrics',
            description: 'Open-source developer productivity analytics tool',
            url: 'https://github.com/alexjohnson/devmetrics',
            techStack: ['React', 'TypeScript', 'D3.js', 'PostgreSQL'],
            startDate: '2023-01',
            endDate: null,
        },
    ],
    certifications: [
        {
            id: '1',
            name: 'AWS Solutions Architect — Associate',
            issuer: 'Amazon Web Services',
            issueDate: '2023-06',
            expiryDate: '2026-06',
            credentialUrl: 'https://aws.amazon.com/verification',
        },
    ],
};

// Accent colour presets shown in the style sidebar
const ACCENT_PRESETS = [
    '#475569', // slate (default)
    '#0f766e', // teal
    '#1d4ed8', // blue
    '#7c3aed', // violet
    '#be123c', // rose
    '#b45309', // amber
    '#15803d', // green
    '#64748b', // gray
];

// ---------------------------------------------------------------------------
// Content section labels — maps data keys to human-readable headings
// ---------------------------------------------------------------------------
interface ContentSection {
    key: string;
    label: string;
    count: number;
}

function buildContentSections(data: ResumeTemplateData): ContentSection[] {
    return [
        { key: 'profile', label: 'Profile', count: data.profile ? 1 : 0 },
        { key: 'workExperiences', label: 'Work Experience', count: data.workExperiences.length },
        { key: 'educations', label: 'Education', count: data.educations.length },
        { key: 'skillSets', label: 'Skills', count: data.skillSets.length },
        { key: 'projects', label: 'Projects', count: data.projects.length },
        { key: 'certifications', label: 'Certifications', count: data.certifications.length },
    ];
}

// ========================== Sub-components ==================================

/** Collapsible section header used in the left sidebar */
function SectionHeader({
    label,
    count,
    isOpen,
    onToggle,
}: {
    label: string;
    count: number;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
        >
            <span className="flex items-center gap-2">
                {/* Chevron */}
                <svg
                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {label}
            </span>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                {count}
            </span>
        </button>
    );
}

/** Placeholder card for individual content items (work exp, education, etc.) */
function ItemCard({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
            {/* Include/exclude checkbox */}
            <input type="checkbox" defaultChecked className="mt-1 accent-blue-600" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{title}</p>
                {subtitle && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
            </div>
            <button
                type="button"
                className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
                onClick={() => {
                    /* placeholder — will open edit modal */
                }}
            >
                Edit
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Left Sidebar — Content sections
// ---------------------------------------------------------------------------
function LeftSidebar({ data }: { data: ResumeTemplateData }) {
    const sections = buildContentSections(data);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(sections.map((s) => [s.key, true])),
    );

    const toggle = useCallback((key: string) => {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            {/* Data set selector — placeholder for multi-dataset support */}
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Data Set
                </label>
                <select className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                    <option>Default</option>
                </select>
            </div>

            {/* Content sections */}
            <div className="flex-1 space-y-1 p-2">
                {sections.map((section) => (
                    <div key={section.key}>
                        <SectionHeader
                            label={section.label}
                            count={section.count}
                            isOpen={!!openSections[section.key]}
                            onToggle={() => toggle(section.key)}
                        />
                        {openSections[section.key] && (
                            <div className="ml-6 mt-1 space-y-1">
                                {/* Render item cards based on section type */}
                                {section.key === 'profile' && data.profile && (
                                    <ItemCard title={data.fullName} subtitle={data.profile.headline ?? undefined} />
                                )}
                                {section.key === 'workExperiences' &&
                                    data.workExperiences.map((w) => (
                                        <ItemCard key={w.id} title={w.designation} subtitle={w.company} />
                                    ))}
                                {section.key === 'educations' &&
                                    data.educations.map((e) => (
                                        <ItemCard key={e.id} title={e.degree} subtitle={e.institution} />
                                    ))}
                                {section.key === 'skillSets' &&
                                    data.skillSets.map((s) => (
                                        <ItemCard key={s.id} title={s.name} subtitle={`${s.skills.length} skills`} />
                                    ))}
                                {section.key === 'projects' &&
                                    data.projects.map((p) => (
                                        <ItemCard key={p.id} title={p.title} subtitle={p.description ?? undefined} />
                                    ))}
                                {section.key === 'certifications' &&
                                    data.certifications.map((c) => (
                                        <ItemCard key={c.id} title={c.name} subtitle={c.issuer} />
                                    ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Right Sidebar — Style controls
// ---------------------------------------------------------------------------
function RightSidebar({
    templateId,
    setTemplateId,
    accentColor,
    setAccentColor,
}: {
    templateId: string;
    setTemplateId: (id: string) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
}) {
    return (
        <div className="flex h-full flex-col overflow-y-auto p-3">
            {/* Template picker */}
            <div className="mb-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Template
                </h3>
                <div className="space-y-2">
                    {RESUME_TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTemplateId(t.id)}
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                templateId === t.id
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500'
                            }`}
                        >
                            <span className="font-medium">{t.name}</span>
                            <span className="mt-0.5 block text-xs opacity-70">{t.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Accent colour picker */}
            <div className="mb-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Accent Colour
                </h3>
                <div className="flex flex-wrap gap-2">
                    {ACCENT_PRESETS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setAccentColor(color)}
                            title={color}
                            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                                accentColor === color
                                    ? 'border-gray-800 ring-2 ring-blue-400 dark:border-white'
                                    : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
                {/* Custom hex input */}
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Custom:</span>
                    <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        maxLength={7}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    />
                    <span className="h-5 w-5 rounded" style={{ backgroundColor: accentColor }} />
                </div>
            </div>

            {/* Font size slider — future feature, shown disabled */}
            <div className="opacity-50">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Font Size
                </h3>
                <input type="range" min={10} max={16} defaultValue={12} disabled className="w-full" />
                <p className="mt-1 text-xs italic text-gray-400">Coming soon</p>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sidebar toggle button (used for both sidebars)
// ---------------------------------------------------------------------------
function SidebarToggle({ side, isOpen, onClick }: { side: 'left' | 'right'; isOpen: boolean; onClick: () => void }) {
    // Arrow points inward when open, outward when closed
    const arrow = side === 'left' ? (isOpen ? '◀' : '▶') : isOpen ? '▶' : '◀';
    return (
        <button
            type="button"
            onClick={onClick}
            title={isOpen ? `Hide ${side} sidebar` : `Show ${side} sidebar`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
        >
            {arrow}
        </button>
    );
}

// ========================== Main Component ==================================

export default function ResumeBuilder() {
    const [templateId, setTemplateId] = useState('classic');
    const [accentColor, setAccentColor] = useState('#475569');
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

    const data = SAMPLE_DATA;

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    return (
        <div className="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
            {/* ---- Toolbar ---- */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800 print:hidden">
                <div className="flex items-center gap-3">
                    <SidebarToggle side="left" isOpen={leftSidebarOpen} onClick={() => setLeftSidebarOpen((o) => !o)} />
                    <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Resume Builder
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            Default Data Set
                        </span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                        {/* Printer icon */}
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                            />
                        </svg>
                        Print / Export PDF
                    </button>
                    <SidebarToggle
                        side="right"
                        isOpen={rightSidebarOpen}
                        onClick={() => setRightSidebarOpen((o) => !o)}
                    />
                </div>
            </header>

            {/* ---- Three-panel layout ---- */}
            <div className="flex min-h-0 flex-1">
                {/* Left sidebar — Content sections */}
                {leftSidebarOpen && (
                    <aside className="hidden w-[280px] shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block print:hidden">
                        <LeftSidebar data={data} />
                    </aside>
                )}

                {/* Center — Resume canvas */}
                <main className="flex flex-1 flex-col items-center overflow-y-auto p-4 md:p-8">
                    {/* Paper container — A4-ish proportions */}
                    <div className="w-full max-w-[816px] rounded-lg bg-white shadow-lg ring-1 ring-gray-200 dark:ring-gray-700">
                        <ResumePreview data={data} templateId={templateId} accentColor={accentColor} />
                    </div>
                </main>

                {/* Right sidebar — Style controls */}
                {rightSidebarOpen && (
                    <aside className="hidden w-[280px] shrink-0 border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block print:hidden">
                        <RightSidebar
                            templateId={templateId}
                            setTemplateId={setTemplateId}
                            accentColor={accentColor}
                            setAccentColor={setAccentColor}
                        />
                    </aside>
                )}
            </div>
        </div>
    );
}
