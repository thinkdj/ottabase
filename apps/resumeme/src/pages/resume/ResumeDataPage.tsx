// ---------------------------------------------------------------------------
// ResumeDataPage — CRUD management for all resume entities.
// Logged-in users can manage their profile, work experience, education,
// skills, projects, and certifications from this page.
// ---------------------------------------------------------------------------

import { useSession } from '@/lib/auth';
import {
    useCreateResumeCertification,
    useCreateResumeDataSet,
    useCreateResumeEducation,
    useCreateResumeProfile,
    useCreateResumeProject,
    useCreateResumeSkillSet,
    useCreateResumeWorkExperience,
    useDeleteResumeCertification,
    useDeleteResumeDataSet,
    useDeleteResumeEducation,
    useDeleteResumeProfile,
    useDeleteResumeProject,
    useDeleteResumeSkillSet,
    useDeleteResumeWorkExperience,
    useResumeCertifications,
    useResumeDataSets,
    useResumeEducations,
    useResumeProfiles,
    useResumeProjects,
    useResumeSkillSets,
    useResumeWorkExperiences,
    useUpdateResumeCertification,
    useUpdateResumeDataSet,
    useUpdateResumeEducation,
    useUpdateResumeProfile,
    useUpdateResumeProject,
    useUpdateResumeSkillSet,
    useUpdateResumeWorkExperience,
} from '@/ottabase/hooks/useResume';
import { AvatarEditModal } from '@/pages/user/AvatarEditModal';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Textarea,
} from '@ottabase/ui-shadcn';
import { IconPencil } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import {
    ArrowRight,
    Award,
    Briefcase,
    Database,
    FolderOpen,
    GraduationCap,
    Pencil,
    Plus,
    ShieldCheck,
    Trash2,
    UserCircle,
} from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';

// ── Types for the generic item form ──
interface FormField {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'checkbox';
    required?: boolean;
    placeholder?: string;
}

function pickEditableFields(fields: FormField[], source: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(source, field.key)) {
            out[field.key] = source[field.key];
        }
    }
    return out;
}

// ── Generic CRUD Card ──
function CrudSection<T extends { id: string }>({
    title,
    description,
    icon,
    items,
    isLoading,
    fields,
    renderItem,
    onCreate,
    onUpdate,
    onDelete,
    /** Optional: transform raw item data into form-friendly strings when editing */
    deserializeItem,
}: {
    title: string;
    description: string;
    icon: ReactNode;
    items: T[];
    isLoading: boolean;
    fields: FormField[];
    renderItem: (item: T) => { title: string; subtitle?: string };
    onCreate: (data: Record<string, unknown>) => void;
    onUpdate: (id: string, data: Record<string, unknown>) => void;
    onDelete: (id: string) => void;
    deserializeItem?: (item: T) => Record<string, unknown>;
}) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<T | null>(null);
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const openCreate = useCallback(() => {
        setEditingItem(null);
        setFormData({});
        setDialogOpen(true);
    }, []);

    const openEdit = useCallback(
        (item: T) => {
            setEditingItem(item);
            const raw = deserializeItem ? deserializeItem(item) : (item as Record<string, unknown>);
            setFormData(pickEditableFields(fields, raw));
            setDialogOpen(true);
        },
        [deserializeItem, fields],
    );

    const handleSubmit = useCallback(() => {
        const payload = pickEditableFields(fields, formData);
        if (editingItem) {
            onUpdate(editingItem.id, payload);
        } else {
            onCreate(payload);
        }
        setDialogOpen(false);
        setFormData({});
        setEditingItem(null);
    }, [editingItem, fields, formData, onCreate, onUpdate]);

    const handleDelete = useCallback(
        (id: string) => {
            onDelete(id);
            setDeleteConfirmId(null);
        },
        [onDelete],
    );

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {icon}
                        <div>
                            <CardTitle className="text-base">{title}</CardTitle>
                            <CardDescription className="text-xs">{description}</CardDescription>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={openCreate}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                        No {title.toLowerCase()} yet.{' '}
                        <button className="text-primary underline" onClick={openCreate}>
                            Add your first one
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => {
                            const { title: itemTitle, subtitle } = renderItem(item);
                            return (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-foreground truncate">{itemTitle}</p>
                                        {subtitle && (
                                            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={() => openEdit(item)}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteConfirmId(item.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>

            {/* Create / Edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem ? 'Edit' : 'Add'} {title}
                        </DialogTitle>
                        <DialogDescription>
                            {editingItem ? 'Update the details below.' : 'Fill in the details to create a new entry.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {fields.map((field) =>
                            field.type === 'checkbox' ? (
                                <label key={field.key} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={!!formData[field.key]}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, [field.key]: e.target.checked }))
                                        }
                                        className="accent-primary"
                                    />
                                    {field.label}
                                </label>
                            ) : field.type === 'textarea' ? (
                                <div key={field.key}>
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                        {field.label}
                                        {field.required && <span className="text-destructive"> *</span>}
                                    </label>
                                    <Textarea
                                        value={(formData[field.key] as string) ?? ''}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                                        }
                                        placeholder={field.placeholder}
                                        rows={3}
                                    />
                                </div>
                            ) : (
                                <div key={field.key}>
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                        {field.label}
                                        {field.required && <span className="text-destructive"> *</span>}
                                    </label>
                                    <Input
                                        value={(formData[field.key] as string) ?? ''}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                                        }
                                        placeholder={field.placeholder}
                                    />
                                </div>
                            ),
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit}>{editingItem ? 'Save' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {title}?</DialogTitle>
                        <DialogDescription>This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ── Field definitions for each entity ──
const PROFILE_FIELDS: FormField[] = [
    { key: 'headline', label: 'Headline', type: 'text', placeholder: 'e.g. Senior Software Engineer' },
    { key: 'email', label: 'Email', type: 'text', placeholder: 'you@example.com' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '+1 555-123-4567' },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'City, State' },
    { key: 'website', label: 'Website', type: 'text', placeholder: 'https://yoursite.dev' },
    { key: 'linkedinUrl', label: 'LinkedIn URL', type: 'text', placeholder: 'https://linkedin.com/in/you' },
    { key: 'githubUrl', label: 'GitHub URL', type: 'text', placeholder: 'https://github.com/you' },
    { key: 'summary', label: 'Summary', type: 'textarea', placeholder: 'Brief professional summary…' },
];

const WORK_FIELDS: FormField[] = [
    { key: 'company', label: 'Company', type: 'text', required: true, placeholder: 'Acme Corp' },
    { key: 'designation', label: 'Job Title', type: 'text', required: true, placeholder: 'Software Engineer' },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'New York, NY' },
    { key: 'startDate', label: 'Start Date (YYYY-MM)', type: 'text', placeholder: '2022-01' },
    { key: 'endDate', label: 'End Date (YYYY-MM)', type: 'text', placeholder: '2024-06 (blank if current)' },
    { key: 'isCurrent', label: 'Currently working here', type: 'checkbox' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Role overview…' },
    {
        key: 'highlights',
        label: 'Highlights (one per line)',
        type: 'textarea',
        placeholder: 'Led team of 5 engineers\nReduced latency by 40%',
    },
];

const EDUCATION_FIELDS: FormField[] = [
    { key: 'institution', label: 'Institution', type: 'text', required: true, placeholder: 'University of…' },
    { key: 'degree', label: 'Degree', type: 'text', required: true, placeholder: 'Bachelor of Science' },
    { key: 'field', label: 'Field of Study', type: 'text', placeholder: 'Computer Science' },
    { key: 'startDate', label: 'Start Date (YYYY-MM)', type: 'text', placeholder: '2018-08' },
    { key: 'endDate', label: 'End Date (YYYY-MM)', type: 'text', placeholder: '2022-05' },
    { key: 'grade', label: 'Grade / GPA', type: 'text', placeholder: '3.8 GPA' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Activities, honours…' },
];

const SKILL_FIELDS: FormField[] = [
    { key: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'Frontend' },
    {
        key: 'skills',
        label: 'Skills (comma-separated)',
        type: 'textarea',
        required: true,
        placeholder: 'React, TypeScript, Next.js',
    },
];

const PROJECT_FIELDS: FormField[] = [
    { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'My Project' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What it does…' },
    { key: 'url', label: 'URL', type: 'text', placeholder: 'https://github.com/you/project' },
    {
        key: 'techStack',
        label: 'Tech Stack (comma-separated)',
        type: 'textarea',
        placeholder: 'React, Node.js, PostgreSQL',
    },
    { key: 'startDate', label: 'Start Date (YYYY-MM)', type: 'text', placeholder: '2023-01' },
    { key: 'endDate', label: 'End Date (YYYY-MM)', type: 'text', placeholder: '2023-12' },
];

const CERTIFICATION_FIELDS: FormField[] = [
    { key: 'name', label: 'Certification Name', type: 'text', required: true, placeholder: 'AWS Solutions Architect' },
    { key: 'issuer', label: 'Issuer', type: 'text', required: true, placeholder: 'Amazon Web Services' },
    { key: 'issueDate', label: 'Issue Date (YYYY-MM)', type: 'text', placeholder: '2023-06' },
    { key: 'expiryDate', label: 'Expiry Date (YYYY-MM)', type: 'text', placeholder: '2026-06' },
    { key: 'credentialUrl', label: 'Credential URL', type: 'text', placeholder: 'https://verify.example.com' },
];

// ── Helper: convert highlights/skills/techStack between string and array ──
function serializeHighlights(data: Record<string, unknown>): Record<string, unknown> {
    const out = { ...data };
    // highlights: newline-separated → JSON array
    if (typeof out.highlights === 'string') {
        out.highlights = JSON.stringify(
            (out.highlights as string)
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
        );
    }
    // skills: comma-separated → JSON array
    if (typeof out.skills === 'string') {
        out.skills = JSON.stringify(
            (out.skills as string)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
        );
    }
    // techStack: comma-separated → JSON array
    if (typeof out.techStack === 'string') {
        out.techStack = JSON.stringify(
            (out.techStack as string)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
        );
    }
    return out;
}

/** Parse a JSON string array field for display in text input */
function deserializeArrayField(value: unknown): string {
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.join(', ');
        } catch {
            return value;
        }
    }
    if (Array.isArray(value)) return value.join(', ');
    return '';
}

/** Parse highlights for display (newline-separated) */
function deserializeHighlights(value: unknown): string {
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.join('\n');
        } catch {
            return value;
        }
    }
    if (Array.isArray(value)) return value.join('\n');
    return '';
}

/** Parse a JSON string → string[]. Returns empty array on failure. */
function parseJsonIds(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(String);
        } catch {
            /* ignore */
        }
    }
    return [];
}

// ---------------------------------------------------------------------------
// Resume Data Set section — multiselect items per category
// ---------------------------------------------------------------------------

/** Category of items that can be multi-selected into a data set */
interface SelectionCategory {
    key: string;
    label: string;
    items: Array<{ id: string; title: string; subtitle?: string }>;
}

function DataSetSection({
    dataSets,
    isLoading,
    categories,
    onCreate,
    onUpdate,
    onDelete,
}: {
    dataSets: Array<{ id: string; name: string; profileId?: string; [k: string]: unknown }>;
    isLoading: boolean;
    categories: SelectionCategory[];
    onCreate: (data: Record<string, unknown>) => void;
    onUpdate: (id: string, data: Record<string, unknown>) => void;
    onDelete: (id: string) => void;
}) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<(typeof dataSets)[number] | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [dsName, setDsName] = useState('');
    const [dsProfileId, setDsProfileId] = useState('');
    // Selection state — keyed by category key, each is a Set of selected IDs
    const [selections, setSelections] = useState<Record<string, Set<string>>>({});

    const profileCategory = categories.find((c) => c.key === 'profiles');

    const openCreate = useCallback(() => {
        setEditingItem(null);
        setDsName('');
        setDsProfileId(profileCategory?.items[0]?.id ?? '');
        // Default: select all items in each category
        const defaults: Record<string, Set<string>> = {};
        for (const cat of categories) {
            defaults[cat.key] = new Set(cat.items.map((i) => i.id));
        }
        setSelections(defaults);
        setDialogOpen(true);
    }, [categories, profileCategory]);

    const openEdit = useCallback(
        (ds: (typeof dataSets)[number]) => {
            setEditingItem(ds);
            setDsName(String(ds.name ?? ''));
            setDsProfileId(String(ds.profileId ?? ''));
            // Hydrate selections from stored JSON arrays
            const sel: Record<string, Set<string>> = {};
            const fieldMap: Record<string, string> = {
                profiles: 'profileId', // single — handled separately
                skillSets: 'selectedSkillSetIds',
                workExperiences: 'selectedWorkExperienceIds',
                educations: 'selectedEducationIds',
                projects: 'selectedProjectIds',
                certifications: 'selectedCertificationIds',
            };
            for (const cat of categories) {
                const field = fieldMap[cat.key];
                if (field && cat.key !== 'profiles') {
                    sel[cat.key] = new Set(parseJsonIds(ds[field]));
                } else {
                    // Profiles — select the linked one
                    sel[cat.key] = ds.profileId ? new Set([String(ds.profileId)]) : new Set();
                }
            }
            setSelections(sel);
            setDialogOpen(true);
        },
        [categories],
    );

    const toggleItem = useCallback((catKey: string, itemId: string) => {
        setSelections((prev) => {
            const next = { ...prev };
            const set = new Set(next[catKey] ?? []);
            if (set.has(itemId)) set.delete(itemId);
            else set.add(itemId);
            next[catKey] = set;
            return next;
        });
    }, []);

    const selectAll = useCallback(
        (catKey: string) => {
            const cat = categories.find((c) => c.key === catKey);
            if (!cat) return;
            setSelections((prev) => ({
                ...prev,
                [catKey]: new Set(cat.items.map((i) => i.id)),
            }));
        },
        [categories],
    );

    const selectNone = useCallback((catKey: string) => {
        setSelections((prev) => ({ ...prev, [catKey]: new Set() }));
    }, []);

    const handleSubmit = useCallback(() => {
        const payload: Record<string, unknown> = {
            name: dsName,
            profileId: dsProfileId,
            selectedSkillSetIds: JSON.stringify([...(selections.skillSets ?? [])]),
            selectedWorkExperienceIds: JSON.stringify([...(selections.workExperiences ?? [])]),
            selectedEducationIds: JSON.stringify([...(selections.educations ?? [])]),
            selectedProjectIds: JSON.stringify([...(selections.projects ?? [])]),
            selectedCertificationIds: JSON.stringify([...(selections.certifications ?? [])]),
        };
        if (editingItem) {
            onUpdate(editingItem.id, payload);
        } else {
            onCreate(payload);
        }
        setDialogOpen(false);
    }, [dsName, dsProfileId, selections, editingItem, onCreate, onUpdate]);

    const handleDelete = useCallback(
        (id: string) => {
            onDelete(id);
            setDeleteConfirmId(null);
        },
        [onDelete],
    );

    return (
        <Card className="border-primary/20 bg-primary/[0.02] dark:bg-primary/[0.04]">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary/70" />
                        <div>
                            <CardTitle className="text-base">Resume Data Sets</CardTitle>
                            <CardDescription className="text-xs">
                                Curate your data into named sets — each one becomes a resume in the builder
                            </CardDescription>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={openCreate}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
                ) : dataSets.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                        No data sets yet.{' '}
                        <button className="text-primary underline" onClick={openCreate}>
                            Create your first one
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {dataSets.map((ds) => {
                            const profileLabel = profileCategory?.items.find((p) => p.id === ds.profileId)?.title;
                            return (
                                <div
                                    key={ds.id}
                                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-foreground truncate">{ds.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            Profile: {profileLabel ?? 'None'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <Button size="sm" variant="ghost" asChild>
                                            <Link
                                                to="/resume-builder"
                                                search={{ dataSetId: ds.id, resumeId: undefined }}
                                                className="text-xs text-primary"
                                            >
                                                Open in Builder
                                            </Link>
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={() => openEdit(ds)}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteConfirmId(ds.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>

            {/* Create / Edit data set dialog — multiselect per category */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit' : 'Create'} Resume Data Set</DialogTitle>
                        <DialogDescription>
                            Choose which items to include in this data set. Use it in the builder to generate resumes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Name */}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Name <span className="text-destructive">*</span>
                            </label>
                            <Input
                                value={dsName}
                                onChange={(e) => setDsName(e.target.value)}
                                placeholder="e.g. Frontend Developer"
                            />
                        </div>

                        {/* Profile selector (single select) */}
                        {profileCategory && profileCategory.items.length > 0 && (
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Profile</label>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                    value={dsProfileId}
                                    onChange={(e) => setDsProfileId(e.target.value)}
                                >
                                    {profileCategory.items.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Multiselect per non-profile category */}
                        {categories
                            .filter((c) => c.key !== 'profiles')
                            .map((cat) => {
                                const selected = selections[cat.key] ?? new Set<string>();
                                return (
                                    <div key={cat.key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                {cat.label}{' '}
                                                <span className="text-muted-foreground/60">
                                                    ({selected.size}/{cat.items.length})
                                                </span>
                                            </label>
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <button
                                                    type="button"
                                                    className="text-primary hover:underline"
                                                    onClick={() => selectAll(cat.key)}
                                                >
                                                    All
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-primary hover:underline"
                                                    onClick={() => selectNone(cat.key)}
                                                >
                                                    None
                                                </button>
                                            </div>
                                        </div>
                                        {cat.items.length === 0 ? (
                                            <p className="text-xs text-muted-foreground/60 italic">
                                                No items — add some above first
                                            </p>
                                        ) : (
                                            <div className="space-y-1 max-h-32 overflow-y-auto rounded border border-border p-2">
                                                {cat.items.map((item) => (
                                                    <label
                                                        key={item.id}
                                                        className="flex items-start gap-2 cursor-pointer text-sm"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selected.has(item.id)}
                                                            onChange={() => toggleItem(cat.key, item.id)}
                                                            className="mt-0.5 accent-primary"
                                                        />
                                                        <span className="min-w-0">
                                                            <span className="block truncate font-medium text-foreground">
                                                                {item.title}
                                                            </span>
                                                            {item.subtitle && (
                                                                <span className="block truncate text-xs text-muted-foreground">
                                                                    {item.subtitle}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={!dsName.trim()}>
                            {editingItem ? 'Save' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Data Set?</DialogTitle>
                        <DialogDescription>This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ── "Me" Card — shows user avatar, name, and primary profile info ──
function MeCard({
    user,
    profile,
    avatarModalOpen,
    setAvatarModalOpen,
    updateUser,
    updateProfile,
    refreshSession,
}: {
    user: { name?: string | null; email?: string | null; image?: string | null };
    profile?: { id?: string; headline?: string; email?: string; location?: string; avatarUrl?: string } | null;
    avatarModalOpen: boolean;
    setAvatarModalOpen: (open: boolean) => void;
    updateUser: (data: Record<string, unknown>) => void;
    updateProfile: (id: string, data: Record<string, unknown>) => void;
    refreshSession?: () => void;
}) {
    // Resolve avatar: prefer profile avatarUrl (used by templates), fall back to user account image
    const avatarUrl = profile?.avatarUrl || user.image || null;
    const initials = (user.name || 'U')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <Card className="mb-6">
            <CardContent className="flex items-center gap-4 py-5">
                {/* Avatar with edit overlay */}
                <div className="group relative shrink-0">
                    <Avatar className="h-16 w-16 ring-2 ring-border">
                        <AvatarImage src={avatarUrl ?? undefined} alt={user.name || 'Avatar'} />
                        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                    </Avatar>
                    <button
                        type="button"
                        onClick={() => setAvatarModalOpen(true)}
                        className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground shadow-sm transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
                        aria-label="Edit avatar"
                    >
                        <IconPencil className="h-3 w-3" />
                    </button>
                </div>

                {/* Name, headline, contact info */}
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold leading-tight">{user.name || 'Your Name'}</h2>
                    {profile?.headline && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{profile.headline}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {(profile?.email || user.email) && <span>{profile?.email || user.email}</span>}
                        {profile?.location && <span>{profile.location}</span>}
                    </div>
                    {profile?.summary && (
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                            {profile.summary}
                        </p>
                    )}
                </div>
            </CardContent>

            {/* Avatar crop/upload modal — uploads to R2, then saves URL to both user and profile */}
            <AvatarEditModal
                open={avatarModalOpen}
                onOpenChange={setAvatarModalOpen}
                hasImage={!!avatarUrl}
                currentImageUrl={avatarUrl ?? undefined}
                onSuccess={(imageUrl: string) => {
                    // Update user account image
                    updateUser({ image: imageUrl });
                    // Note: No need to call refreshSession() here as updateUser() already updates the local session
                    // Also save to profile's avatarUrl so resume templates show it
                    if (profile?.id) {
                        updateProfile(profile.id, { avatarUrl: imageUrl });
                    }
                }}
                onRemove={() => {
                    updateUser({ image: null });
                    // Note: No need to call refreshSession() here as updateUser() already updates the local session
                    if (profile?.id) {
                        updateProfile(profile.id, { avatarUrl: null });
                    }
                }}
                onError={(msg: string) => console.error('Avatar update failed:', msg)}
            />
        </Card>
    );
}

// ── Main Page ──
export function ResumeDataPage() {
    // Current user session — for the "Me" card
    // Use skipAutoSync to prevent infinite session syncing
    const { user, updateUser, refreshSession } = useSession({ skipAutoSync: true });
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);

    // Fetch all resume entities for the current user
    const { data: profiles, isLoading: profilesLoading } = useResumeProfiles();
    const { data: workExps, isLoading: workLoading } = useResumeWorkExperiences();
    const { data: educations, isLoading: eduLoading } = useResumeEducations();
    const { data: skillSets, isLoading: skillsLoading } = useResumeSkillSets();
    const { data: projects, isLoading: projectsLoading } = useResumeProjects();
    const { data: certifications, isLoading: certsLoading } = useResumeCertifications();

    // Mutations
    const createProfile = useCreateResumeProfile();
    const updateProfile = useUpdateResumeProfile();
    const deleteProfile = useDeleteResumeProfile();

    const createWork = useCreateResumeWorkExperience();
    const updateWork = useUpdateResumeWorkExperience();
    const deleteWork = useDeleteResumeWorkExperience();

    const createEdu = useCreateResumeEducation();
    const updateEdu = useUpdateResumeEducation();
    const deleteEdu = useDeleteResumeEducation();

    const createSkill = useCreateResumeSkillSet();
    const updateSkill = useUpdateResumeSkillSet();
    const deleteSkill = useDeleteResumeSkillSet();

    const createProject = useCreateResumeProject();
    const updateProject = useUpdateResumeProject();
    const deleteProject = useDeleteResumeProject();

    const createCert = useCreateResumeCertification();
    const updateCert = useUpdateResumeCertification();
    const deleteCert = useDeleteResumeCertification();

    // Data sets
    const { data: dataSetsRaw, isLoading: dataSetsLoading } = useResumeDataSets();
    const createDataSet = useCreateResumeDataSet();
    const updateDataSet = useUpdateResumeDataSet();
    const deleteDataSet = useDeleteResumeDataSet();

    // Normalise list data (API may wrap in pagination envelope)
    const profileList = (Array.isArray(profiles) ? profiles : ((profiles as any)?.data ?? [])) as any[];
    const workList = (Array.isArray(workExps) ? workExps : ((workExps as any)?.data ?? [])) as any[];
    const eduList = (Array.isArray(educations) ? educations : ((educations as any)?.data ?? [])) as any[];
    const skillList = (Array.isArray(skillSets) ? skillSets : ((skillSets as any)?.data ?? [])) as any[];
    const projectList = (Array.isArray(projects) ? projects : ((projects as any)?.data ?? [])) as any[];
    const certList = (Array.isArray(certifications) ? certifications : ((certifications as any)?.data ?? [])) as any[];
    const dataSetList = (Array.isArray(dataSetsRaw) ? dataSetsRaw : ((dataSetsRaw as any)?.data ?? [])) as any[];

    // Build selection categories for the DataSetSection multiselect modal
    const selectionCategories: SelectionCategory[] = [
        {
            key: 'profiles',
            label: 'Profiles',
            items: profileList.map((p: any) => ({
                id: p.id,
                title: p.headline || 'Untitled Profile',
                subtitle: [p.email, p.location].filter(Boolean).join(' · '),
            })),
        },
        {
            key: 'workExperiences',
            label: 'Work Experience',
            items: workList.map((w: any) => ({
                id: w.id,
                title: w.designation || w.company,
                subtitle: w.company + (w.location ? ` · ${w.location}` : ''),
            })),
        },
        {
            key: 'educations',
            label: 'Education',
            items: eduList.map((e: any) => ({
                id: e.id,
                title: e.degree + (e.field ? ` — ${e.field}` : ''),
                subtitle: e.institution,
            })),
        },
        {
            key: 'skillSets',
            label: 'Skill Sets',
            items: skillList.map((s: any) => ({
                id: s.id,
                title: s.name,
                subtitle: deserializeArrayField(s.skills),
            })),
        },
        {
            key: 'projects',
            label: 'Projects',
            items: projectList.map((p: any) => ({
                id: p.id,
                title: p.title,
                subtitle: p.description || deserializeArrayField(p.techStack),
            })),
        },
        {
            key: 'certifications',
            label: 'Certifications',
            items: certList.map((c: any) => ({
                id: c.id,
                title: c.name,
                subtitle: c.issuer,
            })),
        },
    ];

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            {/* Page header */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Resume Data</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage your profile, experience, education, and skills. Then head to the{' '}
                        <Link
                            to="/resume-builder"
                            search={{ resumeId: undefined, dataSetId: undefined }}
                            className="text-primary underline"
                        >
                            Resume Builder
                        </Link>{' '}
                        to build your resume.
                    </p>
                </div>
                <Button asChild>
                    <Link
                        to="/resume-builder"
                        search={{ resumeId: undefined, dataSetId: undefined }}
                        className="flex items-center gap-2"
                    >
                        Open Builder
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>

            {/* ── "Me" card — avatar, name, profile summary ── */}
            {user && (
                <MeCard
                    user={user}
                    profile={profileList[0]}
                    avatarModalOpen={avatarModalOpen}
                    setAvatarModalOpen={setAvatarModalOpen}
                    updateUser={updateUser}
                    updateProfile={(id: string, data: Record<string, unknown>) =>
                        updateProfile.mutate({ id, data } as any)
                    }
                    refreshSession={refreshSession}
                />
            )}

            {/* Resume Data Sets — top-level bucket that curates the data below */}
            <DataSetSection
                dataSets={dataSetList}
                isLoading={dataSetsLoading}
                categories={selectionCategories}
                onCreate={(data) => createDataSet.mutate(data as any)}
                onUpdate={(id, data) => updateDataSet.mutate({ id, data } as any)}
                onDelete={(id) => deleteDataSet.mutate(id)}
            />

            {/* Divider linking data sets to the raw data below */}
            <div className="flex items-center gap-3 py-4 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span className="shrink-0 uppercase tracking-wider">Resume Data</span>
                <div className="h-px flex-1 bg-border" />
            </div>

            {/* Resume entity sections */}
            <div className="space-y-6">
                {/* Profile (singleton — show only first, or create) */}
                <CrudSection
                    title="Profile"
                    description="Your headline, contact info, and summary"
                    icon={<UserCircle className="h-5 w-5 text-muted-foreground" />}
                    items={profileList}
                    isLoading={profilesLoading}
                    fields={PROFILE_FIELDS}
                    renderItem={(p: any) => ({
                        title: p.headline || 'Untitled Profile',
                        subtitle: [p.email, p.location].filter(Boolean).join(' · '),
                    })}
                    onCreate={(data) => createProfile.mutate(data as any)}
                    onUpdate={(id, data) => updateProfile.mutate({ id, data } as any)}
                    onDelete={(id) => deleteProfile.mutate(id)}
                />

                {/* Work Experience */}
                <CrudSection
                    title="Work Experience"
                    description="Jobs and positions you've held"
                    icon={<Briefcase className="h-5 w-5 text-muted-foreground" />}
                    items={workList}
                    isLoading={workLoading}
                    fields={WORK_FIELDS}
                    renderItem={(w: any) => ({
                        title: w.designation || w.company,
                        subtitle: w.company + (w.location ? ` · ${w.location}` : ''),
                    })}
                    deserializeItem={(w: any) => ({
                        ...w,
                        highlights: deserializeHighlights(w.highlights),
                    })}
                    onCreate={(data) => createWork.mutate(serializeHighlights(data) as any)}
                    onUpdate={(id, data) => updateWork.mutate({ id, data: serializeHighlights(data) } as any)}
                    onDelete={(id) => deleteWork.mutate(id)}
                />

                {/* Education */}
                <CrudSection
                    title="Education"
                    description="Degrees, certifications, and courses"
                    icon={<GraduationCap className="h-5 w-5 text-muted-foreground" />}
                    items={eduList}
                    isLoading={eduLoading}
                    fields={EDUCATION_FIELDS}
                    renderItem={(e: any) => ({
                        title: e.degree + (e.field ? ` — ${e.field}` : ''),
                        subtitle: e.institution,
                    })}
                    onCreate={(data) => createEdu.mutate(data as any)}
                    onUpdate={(id, data) => updateEdu.mutate({ id, data } as any)}
                    onDelete={(id) => deleteEdu.mutate(id)}
                />

                {/* Skills */}
                <CrudSection
                    title="Skill Sets"
                    description="Group your skills by category"
                    icon={<Award className="h-5 w-5 text-muted-foreground" />}
                    items={skillList}
                    isLoading={skillsLoading}
                    fields={SKILL_FIELDS}
                    renderItem={(s: any) => ({
                        title: s.name,
                        subtitle: deserializeArrayField(s.skills),
                    })}
                    deserializeItem={(s: any) => ({
                        ...s,
                        skills: deserializeArrayField(s.skills),
                    })}
                    onCreate={(data) => createSkill.mutate(serializeHighlights(data) as any)}
                    onUpdate={(id, data) => updateSkill.mutate({ id, data: serializeHighlights(data) } as any)}
                    onDelete={(id) => deleteSkill.mutate(id)}
                />

                {/* Projects */}
                <CrudSection
                    title="Projects"
                    description="Personal or open-source projects"
                    icon={<FolderOpen className="h-5 w-5 text-muted-foreground" />}
                    items={projectList}
                    isLoading={projectsLoading}
                    fields={PROJECT_FIELDS}
                    renderItem={(p: any) => ({
                        title: p.title,
                        subtitle: p.description || deserializeArrayField(p.techStack),
                    })}
                    deserializeItem={(p: any) => ({
                        ...p,
                        techStack: deserializeArrayField(p.techStack),
                    })}
                    onCreate={(data) => createProject.mutate(serializeHighlights(data) as any)}
                    onUpdate={(id, data) => updateProject.mutate({ id, data: serializeHighlights(data) } as any)}
                    onDelete={(id) => deleteProject.mutate(id)}
                />

                {/* Certifications */}
                <CrudSection
                    title="Certifications"
                    description="Professional certifications and credentials"
                    icon={<ShieldCheck className="h-5 w-5 text-muted-foreground" />}
                    items={certList}
                    isLoading={certsLoading}
                    fields={CERTIFICATION_FIELDS}
                    renderItem={(c: any) => ({
                        title: c.name,
                        subtitle: c.issuer,
                    })}
                    onCreate={(data) => createCert.mutate(data as any)}
                    onUpdate={(id, data) => updateCert.mutate({ id, data } as any)}
                    onDelete={(id) => deleteCert.mutate(id)}
                />
            </div>
        </div>
    );
}
