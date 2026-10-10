// /admin/content/landing/$pageId — edit one page: details, sections (add, reorder, edit,
// remove) and publish state, with a live preview of the draft in the site's theme.

import { getErrorMessage, isApiError } from '@/lib/api';
import {
    fieldErrors,
    getTheme,
    newSection,
    PageInputSchema,
    SECTION_TYPES,
    SECTIONS,
    type ColorScheme,
    type LandingPageData,
    type Section,
    type SectionType,
} from '@ottabase/ottalanding';
import { LandingPreview } from '@ottabase/ottalanding/react';
import {
    Badge,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
    Label,
    Switch,
    Textarea,
} from '@ottabase/ui-shadcn';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FieldsForm, type FieldErrors } from './FieldsForm';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import { LANDING_QUERY_KEY, landingApi, publicUrl, useLanding, type LandingState, type PageDraft } from './landingApi';

const toDraft = ({ id: _id, updatedAt: _u, ...draft }: LandingPageData): PageDraft => draft;

export function AdminLandingPageEditorPage() {
    const { pageId } = useParams({ strict: false }) as { pageId: string };
    const { data, isLoading, error } = useLanding();
    const page = data?.pages.find((p) => p.id === pageId);

    if (isLoading) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />;
    if (error || !data || !page) {
        return (
            <div className="rounded-xl border border-border p-8 text-center">
                <p className="font-medium">{error ? 'The page couldn’t be loaded.' : 'This page doesn’t exist.'}</p>
                {error && <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(error)}</p>}
                <Button asChild className="mt-4" variant="outline">
                    <Link to="/admin/content/landing">Back to the landing site</Link>
                </Button>
            </div>
        );
    }
    return <Editor key={page.id} state={data} page={page} />;
}

function Editor({ state, page }: { state: LandingState; page: LandingPageData }) {
    const queryClient = useQueryClient();
    const saved = useMemo(() => toDraft(page), [page]);
    const [draft, setDraft] = useState<PageDraft>(saved);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [open, setOpen] = useState<Set<string>>(() => new Set());
    const [previewScheme, setPreviewScheme] = useState<ColorScheme>(() => getTheme(state.site.theme).scheme);
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    const isHome = page.path === '/';
    const liveUrl = page.published ? publicUrl(state.site, page.path) : undefined;

    const save = useMutation({
        mutationFn: (next: PageDraft) => landingApi.savePage(page.id, next),
        onSuccess: ({ page: updated }) => {
            queryClient.setQueryData<LandingState>(
                LANDING_QUERY_KEY,
                (old) => old && { ...old, pages: old.pages.map((p) => (p.id === updated.id ? updated : p)) },
            );
            // Adopt the server's normalised copy (trimmed text, schema key order) so the page is clean again.
            setDraft(toDraft(updated));
            setErrors({});
            toast.success(updated.published && !page.published ? 'Page published' : 'Page saved');
        },
        onError: (err) => {
            if (isApiError(err) && err.fieldErrors) showErrors(err.fieldErrors);
            toast.error(getErrorMessage(err));
        },
    });

    const showErrors = (next: FieldErrors) => {
        setErrors(next);
        // Open every section that has a problem so it can be seen.
        const withErrors = Object.keys(next).flatMap((k) => /^sections\.(\d+)\./.exec(k)?.[1] ?? []);
        setOpen((prev) => new Set([...prev, ...withErrors.map((i) => draft.sections[Number(i)]?.id).filter(Boolean)]));
    };

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        const parsed = PageInputSchema.safeParse(draft);
        if (!parsed.success) {
            showErrors(fieldErrors(parsed.error));
            toast.error('Please fix the highlighted fields.');
            return;
        }
        save.mutate(parsed.data as PageDraft);
    };

    const setSections = (sections: Section[]) => setDraft((d) => ({ ...d, sections }));
    const addSection = (type: SectionType) => {
        const section = newSection(type);
        setSections([...draft.sections, section]);
        setOpen((prev) => new Set(prev).add(section.id));
    };
    const moveSection = (from: number, to: number) => {
        const next = [...draft.sections];
        const [s] = next.splice(from, 1);
        next.splice(to, 0, s);
        setSections(next);
    };
    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    return (
        <form onSubmit={submit} className="space-y-6">
            <UnsavedChangesGuard when={dirty} />
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <Link
                        to="/admin/content/landing"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                        Landing site
                    </Link>
                    <h1 className="flex items-center gap-3 truncate text-2xl font-bold tracking-tight">
                        {draft.title || 'Untitled page'}
                        <Badge variant={page.published ? 'default' : 'secondary'}>
                            {page.published ? 'Published' : 'Draft'}
                        </Badge>
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="page-published"
                            checked={draft.published}
                            onCheckedChange={(published) => setDraft((d) => ({ ...d, published }))}
                        />
                        <Label htmlFor="page-published">Published</Label>
                    </div>
                    {liveUrl && (
                        <Button asChild variant="outline">
                            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                                View
                                <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                    )}
                    {dirty && (
                        <Button type="button" variant="ghost" onClick={() => (setDraft(saved), setErrors({}))}>
                            Discard
                        </Button>
                    )}
                    <Button type="submit" disabled={!dirty || save.isPending}>
                        {save.isPending ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
                {/* Editing column */}
                <div className="space-y-6">
                    <fieldset className="space-y-4 rounded-xl border border-border p-5">
                        <legend className="px-1 text-sm font-semibold">Page details</legend>
                        <TextField
                            id="page-title"
                            label="Title"
                            help="Shown in the browser tab and search results."
                            value={draft.title}
                            onChange={(title) => setDraft((d) => ({ ...d, title }))}
                            error={errors.title?.[0]}
                        />
                        <TextField
                            id="page-path"
                            label="Path"
                            help={
                                isHome
                                    ? 'The home page always lives at /.'
                                    : 'Lowercase words and dashes, e.g. /pricing.'
                            }
                            value={draft.path}
                            disabled={isHome}
                            onChange={(path) => setDraft((d) => ({ ...d, path }))}
                            error={errors.path?.[0]}
                        />
                        <div className="space-y-1.5">
                            <Label htmlFor="page-description">Description</Label>
                            <Textarea
                                id="page-description"
                                rows={2}
                                value={draft.description}
                                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                                One or two sentences for search engines and link previews.
                            </p>
                        </div>
                    </fieldset>

                    <section className="space-y-3" aria-labelledby="page-sections">
                        <div className="flex items-center justify-between">
                            <h2 id="page-sections" className="text-sm font-semibold">
                                Sections
                            </h2>
                            <AddSectionMenu onAdd={addSection} />
                        </div>
                        {/* Page-level problems (e.g. too much content) that belong to no single field */}
                        {errors.sections?.[0] && (
                            <p
                                role="alert"
                                className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                            >
                                {errors.sections[0]}
                            </p>
                        )}
                        {draft.sections.length === 0 && (
                            <div className="rounded-xl border border-dashed border-border p-8 text-center">
                                <p className="font-medium">This page is empty</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Most pages start with a hero, then build toward a call to action.
                                </p>
                                <Button
                                    type="button"
                                    className="mt-4"
                                    variant="outline"
                                    onClick={() => addSection('hero')}
                                >
                                    Add a hero
                                </Button>
                            </div>
                        )}
                        {draft.sections.map((section, i) => {
                            const prefix = `sections.${i}.`;
                            const hasErrors = Object.keys(errors).some((k) => k.startsWith(prefix));
                            const expanded = open.has(section.id);
                            const def = SECTIONS[section.type];
                            const data = section.data as Record<string, unknown>;
                            const summary = (data.title as string) || (data.question as string) || def.description;
                            return (
                                <div
                                    key={section.id}
                                    className={`rounded-xl border bg-background ${hasErrors ? 'border-destructive' : 'border-border'}`}
                                >
                                    <div className="flex items-center gap-1 p-2 pl-4">
                                        <button
                                            type="button"
                                            onClick={() => toggle(section.id)}
                                            aria-expanded={expanded}
                                            className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <ChevronDown
                                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? '' : '-rotate-90'}`}
                                                aria-hidden
                                            />
                                            <span className="shrink-0 font-medium">{def.label}</span>
                                            <span className="truncate text-sm text-muted-foreground">{summary}</span>
                                            {hasErrors && <span className="sr-only">(has errors)</span>}
                                        </button>
                                        <IconButton
                                            label="Move up"
                                            disabled={i === 0}
                                            onClick={() => moveSection(i, i - 1)}
                                        >
                                            <ArrowUp className="h-4 w-4" />
                                        </IconButton>
                                        <IconButton
                                            label="Move down"
                                            disabled={i === draft.sections.length - 1}
                                            onClick={() => moveSection(i, i + 1)}
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </IconButton>
                                        <IconButton
                                            label={`Remove ${def.label.toLowerCase()} section`}
                                            destructive
                                            onClick={() =>
                                                setSections(draft.sections.filter((s) => s.id !== section.id))
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </IconButton>
                                    </div>
                                    {expanded && (
                                        <div className="border-t border-border p-4">
                                            <FieldsForm
                                                fields={def.fields}
                                                value={data}
                                                onChange={(next) =>
                                                    setSections(
                                                        draft.sections.map((s) =>
                                                            s.id === section.id ? ({ ...s, data: next } as Section) : s,
                                                        ),
                                                    )
                                                }
                                                errors={errors}
                                                path={`${prefix}data.`}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </section>
                </div>

                {/* Live preview */}
                <aside className="space-y-2 xl:sticky xl:top-4" aria-label="Preview">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            Preview in the {state.site.theme} theme{dirty ? ', including unsaved changes' : ''}.
                        </p>
                        <div
                            role="radiogroup"
                            aria-label="Preview color scheme"
                            className="flex rounded-md border border-border p-0.5"
                        >
                            {(['light', 'dark'] as const).map((scheme) => (
                                <button
                                    key={scheme}
                                    type="button"
                                    role="radio"
                                    aria-checked={previewScheme === scheme}
                                    onClick={() => setPreviewScheme(scheme)}
                                    className={`rounded px-2.5 py-1 text-xs font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${previewScheme === scheme ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {scheme}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border shadow-sm">
                        <LandingPreview
                            site={state.site}
                            sections={draft.sections}
                            currentPath={draft.path}
                            title={draft.title}
                            scheme={previewScheme}
                        />
                    </div>
                </aside>
            </div>
        </form>
    );
}

function TextField(props: {
    id: string;
    label: string;
    help: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={props.id}>{props.label}</Label>
            <Input
                id={props.id}
                value={props.value}
                disabled={props.disabled}
                aria-invalid={props.error ? true : undefined}
                onChange={(e) => props.onChange(e.target.value)}
            />
            <p className={`text-xs ${props.error ? 'text-destructive' : 'text-muted-foreground'}`}>
                {props.error ?? props.help}
            </p>
        </div>
    );
}

function IconButton(props: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    destructive?: boolean;
    children: React.ReactNode;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-muted-foreground ${props.destructive ? 'hover:text-destructive' : ''}`}
            disabled={props.disabled}
            onClick={props.onClick}
            aria-label={props.label}
        >
            {props.children}
        </Button>
    );
}

function AddSectionMenu({ onAdd }: { onAdd: (type: SectionType) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add section
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                {SECTION_TYPES.map((type) => (
                    <DropdownMenuItem
                        key={type}
                        onSelect={() => onAdd(type)}
                        className="flex-col items-start gap-0.5 py-2"
                    >
                        <span className="font-medium">{SECTIONS[type].label}</span>
                        <span className="text-xs text-muted-foreground">{SECTIONS[type].description}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
