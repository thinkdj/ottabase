import { ResumeTag } from '@/components/ResumeTag';
import { ShareResumeDialog } from '@/components/ShareResumeDialog';
import { calculateAtsScore } from '@/lib/ats-score';
import { useSession } from '@/lib/auth';
import { exportAsPdfServerSide, exportAsPlainText } from '@/lib/resume-export';
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
    useResumeSummaries,
    useResumeWorkExperiences,
    useUpdateResumeDataSet,
    useUpdateResumeSaved,
} from '@/ottabase/hooks/useResume';
import { OttaSelect, type ItemRendererProps, type OttaSelectItem } from '@ottabase/ottaselect';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Input,
} from '@ottabase/ui-shadcn';
import { IconAdjustments, IconLayoutSidebar, IconMenu2, IconShare } from '@tabler/icons-react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { GUEST_DATA } from './guestData';
import {
    buildDefaultResumeFileName,
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
        summary: { key: 'summary', label: 'Summary', count: data.summary ? 1 : 0 },
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
    const handleToggle = useCallback(() => {
        if (disabled) return;
        onToggle?.();
    }, [disabled, onToggle]);

    return (
        <div
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={(e) => {
                if (disabled) return;
                if (e.target instanceof HTMLInputElement) return;
                handleToggle();
            }}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggle();
                }
            }}
            role="checkbox"
            aria-checked={checked}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
        >
            {/* Include/exclude checkbox */}
            {showCheckbox ? (
                <input
                    type="checkbox"
                    checked={checked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        e.stopPropagation();
                        handleToggle();
                    }}
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

function ellipsize(text: string, max = 120): string {
    const clean = (text || '').trim();
    if (!clean) return '';
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
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
    summaryAvailable,
    summaryChecked,
    onToggleSummary,
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
    loadedResumeId,
    onRefreshDataSet,
}: {
    data: ResumeTemplateData;
    /** Unfiltered data — all items regardless of selection. Used to render sidebar item lists. */
    sidebarData: ResumeTemplateData;
    sectionOrder: SectionKey[];
    onReorder: (newOrder: SectionKey[]) => void;
    profiles: Array<{ id: string; label: string }>;
    activeProfileId: string | null;
    onProfileChange: (id: string) => void;
    summaryAvailable: boolean;
    summaryChecked: boolean;
    onToggleSummary: () => void;
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
    /** The loaded saved resume ID — used to show refresh button */
    loadedResumeId?: string | null;
    /** Callback to refresh data from the linked data set and exit view-only mode */
    onRefreshDataSet?: () => void;
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
                {/* Refresh data set — shown below disabled profile when viewing a saved resume */}
                {isViewOnly && loadedResumeId && onRefreshDataSet && (
                    <button
                        type="button"
                        onClick={onRefreshDataSet}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
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
                                    {section.key === 'summary' && (
                                        <ItemCard
                                            title={
                                                summaryAvailable
                                                    ? sidebarData.summary?.title?.trim() || 'Summary'
                                                    : 'Summary'
                                            }
                                            subtitle={
                                                summaryAvailable
                                                    ? ellipsize(
                                                          sidebarData.summary?.content ||
                                                              sidebarData.profile?.headline ||
                                                              '',
                                                      ) || 'Add summary text in My Data.'
                                                    : 'Add a summary in My Data to enable'
                                            }
                                            checked={summaryAvailable ? summaryChecked : false}
                                            onToggle={onToggleSummary}
                                            disabled={isViewOnly || !summaryAvailable}
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
    data,
    atsResult,
    atsPanelOpen,
    onToggleAtsPanel,
}: {
    templateId: string;
    setTemplateId: (id: string) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
    fontSize: number;
    setFontSize: (size: number) => void;
    data: ResumeTemplateData;
    atsResult: ReturnType<typeof calculateAtsScore>;
    atsPanelOpen: boolean;
    onToggleAtsPanel: () => void;
}) {
    const templateItems = useMemo<OttaSelectItem[]>(
        () => RESUME_TEMPLATES.map((template) => ({ ...template, label: template.name })),
        [],
    );

    const selectedTemplate = useMemo<OttaSelectItem | null>(
        () => templateItems.find((item) => item.id === templateId) ?? templateItems[0] ?? null,
        [templateId, templateItems],
    );

    const renderTemplateItem = useCallback(
        ({ item }: ItemRendererProps) => (
            <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{item.name}</span>
                    {templateId === item.id && (
                        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] uppercase text-primary">
                            Active
                        </span>
                    )}
                </div>
                <span className="text-xs text-muted-foreground">{item.description}</span>
            </div>
        ),
        [templateId],
    );

    const renderTemplateValue = useCallback(
        (item: OttaSelectItem) => (
            <div className="flex flex-col">
                <span className="font-medium leading-tight text-foreground">{item.name}</span>
                <span className="text-xs leading-tight text-muted-foreground">{item.description}</span>
            </div>
        ),
        [],
    );

    return (
        <div className="flex h-full flex-col overflow-y-auto p-3">
            {/* ATS Score panel */}
            <AtsScorePanel result={atsResult} expanded={atsPanelOpen} onToggle={onToggleAtsPanel} />

            {/* Template picker */}
            <div className="mb-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template</h3>
                <OttaSelect
                    mode="single"
                    items={templateItems}
                    value={selectedTemplate}
                    onChange={(value) => {
                        const next = value as OttaSelectItem | null;
                        if (next?.id) setTemplateId(String(next.id));
                    }}
                    placeholder="Choose a template"
                    renderItem={renderTemplateItem}
                    renderValue={renderTemplateValue}
                    dropdownClassName="max-h-72"
                    showSelectedFirst
                />
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
// ATS Score Panel — shows ATS friendliness score + tips in right sidebar
// Severity → emoji / CSS class maps for the ATS tips
const TIP_EMOJI: Record<string, string> = { critical: '🔴', warning: '🟡', info: '🔵' };
const TIP_CLASSES: Record<string, string> = {
    critical: 'bg-red-500/10 text-red-700 dark:text-red-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    info: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

// ---------------------------------------------------------------------------
function AtsScorePanel({
    result,
    expanded,
    onToggle,
}: {
    result: ReturnType<typeof calculateAtsScore>;
    expanded: boolean;
    onToggle: () => void;
}) {
    // Colour for the score ring
    const ringColor =
        result.score >= 85
            ? '#16a34a' // green-600
            : result.score >= 70
              ? '#2563eb' // blue-600
              : result.score >= 50
                ? '#d97706' // amber-600
                : '#dc2626'; // red-600

    const circumference = 2 * Math.PI * 36; // radius 36
    const dashOffset = circumference - (result.score / 100) * circumference;

    return (
        <div className="mb-5">
            {/* Header + score ring */}
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
            >
                {/* Mini circular gauge */}
                <svg width="52" height="52" viewBox="0 0 80 80" className="shrink-0">
                    <circle
                        cx="40"
                        cy="40"
                        r="36"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-muted/30"
                    />
                    <circle
                        cx="40"
                        cy="40"
                        r="36"
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 40 40)"
                        className="transition-all duration-500"
                    />
                    <text
                        x="40"
                        y="44"
                        textAnchor="middle"
                        className="text-foreground"
                        style={{ fontSize: '20px', fontWeight: 700 }}
                    >
                        {result.score}
                    </text>
                </svg>
                <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ATS Score</h3>
                    <p className="text-sm font-medium" style={{ color: ringColor }}>
                        {result.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {result.tips.length} tip{result.tips.length !== 1 ? 's' : ''} · click to{' '}
                        {expanded ? 'hide' : 'expand'}
                    </p>
                </div>
                <svg
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </div>
    );
}

function AtsInsightsPanel({
    result,
    onClose,
    as = 'aside',
}: {
    result: ReturnType<typeof calculateAtsScore>;
    onClose: () => void;
    as?: 'aside' | 'div';
}) {
    const Wrapper = as === 'div' ? 'div' : 'aside';

    return (
        <Wrapper className="w-[280px] shrink-0 border-l border-border bg-card print:hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ATS Score</p>
                    <p className="text-sm font-medium text-foreground">{result.label}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Close ATS insights"
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="space-y-3 p-3">
                <div className="space-y-1.5">
                    {Object.entries(result.breakdown).map(([cat, { earned, max }]) => (
                        <div key={cat}>
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">{cat}</span>
                                <span className="font-medium text-foreground">
                                    {earned}/{max}
                                </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${max > 0 ? (earned / max) * 100 : 0}%`,
                                        backgroundColor:
                                            earned === max ? '#16a34a' : earned >= max * 0.5 ? '#2563eb' : '#d97706',
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {result.tips.length > 0 && (
                    <div className="space-y-1.5 border-t border-border pt-2">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Improvement Tips
                        </h4>
                        {result.tips.map((tip, i) => (
                            <div
                                key={i}
                                className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] leading-snug ${TIP_CLASSES[tip.severity] ?? TIP_CLASSES.info}`}
                            >
                                <span className="mt-px shrink-0">{TIP_EMOJI[tip.severity] ?? TIP_EMOJI.info}</span>
                                <span>{tip.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Wrapper>
    );
}

// ---------------------------------------------------------------------------
// Sidebar toggle button (used for both sidebars)
// ---------------------------------------------------------------------------
function SidebarToggle({ side, isOpen, onClick }: { side: 'left' | 'right'; isOpen: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={isOpen ? `Hide ${side} sidebar` : `Show ${side} sidebar`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-pressed={isOpen}
            aria-label={isOpen ? `Hide ${side} sidebar` : `Show ${side} sidebar`}
        >
            <IconMenu2 className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-0' : 'rotate-90'}`} />
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
        searchParams = useSearch({ from: '/resume-builder' }) as { resumeId?: string; dataSetId?: string };
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
    /** True while a server-side PDF is being generated */
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    /** Save dialog state */
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveName, setSaveName] = useState('');
    /** Share dialog state */
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const [atsPanelOpen, setAtsPanelOpen] = useState(false);

    const [selectedSkillSetIds, setSelectedSkillSetIds] = useState<string[]>(() =>
        guestMode ? GUEST_DATA.skillSets.map((s) => s.id) : [],
    );
    const [selectedWorkExperienceIds, setSelectedWorkExperienceIds] = useState<string[]>(() =>
        guestMode ? GUEST_DATA.workExperiences.map((w) => w.id) : [],
    );
    const [selectedEducationIds, setSelectedEducationIds] = useState<string[]>(() =>
        guestMode ? GUEST_DATA.educations.map((e) => e.id) : [],
    );
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() =>
        guestMode ? GUEST_DATA.projects.map((p) => p.id) : [],
    );
    const [selectedCertificationIds, setSelectedCertificationIds] = useState<string[]>(() =>
        guestMode ? GUEST_DATA.certifications.map((c) => c.id) : [],
    );
    const [includeSummary, setIncludeSummary] = useState(true);

    const dataSetHydrationRef = useRef<string | null>(null);
    const profileDataSetCreateAttemptRef = useRef<Set<string>>(new Set());
    const persistSignatureRef = useRef<string>('');
    const markUnsaved = useCallback(() => {
        if (loadedResumeId) setHasUnsavedChanges(true);
    }, [loadedResumeId]);

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
    const { data: summariesResult, isLoading: summariesLoading } = useResumeSummaries(undefined, {
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
    const summaries = useMemo(() => normalizeList<Record<string, unknown>>(summariesResult), [summariesResult]);
    const dataSets = useMemo(
        () => sortByUpdatedAtDesc(normalizeList<Record<string, unknown>>(dataSetsResult)),
        [dataSetsResult],
    );

    const summaryMap = useMemo(() => {
        const map = new Map<string, ResumeTemplateData['summary']>();
        for (const summary of summaries) {
            const id = String(summary.id ?? '');
            if (!id) continue;
            map.set(id, {
                id,
                title: (summary.title as string | null | undefined) ?? null,
                content: (summary.content as string | null | undefined) ?? '',
            });
        }
        return map;
    }, [summaries]);

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
        const srEnvelope = (savedResumeResult as any)?.data ?? savedResumeResult;
        const sr = (srEnvelope as any)?.data ?? srEnvelope;
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
            summariesLoading ||
            dataSetsLoading);

    // ── Hydrate from a saved resume (urlResumeId) ─────────────────────────
    const savedResumeHydrated = useRef(false);
    useEffect(() => {
        if (guestMode || !urlResumeId || savedResumeLoading || savedResumeHydrated.current) return;
        const srEnvelope = (savedResumeResult as any)?.data ?? savedResumeResult;
        const sr = (srEnvelope as any)?.data ?? srEnvelope;
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
    const summaryIds = useMemo(() => summaries.map((item) => String(item.id ?? '')).filter(Boolean), [summaries]);

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
            summaryId: summaryIds[0] ?? '',
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
        summaryIds,
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

        setIncludeSummary(Boolean(activeDataSet.summaryId));
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
        const srEnvelope = (savedResumeResult as any)?.data ?? savedResumeResult;
        const sr = (srEnvelope as any)?.data ?? srEnvelope;
        if (!sr.snapshotData) return null;
        try {
            const parsed = typeof sr.snapshotData === 'string' ? JSON.parse(sr.snapshotData) : sr.snapshotData;
            return parsed as ResumeTemplateData;
        } catch {
            return null;
        }
    }, [isViewOnly, savedResumeResult]);

    const selectedSummary = useMemo<ResumeTemplateData['summary'] | null>(() => {
        if (guestMode) return GUEST_DATA.summary ?? null;
        if (savedSnapshotData) return savedSnapshotData.summary ?? null;
        const summaryId = activeDataSet?.summaryId ? String(activeDataSet.summaryId) : null;
        if (!summaryId) return null;
        return summaryMap.get(summaryId) ?? null;
    }, [guestMode, savedSnapshotData, activeDataSet, summaryMap]);

    const data = useMemo<ResumeTemplateData>(() => {
        if (guestMode) {
            // Filter guest data based on selected IDs so toggling in sidebar reflects in preview
            const selectedSkillsSet = new Set(selectedSkillSetIds);
            const selectedWorkSet = new Set(selectedWorkExperienceIds);
            const selectedEducationSet = new Set(selectedEducationIds);
            const selectedProjectSet = new Set(selectedProjectIds);
            const selectedCertificationSet = new Set(selectedCertificationIds);
            return {
                ...GUEST_DATA,
                summary: includeSummary ? (GUEST_DATA.summary ?? null) : null,
                profile: GUEST_DATA.profile
                    ? {
                          ...GUEST_DATA.profile,
                      }
                    : null,
                skillSets: GUEST_DATA.skillSets.filter((s) => selectedSkillsSet.has(s.id)),
                workExperiences: GUEST_DATA.workExperiences.filter((w) => selectedWorkSet.has(w.id)),
                educations: GUEST_DATA.educations.filter((e) => selectedEducationSet.has(e.id)),
                projects: GUEST_DATA.projects.filter((p) => selectedProjectSet.has(p.id)),
                certifications: GUEST_DATA.certifications.filter((c) => selectedCertificationSet.has(c.id)),
            };
        }

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
            summary: includeSummary ? (selectedSummary ?? null) : null,
            profile: selectedProfile
                ? {
                      headline: (selectedProfile.headline as string | null | undefined) ?? null,
                      // Prefer the profile-specific avatar; fall back to the OAuth account image
                      // so templates show the pic the user sees in their profile card.
                      avatarUrl:
                          (selectedProfile.avatarUrl as string | null | undefined) ||
                          (user?.image as string | null | undefined) ||
                          null,
                      phone: (selectedProfile.phone as string | null | undefined) ?? null,
                      email: (selectedProfile.email as string | null | undefined) ?? user?.email ?? null,
                      website: (selectedProfile.website as string | null | undefined) ?? null,
                      linkedinUrl: (selectedProfile.linkedinUrl as string | null | undefined) ?? null,
                      githubUrl: (selectedProfile.githubUrl as string | null | undefined) ?? null,
                      location: (selectedProfile.location as string | null | undefined) ?? null,
                  }
                : {
                      headline: null,
                      avatarUrl: (user?.image as string | null | undefined) || null,
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
        selectedSummary,
        selectedSkillSetIds,
        selectedWorkExperienceIds,
        selectedEducationIds,
        selectedProjectIds,
        selectedCertificationIds,
        includeSummary,
        user?.name,
        user?.email,
        user?.image,
    ]);

    const atsResult = useMemo(() => calculateAtsScore(data), [data]);

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
            summary: selectedSummary,
            profile: selectedProfile
                ? {
                      headline: (selectedProfile.headline as string | null | undefined) ?? null,
                      // Prefer the profile-specific avatar; fall back to the OAuth account image.
                      avatarUrl:
                          (selectedProfile.avatarUrl as string | null | undefined) ||
                          (user?.image as string | null | undefined) ||
                          null,
                      phone: (selectedProfile.phone as string | null | undefined) ?? null,
                      email: (selectedProfile.email as string | null | undefined) ?? user?.email ?? null,
                      website: (selectedProfile.website as string | null | undefined) ?? null,
                      linkedinUrl: (selectedProfile.linkedinUrl as string | null | undefined) ?? null,
                      githubUrl: (selectedProfile.githubUrl as string | null | undefined) ?? null,
                      location: (selectedProfile.location as string | null | undefined) ?? null,
                  }
                : {
                      headline: null,
                      avatarUrl: (user?.image as string | null | undefined) || null,
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
        selectedSummary,
        user?.name,
        user?.email,
        user?.image,
    ]);

    useEffect(() => {
        if (guestMode || !activeDataSet) return;
        const dataSetId = String(activeDataSet.id ?? '');
        if (!dataSetId) return;

        const payload = buildResumeDataSetPersistData({
            templateId,
            accentColor,
            profileId: String(activeProfileId ?? activeDataSet.profileId ?? profileIds[0] ?? ''),
            summaryId: activeDataSet.summaryId ? String(activeDataSet.summaryId) : '',
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

    const toggleSummary = useCallback(() => {
        if (isViewOnly) return;
        setIncludeSummary((prev) => !prev);
    }, [isViewOnly]);

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

    /**
     * Download as PDF.
     * - Authenticated users: captures the live rendered DOM (`#resume-capture`)
     *   + all page CSS and sends to POST /api/resume/pdf (Cloudflare Puppeteer)
     *   for a pixel-perfect replica. Requires OBCF_BROWSER binding.
     * - Guest mode: no-op (button is locked in the UI).
     */
    const handleDownloadPdf = useCallback(async () => {
        if (guestMode) return;
        const pdfFileName = saveName || data.fullName || 'resume';
        setIsPdfGenerating(true);
        try {
            // Pass resolved resume data so the worker can embed title/author/subject/keywords.
            await exportAsPdfServerSide('resume-capture', pdfFileName, data);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'PDF generation failed';
            toast.error(message, { description: 'Ensure the Browser Rendering API is enabled in Cloudflare.' });
        } finally {
            setIsPdfGenerating(false);
        }
    }, [guestMode, saveName, data]);

    /** Download as plain text (.txt) suitable for ATS/copy-paste. */
    const handleDownloadText = useCallback(() => {
        if (guestMode) return;
        exportAsPlainText(data, saveName || data.fullName || 'resume');
    }, [guestMode, data, saveName]);

    const handleHeadingChange = useCallback((key: SectionKey, label: string) => {
        setHeadingLabels((prev) => ({ ...prev, [key]: label }));
    }, []);

    const summaryAvailable = Boolean(selectedSummary);
    const summaryChecked = summaryAvailable && (isViewOnly ? Boolean(data.summary) : includeSummary);

    // ---- Open save dialog ----
    const handleOpenSaveDialog = useCallback(() => {
        if (guestMode) return;
        if (!saveName) {
            const activeTemplateName = RESUME_TEMPLATES.find((template) => template.id === templateId)?.name;
            setSaveName(buildDefaultResumeFileName(data.fullName, activeTemplateName));
        }
        setShowSaveDialog(true);
    }, [guestMode, saveName, data.fullName, templateId]);

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

        const resumeIdToUpdate = loadedResumeId || urlResumeId || null;

        if (resumeIdToUpdate) {
            // Overwrite existing saved resume
            updateSavedResume.mutate({ id: resumeIdToUpdate, data: payload } as any, {
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
                    const maybeIds = [
                        result?.id,
                        result?.data?.id,
                        result?.data?.data?.id,
                        Array.isArray(result?.data) ? result.data[0]?.id : null,
                        Array.isArray(result?.data?.data) ? result.data.data[0]?.id : null,
                    ];
                    const newId = maybeIds.map((id) => (id ? String(id) : null)).find(Boolean);
                    if (newId) {
                        setLoadedResumeId(String(newId));
                        setIsViewOnly(true);
                        // Update URL to include resumeId
                        navigate({
                            to: '/resume-builder',
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
                        <strong>View Only</strong> — This is a saved resume. Click &quot;Edit&quot; to change data, or
                        adjust theme/colors and save directly.
                    </span>
                </div>
            )}

            {/* ---- Toolbar ---- */}
            <header className="relative flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2 print:hidden">
                {!guestMode && (
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2">
                        {(() => {
                            if (!loadedResumeId) {
                                return (
                                    <ResumeTag
                                        label="New"
                                        className="shadow-none border border-blue-200/70 bg-blue-100 text-blue-700 dark:border-blue-800/60 dark:bg-blue-900/40 dark:text-blue-100"
                                    />
                                );
                            }
                            if (isViewOnly) {
                                return (
                                    <ResumeTag
                                        label="Saved — View Only"
                                        className="shadow-none bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                    />
                                );
                            }
                            return <ResumeTag label="Editing" className="shadow-none bg-primary/10 text-primary" />;
                        })()}
                    </span>
                )}
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
                        {guestMode && (
                            <span className="ml-2 inline-flex">
                                <ResumeTag label="Guest Mode" className="shadow-none bg-muted text-foreground" />
                            </span>
                        )}
                    </h1>
                    {isLiveDataLoading && (
                        <ResumeTag label="Syncing profile…" className="shadow-none bg-primary/10 text-primary" />
                    )}
                </div>
                <div className="flex items-center gap-2">
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
                    {/* Save button — enabled even in view-only when a saved resume is loaded (for style changes) */}
                    {!guestMode && (
                        <button
                            type="button"
                            onClick={handleOpenSaveDialog}
                            disabled={isViewOnly && !loadedResumeId}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                                isViewOnly && !loadedResumeId
                                    ? 'Switch to edit mode to save changes'
                                    : 'Save this resume'
                            }
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
                    {/* Share button — only when resume is saved (or locked in guest mode) */}
                    {loadedResumeId && !guestMode ? (
                        <button
                            type="button"
                            onClick={() => setShowShareDialog(true)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                            title="Share this resume"
                        >
                            <IconShare className="h-4 w-4" />
                            Share
                        </button>
                    ) : guestMode ? (
                        <span
                            title="Sign up to share resumes"
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
                            Share
                        </span>
                    ) : null}
                    {/* Print button — locked in guest mode */}
                    {guestMode && (
                        <span
                            title="Sign up to print resumes"
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
                    )}
                    {/* Download button — PDF (primary) + format dropdown */}
                    {guestMode ? (
                        // Locked state shown in guest mode
                        <span
                            title="Sign up to unlock PDF download"
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
                            Download PDF
                        </span>
                    ) : (
                        // Split button: primary PDF action + chevron opens format menu
                        <DropdownMenu>
                            <div className="flex items-stretch rounded-md shadow-sm">
                                {/* Primary action: Download PDF */}
                                <button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    disabled={isPdfGenerating}
                                    className="inline-flex items-center gap-1.5 rounded-l-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                                    title="Download PDF — generated server-side for perfect print quality"
                                >
                                    {isPdfGenerating ? (
                                        // Spinning indicator while the server generates the PDF
                                        <svg
                                            className="h-4 w-4 animate-spin"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M12 3v3m0 12v3M3 12h3m12 0h3m-2.636-6.364l-2.121 2.121M8.757 15.243l-2.121 2.121M17.364 17.364l-2.121-2.121M8.757 8.757L6.636 6.636"
                                            />
                                        </svg>
                                    ) : (
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
                                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                            />
                                        </svg>
                                    )}
                                    {isPdfGenerating ? 'Generating…' : 'Download PDF'}
                                </button>

                                {/* Chevron trigger for format dropdown */}
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        disabled={isPdfGenerating}
                                        className="inline-flex items-center rounded-r-md border-l border-primary-foreground/30 bg-primary px-1.5 py-1.5 text-primary-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                                        title="More export formats"
                                        aria-label="More export formats"
                                    >
                                        <svg
                                            className="h-3.5 w-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2.5}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </DropdownMenuTrigger>
                            </div>

                            <DropdownMenuContent align="end" className="w-48">
                                {/* PDF option — server-side for logged-in users */}
                                <DropdownMenuItem
                                    onClick={handleDownloadPdf}
                                    className="cursor-pointer"
                                    disabled={isPdfGenerating}
                                >
                                    <svg
                                        className="mr-2 h-4 w-4 shrink-0"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                        />
                                    </svg>
                                    <div>
                                        <div className="font-medium">PDF</div>
                                        <div className="text-xs text-muted-foreground">
                                            Server-generated · Best quality
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {/* Plain text — for ATS / copy-paste */}
                                <DropdownMenuItem onClick={handleDownloadText} className="cursor-pointer">
                                    <svg
                                        className="mr-2 h-4 w-4 shrink-0"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                    <div>
                                        <div className="font-medium">Plain Text</div>
                                        <div className="text-xs text-muted-foreground">ATS-friendly .txt</div>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                    summaryAvailable={summaryAvailable}
                                    summaryChecked={summaryChecked}
                                    onToggleSummary={toggleSummary}
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
                                    loadedResumeId={loadedResumeId}
                                    onRefreshDataSet={handleRefreshData}
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
                                summaryAvailable={summaryAvailable}
                                summaryChecked={summaryChecked}
                                onToggleSummary={toggleSummary}
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
                                loadedResumeId={loadedResumeId}
                                onRefreshDataSet={handleRefreshData}
                            />
                        </aside>
                    ))}

                {/* Center — Resume canvas */}
                <main id="resume-print-area" className="flex flex-1 flex-col items-center overflow-y-auto py-4 lg:py-8">
                    {/* id="resume-capture" is used by exportAsPdfServerSide to serialise the rendered DOM */}
                    <div
                        id="resume-capture"
                        className="aspect-[210/297] w-full min-w-0 max-w-[816px] overflow-y-auto overflow-x-hidden bg-white shadow-lg ring-1 ring-border print:max-w-none
                        print:aspect-auto print:min-h-0 [&>div]:min-h-full [&>div]:bg-white rounded-lg print:rounded-none p-0 mt-4 print:shadow-none
                        print:ring-none print:border-none print:ring-border-none print:mt-0"
                    >
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

                {/* ATS insights panel */}
                {atsPanelOpen && !isCompact && (
                    <AtsInsightsPanel result={atsResult} onClose={() => setAtsPanelOpen(false)} />
                )}

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
                                {atsPanelOpen && (
                                    <div className="border-b border-border">
                                        <AtsInsightsPanel
                                            as="div"
                                            result={atsResult}
                                            onClose={() => setAtsPanelOpen(false)}
                                        />
                                    </div>
                                )}
                                <RightSidebar
                                    templateId={templateId}
                                    setTemplateId={setTemplateId}
                                    accentColor={accentColor}
                                    setAccentColor={setAccentColor}
                                    fontSize={fontSize}
                                    setFontSize={setFontSize}
                                    data={data}
                                    atsResult={atsResult}
                                    atsPanelOpen={atsPanelOpen}
                                    onToggleAtsPanel={() => setAtsPanelOpen((o) => !o)}
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
                                data={data}
                                atsResult={atsResult}
                                atsPanelOpen={atsPanelOpen}
                                onToggleAtsPanel={() => setAtsPanelOpen((o) => !o)}
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

            {/* ---- Share Dialog ---- */}
            <ShareResumeDialog
                resumeId={loadedResumeId ?? ''}
                resumeName={saveName || 'Resume'}
                open={showShareDialog}
                onOpenChange={setShowShareDialog}
            />
        </div>
    );
}
