import { useSession } from '@/lib/auth';
import {
    useCreateResumeDataSet,
    useCreateResumeSaved,
    useResumeCertifications,
    useResumeDataSets,
    useResumeEducations,
    useResumeProfiles,
    useResumeProjects,
    useResumeSaved,
    useResumeSkillSets,
    useResumeWorkExperiences,
    useUpdateResumeDataSet,
    useUpdateResumeSaved,
} from '@/ottabase/hooks/useResume';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
} from '@ottabase/ui-shadcn';
import { IconAdjustments, IconChevronLeft, IconChevronRight, IconLayoutSidebar } from '@tabler/icons-react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GUEST_DATA } from './guestData';
import {
    buildResumeDataSetPersistData,
    normalizeList,
    parseIdSelection,
    parseStringArray,
    sortByUpdatedAtDesc,
    toggleSelectedId,
} from './resume-builder-data-utils';
import ResumePreview from './ResumePreview';
import {
    DEFAULT_SECTION_ORDER,
    FONT_SIZE_DEFAULT,
    FONT_SIZE_MAX,
    FONT_SIZE_MIN,
    moveSectionDown,
    moveSectionUp,
    RESUME_TEMPLATES,
    type ResumeTemplateData,
    type SectionKey,
} from './types';

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

const ACCENT_PRESET_CLASSES: Record<string, string> = {
    '#475569': 'bg-slate-600',
    '#0f766e': 'bg-teal-700',
    '#1d4ed8': 'bg-blue-700',
    '#7c3aed': 'bg-violet-700',
    '#be123c': 'bg-rose-700',
    '#b45309': 'bg-amber-700',
    '#15803d': 'bg-green-700',
    '#64748b': 'bg-slate-500',
};

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
            className={`flex items-center gap-0.5 rounded-md transition-colors ${isDragTarget ? 'bg-muted ring-2 ring-primary/40' : ''}`}
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
                        className="flex h-8 w-5 items-center justify-center text-muted-foreground/50"
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
                            className="flex h-8 w-4 cursor-grab items-center justify-center text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
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
                                className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-25"
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
                                className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-25"
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
                className="flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-muted"
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
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
            </button>
        </div>
    );
}

/** Placeholder card for individual content items (work exp, education, etc.) */
function ItemCard({
    title,
    subtitle,
    checked = true,
    onToggle,
    showCheckbox = true,
    disabled = false,
}: {
    title: string;
    subtitle?: string;
    checked?: boolean;
    onToggle?: () => void;
    showCheckbox?: boolean;
    /** When true the checkbox is disabled (view-only mode) */
    disabled?: boolean;
}) {
    return (
        <div className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2">
            {/* Include/exclude checkbox */}
            {showCheckbox ? (
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle?.()}
                    title={`Toggle ${title}`}
                    className="mt-1 accent-primary disabled:opacity-50"
                    disabled={disabled}
                />
            ) : (
                <span className="mt-1 h-4 w-4" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{title}</p>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Left Sidebar — Content sections
// ---------------------------------------------------------------------------
function LeftSidebar({
    data,
    sidebarData,
    sectionOrder,
    onReorder,
    profiles,
    activeProfileId,
    onProfileChange,
    selectedSkillSetIds,
    selectedWorkExperienceIds,
    selectedEducationIds,
    selectedProjectIds,
    selectedCertificationIds,
    onToggleSkillSet,
    onToggleWorkExperience,
    onToggleEducation,
    onToggleProject,
    onToggleCertification,
    isViewOnly = false,
}: {
    data: ResumeTemplateData;
    /** Unfiltered data — all items regardless of selection. Used to render sidebar item lists. */
    sidebarData: ResumeTemplateData;
    sectionOrder: SectionKey[];
    onReorder: (newOrder: SectionKey[]) => void;
    profiles: Array<{ id: string; label: string }>;
    activeProfileId: string | null;
    onProfileChange: (id: string) => void;
    selectedSkillSetIds: string[];
    selectedWorkExperienceIds: string[];
    selectedEducationIds: string[];
    selectedProjectIds: string[];
    selectedCertificationIds: string[];
    onToggleSkillSet: (id: string) => void;
    onToggleWorkExperience: (id: string) => void;
    onToggleEducation: (id: string) => void;
    onToggleProject: (id: string) => void;
    onToggleCertification: (id: string) => void;
    /** When true, checkboxes and profile selector are disabled (view-only mode) */
    isViewOnly?: boolean;
}) {
    // Use sidebarData (unfiltered) for section counts so headers show total items
    const sections = buildContentSections(sidebarData, sectionOrder);
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
            {/* Profile selector — each profile has its own linked dataset bucket */}
            <div className="border-b border-border p-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Profile
                </label>
                <select
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-60"
                    title="Select profile"
                    value={activeProfileId ?? ''}
                    onChange={(e) => onProfileChange(e.target.value)}
                    disabled={isViewOnly}
                >
                    {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                            {profile.label}
                        </option>
                    ))}
                </select>
                {profiles.length === 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Create a profile in My Resume Data first.</p>
                )}
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
                                    {section.key === 'summary' && sidebarData.profile && (
                                        <ItemCard
                                            title={sidebarData.fullName}
                                            subtitle={sidebarData.profile.headline ?? undefined}
                                            showCheckbox={false}
                                        />
                                    )}
                                    {section.key === 'workExperiences' &&
                                        sidebarData.workExperiences.map((w) => (
                                            <ItemCard
                                                key={w.id}
                                                title={w.designation}
                                                subtitle={w.company}
                                                checked={selectedWorkExperienceIds.includes(w.id)}
                                                onToggle={() => onToggleWorkExperience(w.id)}
                                                disabled={isViewOnly}
                                            />
                                        ))}
                                    {section.key === 'educations' &&
                                        sidebarData.educations.map((e) => (
                                            <ItemCard
                                                key={e.id}
                                                title={e.degree}
                                                subtitle={e.institution}
                                                checked={selectedEducationIds.includes(e.id)}
                                                onToggle={() => onToggleEducation(e.id)}
                                                disabled={isViewOnly}
                                            />
                                        ))}
                                    {section.key === 'skillSets' &&
                                        sidebarData.skillSets.map((s) => (
                                            <ItemCard
                                                key={s.id}
                                                title={s.name}
                                                subtitle={`${s.skills.length} skills`}
                                                checked={selectedSkillSetIds.includes(s.id)}
                                                onToggle={() => onToggleSkillSet(s.id)}
                                                disabled={isViewOnly}
                                            />
                                        ))}
                                    {section.key === 'projects' &&
                                        sidebarData.projects.map((p) => (
                                            <ItemCard
                                                key={p.id}
                                                title={p.title}
                                                subtitle={p.description ?? undefined}
                                                checked={selectedProjectIds.includes(p.id)}
                                                onToggle={() => onToggleProject(p.id)}
                                                disabled={isViewOnly}
                                            />
                                        ))}
                                    {section.key === 'certifications' &&
                                        sidebarData.certifications.map((c) => (
                                            <ItemCard
                                                key={c.id}
                                                title={c.name}
                                                subtitle={c.issuer}
                                                checked={selectedCertificationIds.includes(c.id)}
                                                onToggle={() => onToggleCertification(c.id)}
                                                disabled={isViewOnly}
                                            />
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
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template</h3>
                <div className="space-y-2">
                    {RESUME_TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTemplateId(t.id)}
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                templateId === t.id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-card text-foreground hover:border-primary/40'
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
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Accent Colour
                </h3>
                <div className="flex flex-wrap gap-2">
                    {ACCENT_PRESETS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setAccentColor(color)}
                            title={color}
                            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${ACCENT_PRESET_CLASSES[color] ?? 'bg-muted'} ${
                                accentColor === color
                                    ? 'border-foreground ring-2 ring-primary/40'
                                    : 'border-transparent'
                            }`}
                        />
                    ))}
                </div>
                {/* Custom hex input */}
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Custom:</span>
                    <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        maxLength={7}
                        title="Accent color hex value"
                        className="w-20 rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
                    />
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {accentColor}
                    </span>
                </div>
            </div>

            {/* Font size (zoom) slider */}
            <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page Scale</h3>
                <input
                    type="range"
                    min={FONT_SIZE_MIN}
                    max={FONT_SIZE_MAX}
                    step={5}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    title="Page scale"
                    className="w-full accent-primary"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{FONT_SIZE_MIN}%</span>
                    <span className="font-medium text-foreground">{fontSize}%</span>
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
    const Icon =
        side === 'left' ? (isOpen ? IconChevronLeft : IconChevronRight) : isOpen ? IconChevronRight : IconChevronLeft;
    return (
        <button
            type="button"
            onClick={onClick}
            title={isOpen ? `Hide ${side} sidebar` : `Show ${side} sidebar`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
            <Icon className="h-4 w-4" />
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

// ========================== Main Component ==================================

export default function ResumeBuilder({ guestMode = false }: { guestMode?: boolean }) {
    const { user } = useSession({ skipAutoSync: true });
    const navigate = useNavigate();

    // Read search params: ?resumeId=xxx or ?dataSetId=xxx
    let searchParams: { resumeId?: string; dataSetId?: string } = {};
    try {
        searchParams = useSearch({ from: '/builder' }) as { resumeId?: string; dataSetId?: string };
    } catch {
        // Guest route may not have search validation
    }
    const urlResumeId = searchParams.resumeId ?? null;
    const urlDataSetId = searchParams.dataSetId ?? null;

    const [templateId, setTemplateId] = useState('classic');
    const [accentColor, setAccentColor] = useState('#475569');
    const [fontSize, setFontSize] = useState(FONT_SIZE_DEFAULT);
    const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(DEFAULT_SECTION_ORDER);
    const [headingLabels, setHeadingLabels] = useState<Partial<Record<SectionKey, string>>>({});

    // Saved resume management
    const [loadedResumeId, setLoadedResumeId] = useState<string | null>(urlResumeId);
    /** When true the builder is in view-only mode (data items cannot be toggled) */
    const [isViewOnly, setIsViewOnly] = useState(!!urlResumeId);
    const [showSaveNotice, setShowSaveNotice] = useState(false);
    /** Save dialog state */
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

    const [selectedSkillSetIds, setSelectedSkillSetIds] = useState<string[]>([]);
    const [selectedWorkExperienceIds, setSelectedWorkExperienceIds] = useState<string[]>([]);
    const [selectedEducationIds, setSelectedEducationIds] = useState<string[]>([]);
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [selectedCertificationIds, setSelectedCertificationIds] = useState<string[]>([]);

    const dataSetHydrationRef = useRef<string | null>(null);
    const profileDataSetCreateAttemptRef = useRef<Set<string>>(new Set());
    const persistSignatureRef = useRef<string>('');

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

    const { data: profilesResult, isLoading: profilesLoading } = useResumeProfiles(undefined, { enabled: !guestMode });
    const { data: skillSetsResult, isLoading: skillSetsLoading } = useResumeSkillSets(undefined, {
        enabled: !guestMode,
    });
    const { data: workExperiencesResult, isLoading: workExperiencesLoading } = useResumeWorkExperiences(undefined, {
        enabled: !guestMode,
    });
    const { data: educationsResult, isLoading: educationsLoading } = useResumeEducations(undefined, {
        enabled: !guestMode,
    });
    const { data: projectsResult, isLoading: projectsLoading } = useResumeProjects(undefined, { enabled: !guestMode });
    const { data: certificationsResult, isLoading: certificationsLoading } = useResumeCertifications(undefined, {
        enabled: !guestMode,
    });
    const { data: dataSetsResult, isLoading: dataSetsLoading } = useResumeDataSets(undefined, {
        enabled: !guestMode,
    });

    const createDataSet = useCreateResumeDataSet();
    const updateDataSet = useUpdateResumeDataSet();

    // Saved resume API hooks
    const { data: savedResumeResult, isLoading: savedResumeLoading } = useResumeSaved(urlResumeId ?? '', {
        enabled: !!urlResumeId && !guestMode,
    });
    const createSavedResume = useCreateResumeSaved();
    const updateSavedResume = useUpdateResumeSaved();

    const profiles = useMemo(() => normalizeList<Record<string, unknown>>(profilesResult), [profilesResult]);
    const skillSets = useMemo(() => normalizeList<Record<string, unknown>>(skillSetsResult), [skillSetsResult]);
    const workExperiences = useMemo(
        () => normalizeList<Record<string, unknown>>(workExperiencesResult),
        [workExperiencesResult],
    );
    const educations = useMemo(() => normalizeList<Record<string, unknown>>(educationsResult), [educationsResult]);
    const projects = useMemo(() => normalizeList<Record<string, unknown>>(projectsResult), [projectsResult]);
    const certifications = useMemo(
        () => normalizeList<Record<string, unknown>>(certificationsResult),
        [certificationsResult],
    );
    const dataSets = useMemo(
        () => sortByUpdatedAtDesc(normalizeList<Record<string, unknown>>(dataSetsResult)),
        [dataSetsResult],
    );

    const dataSetByProfileId = useMemo(() => {
        const map = new Map<string, Record<string, unknown>>();
        for (const set of dataSets) {
            const profileId = String(set.profileId ?? '').trim();
            if (!profileId || map.has(profileId)) continue;
            map.set(profileId, set);
        }
        return map;
    }, [dataSets]);

    // If we're opening from a saved resume, also pick the data set from it
    const effectiveDataSetId = useMemo(() => {
        if (urlDataSetId) return urlDataSetId;
        const sr = savedResumeResult as Record<string, unknown> | null;
        if (sr?.dataSetId) return String(sr.dataSetId);
        return null;
    }, [urlDataSetId, savedResumeResult]);

    const activeDataSet = useMemo(() => {
        // If an explicit data set ID was provided (via URL or saved resume), use that
        if (effectiveDataSetId) {
            return dataSets.find((ds) => String(ds.id ?? '') === effectiveDataSetId) ?? null;
        }
        if (!activeProfileId) return null;
        return dataSetByProfileId.get(activeProfileId) ?? null;
    }, [effectiveDataSetId, dataSetByProfileId, activeProfileId, dataSets]);

    const isLiveDataLoading =
        !guestMode &&
        (profilesLoading ||
            skillSetsLoading ||
            workExperiencesLoading ||
            educationsLoading ||
            projectsLoading ||
            certificationsLoading ||
            dataSetsLoading);

    // ── Hydrate from a saved resume (urlResumeId) ─────────────────────────
    const savedResumeHydrated = useRef(false);
    useEffect(() => {
        if (guestMode || !urlResumeId || savedResumeLoading || savedResumeHydrated.current) return;
        const sr = savedResumeResult as Record<string, unknown> | null | undefined;
        if (!sr || !sr.id) return;
        savedResumeHydrated.current = true;
        setLoadedResumeId(String(sr.id));
        setIsViewOnly(true);
        setSaveName(String(sr.name ?? ''));

        if (sr.templateId && RESUME_TEMPLATES.some((t) => t.id === String(sr.templateId))) {
            setTemplateId(String(sr.templateId));
        }
        if (sr.accentColor) setAccentColor(String(sr.accentColor));
        if (sr.fontSize) setFontSize(Number(sr.fontSize) || FONT_SIZE_DEFAULT);

        // Parse section order
        try {
            const order = typeof sr.sectionOrder === 'string' ? JSON.parse(sr.sectionOrder) : sr.sectionOrder;
            if (Array.isArray(order)) setSectionOrder(order as SectionKey[]);
        } catch {
            /* use default */
        }

        // Parse heading labels
        try {
            const labels = typeof sr.headingLabels === 'string' ? JSON.parse(sr.headingLabels) : sr.headingLabels;
            if (labels && typeof labels === 'object') setHeadingLabels(labels as Partial<Record<SectionKey, string>>);
        } catch {
            /* use default */
        }
    }, [guestMode, urlResumeId, savedResumeLoading, savedResumeResult]);

    const profileIds = useMemo(() => profiles.map((item) => String(item.id ?? '')).filter(Boolean), [profiles]);
    const skillSetIds = useMemo(() => skillSets.map((item) => String(item.id ?? '')).filter(Boolean), [skillSets]);
    const workExperienceIds = useMemo(
        () => workExperiences.map((item) => String(item.id ?? '')).filter(Boolean),
        [workExperiences],
    );
    const educationIds = useMemo(() => educations.map((item) => String(item.id ?? '')).filter(Boolean), [educations]);
    const projectIds = useMemo(() => projects.map((item) => String(item.id ?? '')).filter(Boolean), [projects]);
    const certificationIds = useMemo(
        () => certifications.map((item) => String(item.id ?? '')).filter(Boolean),
        [certifications],
    );

    useEffect(() => {
        if (guestMode) return;
        setActiveProfileId((prev) => {
            if (prev && profiles.some((profile) => String(profile.id) === prev)) return prev;
            return profiles.length > 0 ? String(profiles[0]?.id ?? '') : null;
        });
    }, [guestMode, profiles]);

    useEffect(() => {
        if (guestMode || dataSetsLoading || isLiveDataLoading || !activeProfileId) return;
        if (dataSetByProfileId.has(activeProfileId)) return;
        if (createDataSet.isPending || profileDataSetCreateAttemptRef.current.has(activeProfileId)) return;

        profileDataSetCreateAttemptRef.current.add(activeProfileId);
        const profileForName = profiles.find((item) => String(item.id) === activeProfileId);
        const profileLabel =
            String(profileForName?.headline ?? '').trim() ||
            String(profileForName?.email ?? '').trim() ||
            'Profile Resume';

        createDataSet.mutate({
            name: profileLabel,
            profileId: activeProfileId,
            templateId,
            accentColor,
            selectedSkillSetIds: JSON.stringify(skillSetIds),
            selectedWorkExperienceIds: JSON.stringify(workExperienceIds),
            selectedEducationIds: JSON.stringify(educationIds),
            selectedProjectIds: JSON.stringify(projectIds),
            selectedCertificationIds: JSON.stringify(certificationIds),
        });
    }, [
        guestMode,
        dataSetsLoading,
        isLiveDataLoading,
        activeProfileId,
        dataSetByProfileId,
        createDataSet,
        profiles,
        templateId,
        accentColor,
        skillSetIds,
        workExperienceIds,
        educationIds,
        projectIds,
        certificationIds,
    ]);

    useEffect(() => {
        if (guestMode || !activeDataSet) return;
        const dataSetId = String(activeDataSet.id ?? '');
        if (!dataSetId || dataSetHydrationRef.current === dataSetId) return;

        dataSetHydrationRef.current = dataSetId;

        const selectedSkills = parseIdSelection(activeDataSet.selectedSkillSetIds);
        const selectedWork = parseIdSelection(activeDataSet.selectedWorkExperienceIds);
        const selectedEdu = parseIdSelection(activeDataSet.selectedEducationIds);
        const selectedProj = parseIdSelection(activeDataSet.selectedProjectIds);
        const selectedCert = parseIdSelection(activeDataSet.selectedCertificationIds);

        setSelectedSkillSetIds(selectedSkills ?? skillSetIds);
        setSelectedWorkExperienceIds(selectedWork ?? workExperienceIds);
        setSelectedEducationIds(selectedEdu ?? educationIds);
        setSelectedProjectIds(selectedProj ?? projectIds);
        setSelectedCertificationIds(selectedCert ?? certificationIds);

        const nextTemplateId = String(activeDataSet.templateId ?? '').trim();
        if (nextTemplateId && RESUME_TEMPLATES.some((template) => template.id === nextTemplateId)) {
            setTemplateId(nextTemplateId);
        }

        const nextAccentColor = String(activeDataSet.accentColor ?? '').trim();
        if (nextAccentColor) {
            setAccentColor(nextAccentColor);
        }
    }, [guestMode, activeDataSet, skillSetIds, workExperienceIds, educationIds, projectIds, certificationIds]);

    useEffect(() => {
        if (guestMode || !activeProfileId || activeDataSet) return;
        setSelectedSkillSetIds(skillSetIds);
        setSelectedWorkExperienceIds(workExperienceIds);
        setSelectedEducationIds(educationIds);
        setSelectedProjectIds(projectIds);
        setSelectedCertificationIds(certificationIds);
    }, [
        guestMode,
        activeProfileId,
        activeDataSet,
        skillSetIds,
        workExperienceIds,
        educationIds,
        projectIds,
        certificationIds,
    ]);

    // When in view-only mode with a saved resume, parse snapshot data
    const savedSnapshotData = useMemo<ResumeTemplateData | null>(() => {
        if (!isViewOnly || !savedResumeResult) return null;
        const sr = savedResumeResult as Record<string, unknown>;
        if (!sr.snapshotData) return null;
        try {
            const parsed = typeof sr.snapshotData === 'string' ? JSON.parse(sr.snapshotData) : sr.snapshotData;
            return parsed as ResumeTemplateData;
        } catch {
            return null;
        }
    }, [isViewOnly, savedResumeResult]);

    const data = useMemo<ResumeTemplateData>(() => {
        if (guestMode) return GUEST_DATA;

        // If viewing a saved resume, use the frozen snapshot data
        if (savedSnapshotData) return savedSnapshotData;

        const preferredProfileId = String(activeProfileId ?? activeDataSet?.profileId ?? '');
        const selectedProfile =
            (preferredProfileId && profiles.find((item) => String(item.id) === preferredProfileId)) || profiles[0];

        const selectedSkillsSet = new Set(selectedSkillSetIds);
        const selectedWorkSet = new Set(selectedWorkExperienceIds);
        const selectedEducationSet = new Set(selectedEducationIds);
        const selectedProjectSet = new Set(selectedProjectIds);
        const selectedCertificationSet = new Set(selectedCertificationIds);

        const fullName = (user?.name || user?.email?.split('@')[0] || 'Your Name').trim();

        const liveData: ResumeTemplateData = {
            fullName,
            profile: selectedProfile
                ? {
                      headline: (selectedProfile.headline as string | null | undefined) ?? null,
                      summary: (selectedProfile.summary as string | null | undefined) ?? null,
                      avatarUrl: (selectedProfile.avatarUrl as string | null | undefined) ?? null,
                      phone: (selectedProfile.phone as string | null | undefined) ?? null,
                      email: (selectedProfile.email as string | null | undefined) ?? user?.email ?? null,
                      website: (selectedProfile.website as string | null | undefined) ?? null,
                      linkedinUrl: (selectedProfile.linkedinUrl as string | null | undefined) ?? null,
                      githubUrl: (selectedProfile.githubUrl as string | null | undefined) ?? null,
                      location: (selectedProfile.location as string | null | undefined) ?? null,
                  }
                : {
                      headline: null,
                      summary: null,
                      avatarUrl: null,
                      phone: null,
                      email: user?.email ?? null,
                      website: null,
                      linkedinUrl: null,
                      githubUrl: null,
                      location: null,
                  },
            skillSets: skillSets
                .filter((item) => selectedSkillsSet.has(String(item.id ?? '')))
                .map((item) => ({
                    id: String(item.id ?? ''),
                    name: String(item.name ?? ''),
                    skills: parseStringArray(item.skills),
                })),
            workExperiences: workExperiences
                .filter((item) => selectedWorkSet.has(String(item.id ?? '')))
                .map((item) => ({
                    id: String(item.id ?? ''),
                    company: String(item.company ?? ''),
                    designation: String(item.designation ?? ''),
                    location: (item.location as string | null | undefined) ?? null,
                    startDate: (item.startDate as string | null | undefined) ?? null,
                    endDate: (item.endDate as string | null | undefined) ?? null,
                    isCurrent: Boolean(item.isCurrent),
                    description: (item.description as string | null | undefined) ?? null,
                    highlights: parseStringArray(item.highlights),
                })),
            educations: educations
                .filter((item) => selectedEducationSet.has(String(item.id ?? '')))
                .map((item) => ({
                    id: String(item.id ?? ''),
                    institution: String(item.institution ?? ''),
                    degree: String(item.degree ?? ''),
                    field: (item.field as string | null | undefined) ?? null,
                    startDate: (item.startDate as string | null | undefined) ?? null,
                    endDate: (item.endDate as string | null | undefined) ?? null,
                    grade: (item.grade as string | null | undefined) ?? null,
                    description: (item.description as string | null | undefined) ?? null,
                })),
            projects: projects
                .filter((item) => selectedProjectSet.has(String(item.id ?? '')))
                .map((item) => ({
                    id: String(item.id ?? ''),
                    title: String(item.title ?? ''),
                    description: (item.description as string | null | undefined) ?? null,
                    url: (item.url as string | null | undefined) ?? null,
                    techStack: parseStringArray(item.techStack),
                    startDate: (item.startDate as string | null | undefined) ?? null,
                    endDate: (item.endDate as string | null | undefined) ?? null,
                })),
            certifications: certifications
                .filter((item) => selectedCertificationSet.has(String(item.id ?? '')))
                .map((item) => ({
                    id: String(item.id ?? ''),
                    name: String(item.name ?? ''),
                    issuer: String(item.issuer ?? ''),
                    issueDate: (item.issueDate as string | null | undefined) ?? null,
                    expiryDate: (item.expiryDate as string | null | undefined) ?? null,
                    credentialUrl: (item.credentialUrl as string | null | undefined) ?? null,
                })),
        };

        return liveData;
    }, [
        guestMode,
        profilesResult,
        skillSetsResult,
        workExperiencesResult,
        educationsResult,
        projectsResult,
        certificationsResult,
        activeDataSet,
        profiles,
        skillSets,
        workExperiences,
        educations,
        projects,
        certifications,
        selectedSkillSetIds,
        selectedWorkExperienceIds,
        selectedEducationIds,
        selectedProjectIds,
        selectedCertificationIds,
        user?.name,
        user?.email,
    ]);

    // Unfiltered data for the sidebar — all items shown, checkboxes toggle visibility in preview
    const sidebarData = useMemo<ResumeTemplateData>(() => {
        // In guest mode or saved-resume view-only, sidebar shows the same data as preview
        if (guestMode) return GUEST_DATA;
        if (savedSnapshotData) return savedSnapshotData;

        const preferredProfileId = String(activeProfileId ?? activeDataSet?.profileId ?? '');
        const selectedProfile =
            (preferredProfileId && profiles.find((item) => String(item.id) === preferredProfileId)) || profiles[0];

        const fullName = (user?.name || user?.email?.split('@')[0] || 'Your Name').trim();

        return {
            fullName,
            profile: selectedProfile
                ? {
                      headline: (selectedProfile.headline as string | null | undefined) ?? null,
                      summary: (selectedProfile.summary as string | null | undefined) ?? null,
                      avatarUrl: (selectedProfile.avatarUrl as string | null | undefined) ?? null,
                      phone: (selectedProfile.phone as string | null | undefined) ?? null,
                      email: (selectedProfile.email as string | null | undefined) ?? user?.email ?? null,
                      website: (selectedProfile.website as string | null | undefined) ?? null,
                      linkedinUrl: (selectedProfile.linkedinUrl as string | null | undefined) ?? null,
                      githubUrl: (selectedProfile.githubUrl as string | null | undefined) ?? null,
                      location: (selectedProfile.location as string | null | undefined) ?? null,
                  }
                : {
                      headline: null,
                      summary: null,
                      avatarUrl: null,
                      phone: null,
                      email: user?.email ?? null,
                      website: null,
                      linkedinUrl: null,
                      githubUrl: null,
                      location: null,
                  },
            // No filtering — all items from the data source
            skillSets: skillSets.map((item) => ({
                id: String(item.id ?? ''),
                name: String(item.name ?? ''),
                skills: parseStringArray(item.skills),
            })),
            workExperiences: workExperiences.map((item) => ({
                id: String(item.id ?? ''),
                company: String(item.company ?? ''),
                designation: String(item.designation ?? ''),
                location: (item.location as string | null | undefined) ?? null,
                startDate: (item.startDate as string | null | undefined) ?? null,
                endDate: (item.endDate as string | null | undefined) ?? null,
                isCurrent: Boolean(item.isCurrent),
                description: (item.description as string | null | undefined) ?? null,
                highlights: parseStringArray(item.highlights),
            })),
            educations: educations.map((item) => ({
                id: String(item.id ?? ''),
                institution: String(item.institution ?? ''),
                degree: String(item.degree ?? ''),
                field: (item.field as string | null | undefined) ?? null,
                startDate: (item.startDate as string | null | undefined) ?? null,
                endDate: (item.endDate as string | null | undefined) ?? null,
                grade: (item.grade as string | null | undefined) ?? null,
                description: (item.description as string | null | undefined) ?? null,
            })),
            projects: projects.map((item) => ({
                id: String(item.id ?? ''),
                title: String(item.title ?? ''),
                description: (item.description as string | null | undefined) ?? null,
                url: (item.url as string | null | undefined) ?? null,
                techStack: parseStringArray(item.techStack),
                startDate: (item.startDate as string | null | undefined) ?? null,
                endDate: (item.endDate as string | null | undefined) ?? null,
            })),
            certifications: certifications.map((item) => ({
                id: String(item.id ?? ''),
                name: String(item.name ?? ''),
                issuer: String(item.issuer ?? ''),
                issueDate: (item.issueDate as string | null | undefined) ?? null,
                expiryDate: (item.expiryDate as string | null | undefined) ?? null,
                credentialUrl: (item.credentialUrl as string | null | undefined) ?? null,
            })),
        };
    }, [
        guestMode,
        savedSnapshotData,
        activeDataSet,
        profiles,
        skillSets,
        workExperiences,
        educations,
        projects,
        certifications,
        activeProfileId,
        user?.name,
        user?.email,
    ]);

    useEffect(() => {
        if (guestMode || !activeDataSet) return;
        const dataSetId = String(activeDataSet.id ?? '');
        if (!dataSetId) return;

        const payload = buildResumeDataSetPersistData({
            templateId,
            accentColor,
            profileId: String(activeProfileId ?? activeDataSet.profileId ?? profileIds[0] ?? ''),
            selectedSkillSetIds,
            selectedWorkExperienceIds,
            selectedEducationIds,
            selectedProjectIds,
            selectedCertificationIds,
        });

        const signature = JSON.stringify(payload);
        if (signature === persistSignatureRef.current) return;

        const timer = setTimeout(() => {
            persistSignatureRef.current = signature;
            updateDataSet.mutate({
                id: dataSetId,
                data: payload,
            } as never);
        }, 250);

        return () => clearTimeout(timer);
    }, [
        guestMode,
        activeProfileId,
        activeDataSet,
        templateId,
        accentColor,
        selectedSkillSetIds,
        selectedWorkExperienceIds,
        selectedEducationIds,
        selectedProjectIds,
        selectedCertificationIds,
        profileIds,
        updateDataSet,
    ]);

    const toggleSkillSet = useCallback((id: string) => {
        setSelectedSkillSetIds((prev) => toggleSelectedId(prev, id));
    }, []);
    const toggleWorkExperience = useCallback((id: string) => {
        setSelectedWorkExperienceIds((prev) => toggleSelectedId(prev, id));
    }, []);
    const toggleEducation = useCallback((id: string) => {
        setSelectedEducationIds((prev) => toggleSelectedId(prev, id));
    }, []);
    const toggleProject = useCallback((id: string) => {
        setSelectedProjectIds((prev) => toggleSelectedId(prev, id));
    }, []);
    const toggleCertification = useCallback((id: string) => {
        setSelectedCertificationIds((prev) => toggleSelectedId(prev, id));
    }, []);

    const handlePrint = useCallback(() => {
        if (guestMode) return;
        window.print();
    }, [guestMode]);

    const handleHeadingChange = useCallback((key: SectionKey, label: string) => {
        setHeadingLabels((prev) => ({ ...prev, [key]: label }));
    }, []);

    // ---- Open save dialog ----
    const handleOpenSaveDialog = useCallback(() => {
        if (guestMode) return;
        if (!saveName) {
            setSaveName(`Resume — ${new Date().toLocaleDateString()}`);
        }
        setShowSaveDialog(true);
    }, [guestMode, saveName]);

    // ---- Confirm save — creates or overwrites a ResumeSaved via API ----
    const handleConfirmSave = useCallback(() => {
        if (guestMode || !saveName.trim()) return;

        const payload: Record<string, unknown> = {
            name: saveName.trim(),
            dataSetId: String(activeDataSet?.id ?? effectiveDataSetId ?? ''),
            templateId,
            accentColor,
            fontSize,
            sectionOrder: JSON.stringify(sectionOrder),
            headingLabels: JSON.stringify(headingLabels),
            snapshotData: JSON.stringify(data),
        };

        if (loadedResumeId) {
            // Overwrite existing saved resume
            updateSavedResume.mutate({ id: loadedResumeId, data: payload } as any, {
                onSuccess: () => {
                    setShowSaveDialog(false);
                    setShowSaveNotice(true);
                    setTimeout(() => setShowSaveNotice(false), 5000);
                },
            });
        } else {
            // Create new saved resume
            createSavedResume.mutate(payload as any, {
                onSuccess: (result: any) => {
                    const newId = result?.id ?? result?.data?.id;
                    if (newId) {
                        setLoadedResumeId(String(newId));
                        setIsViewOnly(true);
                        // Update URL to include resumeId
                        navigate({
                            to: '/builder',
                            search: { resumeId: String(newId), dataSetId: undefined },
                            replace: true,
                        });
                    }
                    setShowSaveDialog(false);
                    setShowSaveNotice(true);
                    setTimeout(() => setShowSaveNotice(false), 5000);
                },
            });
        }
    }, [
        guestMode,
        saveName,
        loadedResumeId,
        activeDataSet,
        effectiveDataSetId,
        templateId,
        accentColor,
        fontSize,
        sectionOrder,
        headingLabels,
        data,
        createSavedResume,
        updateSavedResume,
        navigate,
    ]);

    // ---- Refresh data set — rebuild live data from data set, exiting view-only ----
    const handleRefreshData = useCallback(() => {
        if (!loadedResumeId) return;
        // Switch to edit mode — the saved snapshot data will be replaced by live data
        setIsViewOnly(false);
        // Re-trigger hydration from the active data set
        dataSetHydrationRef.current = null;
    }, [loadedResumeId]);

    // ---- Toggle edit / view mode on a saved resume ----
    const handleToggleEdit = useCallback(() => {
        if (!loadedResumeId) return;
        if (isViewOnly) {
            setIsViewOnly(false);
            // Allow live data to take over
            dataSetHydrationRef.current = null;
        } else {
            setIsViewOnly(true);
        }
    }, [loadedResumeId, isViewOnly]);

    return (
        <div className="flex h-screen flex-col bg-background text-foreground">
            {/* ---- Guest Mode Banner ---- */}
            {guestMode && (
                <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm text-foreground print:hidden">
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
                        <a href="/auth/signup" className="font-medium text-primary underline hover:opacity-90">
                            Create an account
                        </a>{' '}
                        to unlock everything.
                    </span>
                </div>
            )}

            {/* ---- Save Notice Toast ---- */}
            {showSaveNotice && (
                <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-primary/10 px-4 py-2 text-sm text-primary print:hidden">
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
                        <strong>Resume saved!</strong> You can find it in{' '}
                        <a href="/my-resumes" className="font-medium underline">
                            My Resumes
                        </a>
                        .
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

            {/* ---- View-Only Banner ---- */}
            {isViewOnly && loadedResumeId && !guestMode && (
                <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm text-amber-800 dark:text-amber-300 print:hidden">
                    <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                    </svg>
                    <span>
                        <strong>View Only</strong> — This is a saved resume. Click &quot;Edit&quot; to make changes, or
                        &quot;Refresh Resume Data Set&quot; to update data.
                    </span>
                </div>
            )}

            {/* ---- Toolbar ---- */}
            <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2 print:hidden">
                <div className="flex items-center gap-3">
                    {/* Desktop sidebar toggle */}
                    {!isCompact && (
                        <SidebarToggle
                            side="left"
                            isOpen={leftSidebarOpen}
                            onClick={() => setLeftSidebarOpen((o) => !o)}
                        />
                    )}
                    <h1 className="text-sm font-semibold text-foreground">
                        Resume Builder
                        {guestMode ? (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-foreground">
                                Guest Mode
                            </span>
                        ) : loadedResumeId && isViewOnly ? (
                            <span className="ml-2 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-300">
                                Saved — View Only
                            </span>
                        ) : loadedResumeId ? (
                            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-normal text-primary">
                                Editing
                            </span>
                        ) : (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                                Live Data
                            </span>
                        )}
                    </h1>
                    {isLiveDataLoading && (
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Syncing profile…</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Refresh Resume Data Set (when viewing a saved resume) */}
                    {loadedResumeId && isViewOnly && !guestMode && (
                        <button
                            type="button"
                            onClick={handleRefreshData}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                            title="Refresh data from the linked data set and enable editing"
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
                            Refresh Resume Data Set
                        </button>
                    )}
                    {/* Edit / View toggle for saved resumes */}
                    {loadedResumeId && !guestMode && (
                        <button
                            type="button"
                            onClick={handleToggleEdit}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                            title={isViewOnly ? 'Switch to edit mode' : 'Switch to view-only mode'}
                        >
                            {isViewOnly ? 'Edit' : 'View Only'}
                        </button>
                    )}
                    {/* Save button */}
                    {!guestMode && (
                        <button
                            type="button"
                            onClick={handleOpenSaveDialog}
                            disabled={isViewOnly}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isViewOnly ? 'Switch to edit mode to save changes' : 'Save this resume'}
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
                            {loadedResumeId ? 'Save' : 'Save Resume'}
                        </button>
                    )}
                    {/* Print button */}
                    {guestMode ? (
                        <span
                            title="Sign up to unlock printing and PDF export"
                            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
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
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
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
                            className="fixed left-2 top-[50%] z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-border hover:bg-muted print:hidden"
                            title="Toggle content panel"
                        >
                            <IconLayoutSidebar className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setRightSidebarOpen((o) => !o);
                                setLeftSidebarOpen(false);
                            }}
                            className="fixed right-2 top-[50%] z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-border hover:bg-muted print:hidden"
                            title="Toggle style panel"
                        >
                            <IconAdjustments className="h-5 w-5 text-muted-foreground" />
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
                            <aside className="fixed left-0 top-0 z-30 mt-[var(--toolbar-h,56px)] h-[calc(100vh-var(--toolbar-h,56px))] w-[300px] border-r border-border bg-card shadow-xl print:hidden">
                                <LeftSidebar
                                    data={data}
                                    sidebarData={sidebarData}
                                    sectionOrder={sectionOrder}
                                    onReorder={setSectionOrder}
                                    profiles={profiles.map((profile) => ({
                                        id: String(profile.id ?? ''),
                                        label:
                                            String(profile.headline ?? '').trim() ||
                                            String(profile.email ?? '').trim() ||
                                            'Untitled Profile',
                                    }))}
                                    activeProfileId={activeProfileId}
                                    onProfileChange={setActiveProfileId}
                                    selectedSkillSetIds={selectedSkillSetIds}
                                    selectedWorkExperienceIds={selectedWorkExperienceIds}
                                    selectedEducationIds={selectedEducationIds}
                                    selectedProjectIds={selectedProjectIds}
                                    selectedCertificationIds={selectedCertificationIds}
                                    onToggleSkillSet={toggleSkillSet}
                                    onToggleWorkExperience={toggleWorkExperience}
                                    onToggleEducation={toggleEducation}
                                    onToggleProject={toggleProject}
                                    onToggleCertification={toggleCertification}
                                    isViewOnly={isViewOnly}
                                />
                            </aside>
                        </>
                    ) : (
                        <aside className="w-[280px] shrink-0 border-r border-border bg-card print:hidden">
                            <LeftSidebar
                                data={data}
                                sidebarData={sidebarData}
                                sectionOrder={sectionOrder}
                                onReorder={setSectionOrder}
                                profiles={profiles.map((profile) => ({
                                    id: String(profile.id ?? ''),
                                    label:
                                        String(profile.headline ?? '').trim() ||
                                        String(profile.email ?? '').trim() ||
                                        'Untitled Profile',
                                }))}
                                activeProfileId={activeProfileId}
                                onProfileChange={setActiveProfileId}
                                selectedSkillSetIds={selectedSkillSetIds}
                                selectedWorkExperienceIds={selectedWorkExperienceIds}
                                selectedEducationIds={selectedEducationIds}
                                selectedProjectIds={selectedProjectIds}
                                selectedCertificationIds={selectedCertificationIds}
                                onToggleSkillSet={toggleSkillSet}
                                onToggleWorkExperience={toggleWorkExperience}
                                onToggleEducation={toggleEducation}
                                onToggleProject={toggleProject}
                                onToggleCertification={toggleCertification}
                                isViewOnly={isViewOnly}
                            />
                        </aside>
                    ))}

                {/* Center — Resume canvas */}
                <main id="resume-print-area" className="flex flex-1 flex-col items-center overflow-y-auto p-4 lg:p-8">
                    <div className="w-full max-w-[816px] overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-border dark:bg-gray-900">
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
                            <aside className="fixed right-0 top-0 z-30 mt-[var(--toolbar-h,56px)] h-[calc(100vh-var(--toolbar-h,56px))] w-[300px] border-l border-border bg-card shadow-xl print:hidden">
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
                        <aside className="w-[280px] shrink-0 border-l border-border bg-card print:hidden">
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

            {/* ---- Save Dialog ---- */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{loadedResumeId ? 'Save Resume' : 'Save New Resume'}</DialogTitle>
                        <DialogDescription>
                            {loadedResumeId
                                ? 'Overwrite the existing saved resume with the current state.'
                                : 'Give your resume a name and save it. You can find it later in My Resumes.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Resume Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            placeholder="e.g. Frontend Developer Resume"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmSave}
                            disabled={!saveName.trim() || createSavedResume.isPending || updateSavedResume.isPending}
                        >
                            {createSavedResume.isPending || updateSavedResume.isPending
                                ? 'Saving…'
                                : loadedResumeId
                                  ? 'Overwrite & Save'
                                  : 'Save Resume'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
