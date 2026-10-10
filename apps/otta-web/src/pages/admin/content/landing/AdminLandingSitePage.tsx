// /admin/content/landing — the landing site at a glance: pick a theme (live previews),
// manage pages, and edit site-wide settings (name, navigation, footer).

import { getErrorMessage, isApiError } from '@/lib/api';
import {
    fieldErrors,
    SITE_FIELDS,
    SiteSettingsSchema,
    THEMES,
    type LandingPageData,
    type SiteSettings,
    type ThemeId,
} from '@ottabase/ottalanding';
import { LandingPreview } from '@ottabase/ottalanding/react';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
} from '@ottabase/ui-shadcn';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Check, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FieldsForm, type FieldErrors } from './FieldsForm';
import { LANDING_QUERY_KEY, landingApi, publicUrl, slugPath, useLanding, type LandingState } from './landingApi';

export function AdminLandingSitePage() {
    const { data, isLoading, error, refetch } = useLanding();

    if (isLoading) {
        return (
            <div className="space-y-8" aria-busy="true">
                <span className="sr-only">Loading landing site…</span>
                <div className="h-16 animate-pulse rounded-xl bg-muted/40" />
                <div className="grid gap-4 lg:grid-cols-3">
                    {THEMES.map((t) => (
                        <div key={t.id} className="h-72 animate-pulse rounded-xl bg-muted/40" />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="rounded-xl border border-border p-8 text-center">
                <p className="font-medium">The landing site couldn’t be loaded.</p>
                <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(error)}</p>
                <Button className="mt-4" variant="outline" onClick={() => refetch()}>
                    Try again
                </Button>
            </div>
        );
    }

    const homeUrl = publicUrl(data.site, '/');
    return (
        <div className="space-y-12">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Landing site</h1>
                    <p className="max-w-2xl text-muted-foreground">
                        Your public marketing site. Content is shared by every theme, so you can switch the look at any
                        time. Saved changes are live immediately.
                    </p>
                </div>
                {homeUrl && (
                    <Button asChild variant="outline">
                        <a href={homeUrl} target="_blank" rel="noopener noreferrer">
                            View site
                            <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                )}
            </div>

            <ThemePicker state={data} />
            <PagesSection state={data} />
            <SettingsSection site={data.site} />
        </div>
    );
}

// ── Theme ────────────────────────────────────────────────────────────────────

function ThemePicker({ state }: { state: LandingState }) {
    const queryClient = useQueryClient();
    const home = state.pages.find((p) => p.path === '/') ?? state.pages[0];
    const save = useMutation({
        mutationFn: (theme: ThemeId) => landingApi.saveSite({ ...state.site, theme }),
        onSuccess: ({ site }) => {
            queryClient.setQueryData<LandingState>(LANDING_QUERY_KEY, (old) => old && { ...old, site });
            toast.success(`Theme changed to ${THEMES.find((t) => t.id === site.theme)?.label}`);
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });
    const current = save.isPending ? save.variables : state.site.theme;

    return (
        <section className="space-y-4" aria-labelledby="landing-theme">
            <div className="space-y-1">
                <h2 id="landing-theme" className="text-lg font-semibold">
                    Theme
                </h2>
                <p className="text-sm text-muted-foreground">Previewed with your home page.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3" role="radiogroup" aria-labelledby="landing-theme">
                {THEMES.map((theme) => {
                    const selected = theme.id === current;
                    return (
                        <button
                            key={theme.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={save.isPending}
                            onClick={() => !selected && save.mutate(theme.id)}
                            className={`group overflow-hidden rounded-xl border text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:shadow-md'}`}
                        >
                            <div className="relative h-56 overflow-hidden border-b border-border bg-muted/30">
                                <LandingPreview
                                    site={{ ...state.site, theme: theme.id }}
                                    sections={home?.sections ?? []}
                                    currentPath="/"
                                />
                            </div>
                            <div className="flex items-start justify-between gap-3 p-4">
                                <div>
                                    <p className="font-semibold">{theme.label}</p>
                                    <p className="mt-0.5 text-sm text-muted-foreground">{theme.description}</p>
                                </div>
                                {selected && (
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <Check className="h-3.5 w-3.5" aria-hidden />
                                        <span className="sr-only">Current theme</span>
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

// ── Pages ────────────────────────────────────────────────────────────────────

function PagesSection({ state }: { state: LandingState }) {
    const queryClient = useQueryClient();
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<LandingPageData | null>(null);
    const remove = useMutation({
        mutationFn: (id: string) => landingApi.deletePage(id),
        onSuccess: () => {
            toast.success('Page deleted');
            queryClient.invalidateQueries({ queryKey: LANDING_QUERY_KEY });
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    return (
        <section className="space-y-4" aria-labelledby="landing-pages">
            <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                    <h2 id="landing-pages" className="text-lg font-semibold">
                        Pages
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Drafts are only visible here until you publish them.
                    </p>
                </div>
                <Button onClick={() => setCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New page
                </Button>
            </div>

            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {state.pages.map((page) => (
                    <li key={page.id} className="group flex items-center gap-2 hover:bg-muted/40">
                        <Link
                            to="/admin/content/landing/$pageId"
                            params={{ pageId: page.id }}
                            className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{page.title}</p>
                                <p className="truncate text-sm text-muted-foreground">
                                    {page.path} · {page.sections.length}{' '}
                                    {page.sections.length === 1 ? 'section' : 'sections'}
                                </p>
                            </div>
                            <Badge variant={page.published ? 'default' : 'secondary'}>
                                {page.published ? 'Published' : 'Draft'}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                        </Link>
                        {page.path !== '/' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="mr-2 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleting(page)}
                                aria-label={`Delete ${page.title}`}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </li>
                ))}
            </ul>

            <NewPageDialog open={creating} onOpenChange={setCreating} />
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title={`Delete “${deleting?.title}”?`}
                description={`${deleting?.path} will stop working. This can’t be undone.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete page"
                onConfirm={() => {
                    if (deleting) remove.mutate(deleting.id);
                    setDeleting(null);
                }}
            />
        </section>
    );
}

function NewPageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [path, setPath] = useState('');
    const [pathEdited, setPathEdited] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});

    useEffect(() => {
        if (open) {
            setTitle('');
            setPath('');
            setPathEdited(false);
            setErrors({});
        }
    }, [open]);

    const create = useMutation({
        mutationFn: () => landingApi.createPage({ title, path }),
        onSuccess: async ({ page }) => {
            await queryClient.invalidateQueries({ queryKey: LANDING_QUERY_KEY });
            onOpenChange(false);
            navigate({ to: '/admin/content/landing/$pageId', params: { pageId: page.id } });
        },
        onError: (err) =>
            isApiError(err) && err.fieldErrors ? setErrors(err.fieldErrors) : toast.error(getErrorMessage(err)),
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        create.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>New page</DialogTitle>
                        <DialogDescription>It starts as an empty draft. Add sections, then publish.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="new-page-title">Title</Label>
                        <Input
                            id="new-page-title"
                            autoFocus
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (!pathEdited) setPath(slugPath(e.target.value));
                            }}
                        />
                        {errors.title && <p className="text-sm text-destructive">{errors.title[0]}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="new-page-path">Path</Label>
                        <Input
                            id="new-page-path"
                            value={path}
                            placeholder="/pricing"
                            onChange={(e) => {
                                setPath(e.target.value);
                                setPathEdited(true);
                            }}
                        />
                        {errors.path && <p className="text-sm text-destructive">{errors.path[0]}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!title.trim() || create.isPending}>
                            {create.isPending ? 'Creating…' : 'Create page'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Site settings ────────────────────────────────────────────────────────────

function SettingsSection({ site }: { site: SiteSettings }) {
    const queryClient = useQueryClient();
    const [edits, setDraft] = useState<SiteSettings>(site);
    const [errors, setErrors] = useState<FieldErrors>({});
    // The theme belongs to the picker above: switching it must not discard edits made here.
    const draft = { ...edits, theme: site.theme };
    const dirty = JSON.stringify(draft) !== JSON.stringify(site);

    const save = useMutation({
        mutationFn: (next: SiteSettings) => landingApi.saveSite(next),
        onSuccess: ({ site: saved }) => {
            queryClient.setQueryData<LandingState>(LANDING_QUERY_KEY, (old) => old && { ...old, site: saved });
            setDraft(saved);
            setErrors({});
            toast.success('Site settings saved');
        },
        onError: (err) => {
            if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
            toast.error(getErrorMessage(err));
        },
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const parsed = SiteSettingsSchema.safeParse(draft);
        if (!parsed.success) {
            setErrors(fieldErrors(parsed.error));
            toast.error('Please fix the highlighted fields.');
            return;
        }
        save.mutate(parsed.data);
    };

    return (
        <section className="space-y-4" aria-labelledby="landing-settings">
            <div className="space-y-1">
                <h2 id="landing-settings" className="text-lg font-semibold">
                    Site settings
                </h2>
                <p className="text-sm text-muted-foreground">Name, navigation and footer, shared by every page.</p>
            </div>
            <form onSubmit={submit} className="space-y-6 rounded-xl border border-border p-5 sm:p-6">
                <FieldsForm
                    fields={SITE_FIELDS}
                    value={draft}
                    onChange={(next) => setDraft(next as SiteSettings)}
                    errors={errors}
                    omit={['theme']}
                />
                <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
                    {dirty && (
                        <Button type="button" variant="ghost" onClick={() => setDraft(site)}>
                            Discard changes
                        </Button>
                    )}
                    <Button type="submit" disabled={!dirty || save.isPending}>
                        {save.isPending ? 'Saving…' : 'Save settings'}
                    </Button>
                </div>
            </form>
        </section>
    );
}
