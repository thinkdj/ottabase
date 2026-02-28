import { useState, useCallback, useEffect, useRef } from 'react';
import ResumePreview from './ResumePreview';
import {
    RESUME_TEMPLATES,
    DEFAULT_SECTION_ORDER,
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
    FONT_SIZE_DEFAULT,
    moveSectionUp,
    moveSectionDown,
    type ResumeTemplateData,
    type SectionKey,
    type SavedResumeSnapshot,
} from './types';
import { GUEST_DATA } from './guestData';

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
    key: SectionKey;
    label: string;
    count: number;
}

function buildContentSections(data: ResumeTemplateData, order: SectionKey[]): ContentSection[] {
    const sectionMap: Record<SectionKey, ContentSection> = {
        summary: { key: 'summary', label: 'Profile', count: data.profile ? 1 : 0 },
        workExperiences: { key: 'workExperiences', label: 'Work Experience', count: data.workExperiences.length },
        educations: { key: 'educations', label: 'Education', count: data.educations.length },
        skillSets: { key: 'skillSets', label: 'Skills', count: data.skillSets.length },
        projects: { key: 'projects', label: 'Projects', count: data.projects.length },
        certifications: { key: 'certifications', label: 'Certifications', count: data.certifications.length },
    };
    return order.map((key) => sectionMap[key]);
}

// ========================== Sub-components ==================================

/** Collapsible section header used in the left sidebar — supports drag-and-drop reorder */
function SectionHeader({
    label,
    count,
    isOpen,
    isFirst,
    isLast,
    isLocked,
    sectionKey,
    onToggle,
    onMoveUp,
    onMoveDown,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop,
    isDragTarget,
}: {
    label: string;
    count: number;
    isOpen: boolean;
    isFirst: boolean;
    isLast: boolean;
    isLocked: boolean;
    sectionKey: SectionKey;
    onToggle: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (e: React.DragEvent) => void;
    isDragTarget: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-0.5 rounded-md transition-colors ${isDragTarget ? 'bg-blue-50 ring-2 ring-blue-300 dark:bg-blue-900/20 dark:ring-blue-600' : ''}`}
            draggable={!isLocked}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            data-section={sectionKey}
        >
            {/* Drag handle + Reorder buttons */}
            <div className="flex shrink-0 items-center gap-0.5">
                {isLocked ? (
                    <span
                        className="flex h-8 w-5 items-center justify-center text-gray-300 dark:text-gray-600"
                        title="Profile is locked to first position"
                    >
                        <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                        </svg>
                    </span>
                ) : (
                    <>
                        {/* Drag handle */}
                        <span
                            className="flex h-8 w-4 cursor-grab items-center justify-center text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-400"
                            title="Drag to reorder"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                                <circle cx="5" cy="3" r="1.2" />
                                <circle cx="11" cy="3" r="1.2" />
                                <circle cx="5" cy="8" r="1.2" />
                                <circle cx="11" cy="8" r="1.2" />
                                <circle cx="5" cy="13" r="1.2" />
                                <circle cx="11" cy="13" r="1.2" />
                            </svg>
                        </span>
                        <div className="flex shrink-0 flex-col">
                            <button
                                type="button"
                                onClick={onMoveUp}
                                disabled={isFirst}
                                title="Move section up"
                                className="flex h-4 w-5 items-center justify-center rounded text-gray-400 hover:text-gray-700 disabled:opacity-25 dark:text-gray-500 dark:hover:text-gray-200"
                            >
                                <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={onMoveDown}
                                disabled={isLast}
                                title="Move section down"
                                className="flex h-4 w-5 items-center justify-center rounded text-gray-400 hover:text-gray-700 disabled:opacity-25 dark:text-gray-500 dark:hover:text-gray-200"
                            >
                                <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </>
                )}
            </div>
            <button
                type="button"
                onClick={onToggle}
                className="flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
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
        </div>
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
function LeftSidebar({
    data,
    sectionOrder,
    onReorder,
}: {
    data: ResumeTemplateData;
    sectionOrder: SectionKey[];
    onReorder: (newOrder: SectionKey[]) => void;
}) {
    const sections = buildContentSections(data, sectionOrder);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(sections.map((s) => [s.key, true])),
    );
    const [draggedKey, setDraggedKey] = useState<SectionKey | null>(null);
    const [dragOverKey, setDragOverKey] = useState<SectionKey | null>(null);

    const toggle = useCallback((key: string) => {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleDragStart = useCallback(
        (key: SectionKey) => (e: React.DragEvent) => {
            if (key === 'summary') {
                e.preventDefault();
                return;
            }
            setDraggedKey(key);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', key);
        },
        [],
    );

    const handleDragOver = useCallback(
        (key: SectionKey) => (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (key !== 'summary') setDragOverKey(key);
        },
        [],
    );

    const handleDrop = useCallback(
        (targetKey: SectionKey) => (e: React.DragEvent) => {
            e.preventDefault();
            const sourceKey = draggedKey;
            setDraggedKey(null);
            setDragOverKey(null);
            if (!sourceKey || sourceKey === targetKey || targetKey === 'summary') return;
            const newOrder = [...sectionOrder];
            const srcIdx = newOrder.indexOf(sourceKey);
            const tgtIdx = newOrder.indexOf(targetKey);
            if (srcIdx < 0 || tgtIdx < 0 || tgtIdx === 0) return;
            newOrder.splice(srcIdx, 1);
            newOrder.splice(tgtIdx, 0, sourceKey);
            onReorder(newOrder);
        },
        [draggedKey, sectionOrder, onReorder],
    );

    const handleDragEnd = useCallback(() => {
        setDraggedKey(null);
        setDragOverKey(null);
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
                {sections.map((section, idx) => {
                    const isLocked = section.key === 'summary';
                    // For up/down buttons: first non-locked section can't move up
                    const cannotMoveUp = idx <= 1;
                    return (
                        <div
                            key={section.key}
                            className={`transition-opacity ${draggedKey === section.key ? 'opacity-40' : ''}`}
                        >
                            <SectionHeader
                                label={section.label}
                                count={section.count}
                                isOpen={!!openSections[section.key]}
                                isFirst={cannotMoveUp}
                                isLast={idx === sections.length - 1}
                                isLocked={isLocked}
                                sectionKey={section.key}
                                onToggle={() => toggle(section.key)}
                                onMoveUp={() => onReorder(moveSectionUp(sectionOrder, section.key))}
                                onMoveDown={() => onReorder(moveSectionDown(sectionOrder, section.key))}
                                onDragStart={handleDragStart(section.key)}
                                onDragOver={handleDragOver(section.key)}
                                onDragEnd={handleDragEnd}
                                onDrop={handleDrop(section.key)}
                                isDragTarget={dragOverKey === section.key && draggedKey !== section.key}
                            />
                            {openSections[section.key] && (
                                <div className="ml-6 mt-1 space-y-1">
                                    {/* Render item cards based on section type */}
                                    {section.key === 'summary' && data.profile && (
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
                                            <ItemCard
                                                key={s.id}
                                                title={s.name}
                                                subtitle={`${s.skills.length} skills`}
                                            />
                                        ))}
                                    {section.key === 'projects' &&
                                        data.projects.map((p) => (
                                            <ItemCard
                                                key={p.id}
                                                title={p.title}
                                                subtitle={p.description ?? undefined}
                                            />
                                        ))}
                                    {section.key === 'certifications' &&
                                        data.certifications.map((c) => (
                                            <ItemCard key={c.id} title={c.name} subtitle={c.issuer} />
                                        ))}
                                </div>
                            )}
                        </div>
                    );
                })}
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
    fontSize,
    setFontSize,
}: {
    templateId: string;
    setTemplateId: (id: string) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
    fontSize: number;
    setFontSize: (size: number) => void;
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

            {/* Font size (zoom) slider */}
            <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Page Scale
                </h3>
                <input
                    type="range"
                    min={FONT_SIZE_MIN}
                    max={FONT_SIZE_MAX}
                    step={5}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{FONT_SIZE_MIN}%</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">{fontSize}%</span>
                    <span>{FONT_SIZE_MAX}%</span>
                </div>
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

// ---------------------------------------------------------------------------
// Responsive breakpoint hook (< 1024px = compact mode)
// ---------------------------------------------------------------------------
function useIsCompact() {
    const [isCompact, setIsCompact] = useState(false);
    useEffect(() => {
        const mql = window.matchMedia('(max-width: 1023px)');
        setIsCompact(mql.matches);
        const handler = (e: MediaQueryListEvent) => setIsCompact(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);
    return isCompact;
}

// ---------------------------------------------------------------------------
// Save/Load helpers (localStorage)
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'resumeme_snapshots';

function loadSnapshots(): SavedResumeSnapshot[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (err) {
        console.warn('[ResumeMe] Failed to load snapshots from localStorage:', err);
        return [];
    }
}

function saveSnapshot(snap: SavedResumeSnapshot) {
    const list = loadSnapshots().filter((s) => s.id !== snap.id);
    list.unshift(snap);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function deleteSnapshot(id: string) {
    const list = loadSnapshots().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ========================== Main Component ==================================

export default function ResumeBuilder({ guestMode = false }: { guestMode?: boolean }) {
    const [templateId, setTemplateId] = useState('classic');
    const [accentColor, setAccentColor] = useState('#475569');
    const [fontSize, setFontSize] = useState(FONT_SIZE_DEFAULT);
    const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(DEFAULT_SECTION_ORDER);
    const [headingLabels, setHeadingLabels] = useState<Partial<Record<SectionKey, string>>>({});

    // Saved snapshot management
    const [loadedSnapshotId, setLoadedSnapshotId] = useState<string | null>(null);
    const [showSaveNotice, setShowSaveNotice] = useState(false);

    const isCompact = useIsCompact();

    // Sidebars: open by default on desktop, closed on compact (< 1024px)
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
    );
    const [rightSidebarOpen, setRightSidebarOpen] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
    );

    // Sync sidebar open state when breakpoint changes
    const prevCompactRef = useRef(isCompact);
    useEffect(() => {
        if (prevCompactRef.current !== isCompact) {
            prevCompactRef.current = isCompact;
            setLeftSidebarOpen(!isCompact);
            setRightSidebarOpen(!isCompact);
        }
    }, [isCompact]);

    const data = guestMode ? GUEST_DATA : SAMPLE_DATA;

    const handlePrint = useCallback(() => {
        if (guestMode) return;
        window.print();
    }, [guestMode]);

    const handleHeadingChange = useCallback((key: SectionKey, label: string) => {
        setHeadingLabels((prev) => ({ ...prev, [key]: label }));
    }, []);

    // ---- Save snapshot ----
    const handleSave = useCallback(() => {
        if (guestMode) return;
        const snap: SavedResumeSnapshot = {
            id: loadedSnapshotId || crypto.randomUUID(),
            name: `Resume — ${new Date().toLocaleDateString()}`,
            savedAt: new Date().toISOString(),
            templateId,
            accentColor,
            fontSize,
            sectionOrder,
            headingLabels,
            data,
        };
        saveSnapshot(snap);
        setLoadedSnapshotId(snap.id);
        setShowSaveNotice(true);
        setTimeout(() => setShowSaveNotice(false), 5000);
    }, [guestMode, loadedSnapshotId, templateId, accentColor, fontSize, sectionOrder, headingLabels, data]);

    // ---- Refresh data (replace snapshot data with live data) ----
    const handleRefreshData = useCallback(() => {
        if (!loadedSnapshotId) return;
        // Keep style settings, replace data with current source
        const snaps = loadSnapshots();
        const snap = snaps.find((s) => s.id === loadedSnapshotId);
        if (snap) {
            snap.data = data;
            snap.savedAt = new Date().toISOString();
            saveSnapshot(snap);
        }
    }, [loadedSnapshotId, data]);

    return (
        <div className="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
            {/* ---- Guest Mode Banner ---- */}
            {guestMode && (
                <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 print:hidden">
                    <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                        />
                    </svg>
                    <span>
                        <strong>Guest Mode</strong> — Explore all features freely. Name is locked to &quot;John
                        Doe&quot;, printing is disabled, and changes are not saved.{' '}
                        <a
                            href="/auth/signup"
                            className="font-medium underline hover:text-amber-900 dark:hover:text-amber-100"
                        >
                            Create an account
                        </a>{' '}
                        to unlock everything.
                    </span>
                </div>
            )}

            {/* ---- Save Notice Toast ---- */}
            {showSaveNotice && (
                <div className="flex shrink-0 items-center justify-center gap-2 bg-green-50 px-4 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200 print:hidden">
                    <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>
                        <strong>Snapshot saved!</strong> This is a frozen copy — changes to your profile, skills, or
                        experience sections won&apos;t update this snapshot automatically. Use &quot;Refresh Data&quot;
                        to pull in the latest.
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowSaveNotice(false)}
                        className="ml-2 font-medium underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* ---- Toolbar ---- */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800 print:hidden">
                <div className="flex items-center gap-3">
                    {/* Desktop sidebar toggle */}
                    {!isCompact && (
                        <SidebarToggle
                            side="left"
                            isOpen={leftSidebarOpen}
                            onClick={() => setLeftSidebarOpen((o) => !o)}
                        />
                    )}
                    <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Resume Builder
                        {guestMode ? (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                Guest Mode
                            </span>
                        ) : loadedSnapshotId ? (
                            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-normal text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                Saved Snapshot
                            </span>
                        ) : (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                                Default Data Set
                            </span>
                        )}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    {/* Refresh Data button (when viewing a saved snapshot) */}
                    {loadedSnapshotId && !guestMode && (
                        <button
                            type="button"
                            onClick={handleRefreshData}
                            className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900/30"
                            title="Replace snapshot data with latest from your profile"
                        >
                            <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            Refresh Data
                        </button>
                    )}
                    {/* Save button */}
                    {!guestMode && (
                        <button
                            type="button"
                            onClick={handleSave}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                            title="Save a snapshot of this resume"
                        >
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                                />
                            </svg>
                            Save
                        </button>
                    )}
                    {/* Print button */}
                    {guestMode ? (
                        <span
                            title="Sign up to unlock printing and PDF export"
                            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 dark:bg-gray-600 dark:text-gray-400"
                        >
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                            Print
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                        >
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                />
                            </svg>
                            Print
                        </button>
                    )}
                    {/* Desktop sidebar toggle */}
                    {!isCompact && (
                        <SidebarToggle
                            side="right"
                            isOpen={rightSidebarOpen}
                            onClick={() => setRightSidebarOpen((o) => !o)}
                        />
                    )}
                </div>
            </header>

            {/* ---- Three-panel layout ---- */}
            <div className="relative flex min-h-0 flex-1">
                {/* ── Floating toggle buttons (compact mode only) ── */}
                {isCompact && (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setLeftSidebarOpen((o) => !o);
                                setRightSidebarOpen(false);
                            }}
                            className="fixed left-2 top-[50%] z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:ring-gray-700 dark:hover:bg-gray-700 print:hidden"
                            title="Toggle content panel"
                        >
                            <svg
                                className="h-5 w-5 text-gray-600 dark:text-gray-300"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setRightSidebarOpen((o) => !o);
                                setLeftSidebarOpen(false);
                            }}
                            className="fixed right-2 top-[50%] z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:ring-gray-700 dark:hover:bg-gray-700 print:hidden"
                            title="Toggle style panel"
                        >
                            <svg
                                className="h-5 w-5 text-gray-600 dark:text-gray-300"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                                />
                            </svg>
                        </button>
                    </>
                )}

                {/* Left sidebar — Content sections */}
                {leftSidebarOpen &&
                    (isCompact ? (
                        /* Floating flyout panel for compact mode */
                        <>
                            <div
                                className="fixed inset-0 z-30 bg-black/20 print:hidden"
                                onClick={() => setLeftSidebarOpen(false)}
                            />
                            <aside className="fixed left-0 top-0 z-30 mt-[var(--toolbar-h,56px)] h-[calc(100vh-var(--toolbar-h,56px))] w-[300px] border-r border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 print:hidden">
                                <LeftSidebar data={data} sectionOrder={sectionOrder} onReorder={setSectionOrder} />
                            </aside>
                        </>
                    ) : (
                        <aside className="w-[280px] shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 print:hidden">
                            <LeftSidebar data={data} sectionOrder={sectionOrder} onReorder={setSectionOrder} />
                        </aside>
                    ))}

                {/* Center — Resume canvas */}
                <main className="flex flex-1 flex-col items-center overflow-y-auto p-4 lg:p-8">
                    <div className="w-full max-w-[816px] rounded-lg bg-white shadow-lg ring-1 ring-gray-200 dark:ring-gray-700">
                        <ResumePreview
                            data={data}
                            templateId={templateId}
                            accentColor={accentColor}
                            fontSize={fontSize}
                            sectionOrder={sectionOrder}
                            headingLabels={headingLabels}
                            onHeadingChange={handleHeadingChange}
                        />
                    </div>
                </main>

                {/* Right sidebar — Style controls */}
                {rightSidebarOpen &&
                    (isCompact ? (
                        /* Floating flyout panel for compact mode */
                        <>
                            <div
                                className="fixed inset-0 z-30 bg-black/20 print:hidden"
                                onClick={() => setRightSidebarOpen(false)}
                            />
                            <aside className="fixed right-0 top-0 z-30 mt-[var(--toolbar-h,56px)] h-[calc(100vh-var(--toolbar-h,56px))] w-[300px] border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 print:hidden">
                                <RightSidebar
                                    templateId={templateId}
                                    setTemplateId={setTemplateId}
                                    accentColor={accentColor}
                                    setAccentColor={setAccentColor}
                                    fontSize={fontSize}
                                    setFontSize={setFontSize}
                                />
                            </aside>
                        </>
                    ) : (
                        <aside className="w-[280px] shrink-0 border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 print:hidden">
                            <RightSidebar
                                templateId={templateId}
                                setTemplateId={setTemplateId}
                                accentColor={accentColor}
                                setAccentColor={setAccentColor}
                                fontSize={fontSize}
                                setFontSize={setFontSize}
                            />
                        </aside>
                    ))}
            </div>
        </div>
    );
}
