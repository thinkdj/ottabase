// /admin/content/landing/$pageId — edit one page. Its sections are the work, so they own the
// main column beside a live preview; the page's title, path, description and social image live
// in a "Page settings" sheet. Publishing is an explicit action, not a switch that waits for Save.

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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    Switch,
    Textarea,
} from '@ottabase/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ExternalLink, Plus, Settings2, Trash2 } from 'lucide-react';
import { useDeferredValue, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FieldsForm, type FieldErrors } from './FieldsForm';
import { PreviewLinkDialog } from './PreviewLinkDialog';
import { ShareCardEditor } from './ShareCardEditor';
import { withPageShareImage } from './shareImage';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import { LANDING_QUERY_KEY, landingApi, publicUrl, useLanding, type LandingState, type PageDraft } from './landingApi';

const toDraft = ({ id: _id, updatedAt: _u, ...draft }: LandingPageData): PageDraft => draft;

/** Fields edited in the Page settings sheet: an error in one of them opens it. */
const SETTINGS_ERROR = /^(title|path|description|share)(\.|$)/;

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
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [previewScheme, setPreviewScheme] = useState<ColorScheme>(() => getTheme(state.site.theme).scheme);
    // A page can hold ~512 KB of sections: serialise the saved side once, not on every keystroke.
    const savedJson = useMemo(() => JSON.stringify(saved), [saved]);
    const dirty = JSON.stringify(draft) !== savedJson;
    // The preview is a whole page: let it trail the typing rather than block it.
    const previewSections = useDeferredValue(draft.sections);
    const liveUrl = page.published ? publicUrl(state.site, page.path) : undefined;

    const save = useMutation({
        mutationFn: async (next: PageDraft) => {
            const { page: withImage, warning } = await withPageShareImage(page.id, next, state.site);
            return { ...(await landingApi.savePage(page.id, withImage)), warning };
        },
        onSuccess: ({ page: updated, warning }) => {
            queryClient.setQueryData<LandingState>(
                LANDING_QUERY_KEY,
                (old) => old && { ...old, pages: old.pages.map((p) => (p.id === updated.id ? updated : p)) },
            );
            // Adopt the server's normalised copy (trimmed text, schema key order) so the page is clean again.
            setDraft(toDraft(updated));
            setErrors({});
            toast.success(
                updated.published === page.published
                    ? updated.published
                        ? 'Page saved'
                        : 'Draft saved'
                    : updated.published
                      ? 'Page published'
                      : 'Page unpublished',
            );
            if (warning) toast.warning(warning);
        },
        onError: (err) => {
            if (isApiError(err) && err.fieldErrors) showErrors(err.fieldErrors);
            toast.error(getErrorMessage(err));
        },
    });

    const showErrors = (next: FieldErrors) => {
        setErrors(next);
        // Bring every problem into view: open the sections that have one, and the settings sheet.
        const withErrors = Object.keys(next).flatMap((k) => /^sections\.(\d+)\./.exec(k)?.[1] ?? []);
        setOpen((prev) => new Set([...prev, ...withErrors.map((i) => draft.sections[Number(i)]?.id).filter(Boolean)]));
        if (Object.keys(next).some((k) => SETTINGS_ERROR.test(k))) setSettingsOpen(true);
    };

    /** Save the page; `published` publishes or unpublishes it in the same step. */
    const submit = (published = draft.published) => {
        const parsed = PageInputSchema.safeParse({ ...draft, published });
        if (!parsed.success) {
            showErrors(fieldErrors(parsed.error));
            toast.error('Please fix the highlighted fields.');
            return;
        }
        save.mutate(parsed.data as PageDraft);
    };
    const onFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (dirty) submit();
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
    const settingsErrors = Object.keys(errors).some((k) => SETTINGS_ERROR.test(k));

    return (
        <div className="space-y-6">
            <UnsavedChangesGuard when={dirty} />
            {/* Header: what this page is, and what you can do with it */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <Link
                        to="/admin/content/landing"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                        Landing site
                    </Link>
                    <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold tracking-tight">
                        <span className="min-w-0 truncate">{draft.title || 'Untitled page'}</span>
                        <Badge variant={page.published ? 'default' : 'secondary'}>
                            {page.published ? 'Published' : 'Draft'}
                        </Badge>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {liveUrl ? (
                            <a
                                href={liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                                {page.path === '/' ? 'Home page' : page.path}
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                <span className="sr-only">(opens the live page)</span>
                            </a>
                        ) : page.path === '/' ? (
                            'Home page'
                        ) : (
                            page.path
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
                        <Settings2 className="mr-2 h-4 w-4" aria-hidden />
                        Page settings
                        {settingsErrors && (
                            <>
                                <span className="ml-2 h-2 w-2 rounded-full bg-destructive" aria-hidden />
                                <span className="sr-only">(has errors)</span>
                            </>
                        )}
                    </Button>
                    {/* Published pages are public already; a draft gets a private preview link. */}
                    {!page.published && <PreviewLinkDialog site={state.site} pageId={page.id} path={page.path} />}
                    {dirty && (
                        <Button type="button" variant="ghost" onClick={() => (setDraft(saved), setErrors({}))}>
                            Discard
                        </Button>
                    )}
                    {page.published ? (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={save.isPending}
                                onClick={() => submit(false)}
                            >
                                Unpublish
                            </Button>
                            <Button type="button" disabled={!dirty || save.isPending} onClick={() => submit()}>
                                {save.isPending ? 'Saving…' : 'Save'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!dirty || save.isPending}
                                onClick={() => submit(false)}
                            >
                                Save draft
                            </Button>
                            <Button type="button" disabled={save.isPending} onClick={() => submit(true)}>
                                {save.isPending ? 'Saving…' : 'Publish'}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
                {/* Editing column — its own form, so the preview's forms are never nested inside it */}
                <form onSubmit={onFormSubmit} className="space-y-3" aria-labelledby="page-sections">
                    <div className="flex items-center justify-between">
                        <h2 id="page-sections" className="font-semibold">
                            Sections <span className="font-normal text-muted-foreground">{draft.sections.length}</span>
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
                            <Button type="button" className="mt-4" variant="outline" onClick={() => addSection('hero')}>
                                Add a hero
                            </Button>
                        </div>
                    )}
                    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                        {draft.sections.map((section, i) => {
                            const prefix = `sections.${i}.`;
                            const hasErrors = Object.keys(errors).some((k) => k.startsWith(prefix));
                            const expanded = open.has(section.id);
                            const def = SECTIONS[section.type];
                            const data = section.data as Record<string, unknown>;
                            const summary = (data.title as string) || def.description;
                            return (
                                <div key={section.id} className={hasErrors ? 'bg-destructive/5' : 'bg-background'}>
                                    <div className="flex items-center gap-1 py-1.5 pl-3 pr-1.5">
                                        <button
                                            type="button"
                                            onClick={() => toggle(section.id)}
                                            aria-expanded={expanded}
                                            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1.5 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <ChevronRight
                                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
                                                aria-hidden
                                            />
                                            <span className="shrink-0 text-sm font-medium">{def.label}</span>
                                            <span className="truncate text-sm text-muted-foreground">{summary}</span>
                                            {hasErrors && (
                                                <span className="shrink-0 text-xs text-destructive">
                                                    Needs attention
                                                </span>
                                            )}
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
                                                // Copy is what gets edited here: one column, so headlines aren't cut off.
                                                columns={1}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </form>

                {/* Live preview */}
                <aside className="space-y-2 xl:sticky xl:top-4" aria-label="Preview">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            Preview in the {getTheme(state.site.theme).label} theme
                            {dirty ? ', including unsaved changes' : ''}.
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
                                    className={`rounded px-2.5 py-1 text-xs font-medium capitalize focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${previewScheme === scheme ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {scheme}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border shadow-sm">
                        <LandingPreview
                            site={state.site}
                            sections={previewSections}
                            currentPath={draft.path}
                            title={draft.title}
                            scheme={previewScheme}
                        />
                    </div>
                </aside>
            </div>

            <PageSettingsSheet
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                draft={draft}
                setDraft={setDraft}
                errors={errors}
                isHome={page.path === '/'}
                state={state}
            />
        </div>
    );
}

/** Title, path, description and social image: set once, changed rarely, saved with the page. */
function PageSettingsSheet(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draft: PageDraft;
    setDraft: React.Dispatch<React.SetStateAction<PageDraft>>;
    errors: FieldErrors;
    isHome: boolean;
    state: LandingState;
}) {
    const { draft, setDraft, errors, isHome, state } = props;
    return (
        <Sheet open={props.open} onOpenChange={props.onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        props.onOpenChange(false);
                    }}
                    className="space-y-8"
                >
                    <SheetHeader>
                        <SheetTitle>Page settings</SheetTitle>
                        <SheetDescription>Saved with the page.</SheetDescription>
                    </SheetHeader>

                    <div className="space-y-5">
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
                                rows={3}
                                value={draft.description}
                                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                                One or two sentences for search engines and link previews.
                            </p>
                        </div>
                    </div>

                    <section className="space-y-4 border-t border-border pt-6" aria-labelledby="page-share-title">
                        <h3 id="page-share-title" className="font-semibold">
                            Social image
                        </h3>
                        <div className="flex items-start gap-3">
                            <Switch
                                id="page-share"
                                checked={Boolean(draft.share)}
                                // A new card starts from the site's look, with this page's title.
                                onCheckedChange={(on) =>
                                    setDraft((d) => ({
                                        ...d,
                                        share: on
                                            ? {
                                                  color: state.site.share?.color,
                                                  backgroundUrl: state.site.share?.backgroundUrl,
                                              }
                                            : undefined,
                                    }))
                                }
                            />
                            <div className="space-y-0.5">
                                <Label htmlFor="page-share">Use a custom image for this page</Label>
                                <p className="text-xs text-muted-foreground">
                                    {draft.share
                                        ? 'Shows this page’s title and description unless you write something else.'
                                        : 'Link previews of this page use the site’s social image.'}
                                </p>
                            </div>
                        </div>
                        {draft.share ? (
                            <ShareCardEditor
                                value={draft.share}
                                onChange={(share) => setDraft((d) => ({ ...d, share }))}
                                site={state.site}
                                defaults={{ heading: draft.title, subtext: draft.description }}
                                errors={errors}
                                path="share."
                            />
                        ) : state.site.share?.imageUrl ? (
                            <img
                                src={state.site.share.imageUrl}
                                alt="The site’s social image"
                                className="aspect-[1200/630] w-full max-w-sm rounded-md border border-border"
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                The site’s social image is created the next time you save the site settings.
                            </p>
                        )}
                    </section>

                    <SheetFooter>
                        <Button type="submit">Done</Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
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
            title={props.label}
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
