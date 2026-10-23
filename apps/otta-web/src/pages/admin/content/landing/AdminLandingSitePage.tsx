// /admin/content/landing — the landing site, one job per tab: Pages (what's on it), Design (how it
// looks), Navigation (how people move around it) and Settings (what it is called, where it lives,
// how it is shared). Design, Navigation and Settings edit one draft with a shared save bar.

import { getErrorMessage, isApiError } from '@/lib/api';
import {
    fieldErrors,
    SITE_FIELDS,
    SiteSettingsSchema,
    themeAccent,
    THEMES,
    type LandingPageData,
    type SiteSettings,
    type ThemeId,
} from '@ottabase/ottalanding';
import { LandingPreview } from '@ottabase/ottalanding/react';
import {
    Badge,
    Button,
    ConfirmDialog,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Check, ExternalLink, Inbox, Plus, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FieldsForm, type FieldErrors } from './FieldsForm';
import { ShareCardEditor } from './ShareCardEditor';
import { withSiteShareImage } from './shareImage';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import {
    LANDING_QUERY_KEY,
    landingApi,
    publicUrl,
    slugPath,
    useLanding,
    useLeads,
    type LandingState,
} from './landingApi';

/** The host of a stored address, or the address itself if it doesn't parse (a header must never throw). */
function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

const TABS = ['pages', 'design', 'navigation', 'settings'] as const;
type Tab = (typeof TABS)[number];

/** Which tab edits which setting, so a validation error can bring its field into view. */
const TAB_OF: Record<string, Tab> = {
    logoUrl: 'design',
    faviconUrl: 'design',
    logoIncludesName: 'design',
    brandColor: 'design',
    nav: 'navigation',
    navCtaLabel: 'navigation',
    navCtaHref: 'navigation',
    footerLinks: 'navigation',
    footerNote: 'navigation',
};

export function AdminLandingSitePage() {
    const { data, isLoading, error, refetch } = useLanding();

    if (isLoading) {
        return (
            <div className="space-y-6" aria-busy="true">
                <span className="sr-only">Loading landing site…</span>
                <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
                <div className="h-10 w-96 max-w-full animate-pulse rounded-lg bg-muted/40" />
                <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
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

    return <SiteAdmin state={data} />;
}

function SiteAdmin({ state }: { state: LandingState }) {
    const navigate = useNavigate();
    const [tab, setTab] = useState<Tab>(() => TABS.find((t) => `#${t}` === window.location.hash) ?? 'pages');
    const settings = useSettingsDraft(state.site, (t) => changeTab(t));
    const homeUrl = publicUrl(state.site, '/');

    function changeTab(next: Tab) {
        setTab(next);
        // In the address too, so a reload (or a shared link) opens the same tab.
        navigate({ to: '/admin/content/landing', hash: next, replace: true });
    }

    return (
        <div className="space-y-6">
            <UnsavedChangesGuard when={settings.dirty} />
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <h1 className="text-2xl font-semibold tracking-[-0.015em]">Landing site</h1>
                    {homeUrl ? (
                        <a
                            href={homeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                            {hostOf(homeUrl)}
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Your public marketing site.{' '}
                            <button
                                type="button"
                                onClick={() => changeTab('settings')}
                                className="font-medium text-foreground underline underline-offset-4"
                            >
                                Add its address
                            </button>{' '}
                            to get “View” links and previews.
                        </p>
                    )}
                </div>
                <InboxButton />
            </div>

            <Tabs value={tab} onValueChange={(v) => changeTab(v as Tab)}>
                <TabsList className="max-w-full justify-start overflow-x-auto">
                    <TabsTrigger value="pages">Pages</TabsTrigger>
                    <TabsTrigger value="design">Design</TabsTrigger>
                    <TabsTrigger value="navigation">Navigation</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="pages" className="mt-6">
                    <PagesTab state={state} />
                </TabsContent>

                <TabsContent value="design" className="mt-6">
                    {/* Previews render whole pages (with their own forms), so they stay outside the settings form. */}
                    <div className="space-y-10">
                        <ThemePicker state={state} draft={settings.draft} />
                        <form onSubmit={settings.submit}>
                            <Panel
                                title="Brand"
                                description="Your logo, browser-tab icon and accent color, in every theme."
                            >
                                {settings.fields(['logoUrl', 'faviconUrl', 'logoIncludesName', 'brandColor'], {
                                    brandColor: themeAccent(state.site.theme),
                                })}
                            </Panel>
                        </form>
                    </div>
                </TabsContent>

                <TabsContent value="navigation" className="mt-6">
                    {/* A whole page scaled to fit: too small to read on a phone, so it is left out there. */}
                    <div className="mb-10 hidden space-y-2 sm:block">
                        <p className="text-sm text-muted-foreground">
                            How the header and footer look with these links
                            {settings.dirty ? ', including unsaved changes' : ''}.
                        </p>
                        <div className="max-h-80 overflow-y-auto rounded-xl border border-border shadow-sm" aria-hidden>
                            <LandingPreview site={settings.draft} sections={[]} currentPath="/" />
                        </div>
                    </div>
                    <form onSubmit={settings.submit} className="space-y-10">
                        <Panel
                            title="Header"
                            description="The links across the top of every page, and one button for your main action."
                        >
                            {settings.fields(['nav', 'navCtaLabel', 'navCtaHref'])}
                        </Panel>
                        <Panel
                            title="Footer"
                            description="Secondary links and a short note at the bottom of every page."
                        >
                            {settings.fields(['footerLinks', 'footerNote'])}
                        </Panel>
                    </form>
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                    <form onSubmit={settings.submit} className="space-y-10">
                        <Panel
                            title="General"
                            description="The site’s name and one-line description, and the address it is served at."
                        >
                            {settings.fields(['name', 'tagline', 'siteUrl'])}
                        </Panel>
                        <Panel
                            title="Social image"
                            description="The picture shown when any page without its own is shared on X, LinkedIn, Slack or in messages."
                        >
                            <ShareCardEditor
                                value={settings.draft.share}
                                onChange={(share) => settings.setDraft({ ...settings.draft, share })}
                                site={settings.draft}
                                defaults={{ heading: settings.draft.name, subtext: settings.draft.tagline }}
                                errors={settings.errors}
                                path="share."
                                layout="split"
                            />
                        </Panel>
                        <Panel
                            title="Form notifications"
                            description="Where to send new messages and signups from your contact and signup sections."
                        >
                            {settings.fields(['leadEmail'])}
                        </Panel>
                    </form>
                </TabsContent>
            </Tabs>

            {settings.dirty && (
                <div
                    role="region"
                    aria-label="Unsaved changes"
                    className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm"
                >
                    <p className="text-sm">
                        <span className="font-medium">Unsaved changes</span>
                        <span className="text-muted-foreground"> to the site settings</span>
                    </p>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={settings.discard}>
                            Discard
                        </Button>
                        <Button type="button" onClick={() => settings.submit()} disabled={settings.saving}>
                            {settings.saving ? 'Saving…' : 'Save changes'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** A titled group of settings: what it is on the left, the controls on the right. */
function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    const id = `panel-${title.toLowerCase().replace(/\W+/g, '-')}`;
    return (
        <section
            aria-labelledby={id}
            className="grid gap-4 border-t border-border pt-8 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10"
        >
            <div className="space-y-1">
                <h2 id={id} className="font-semibold">
                    {title}
                </h2>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="min-w-0">{children}</div>
        </section>
    );
}

/**
 * The site-settings draft the Design, Navigation and Settings tabs share: edits survive switching
 * tabs, one save writes them all, and an invalid field takes you to its tab.
 */
function useSettingsDraft(site: SiteSettings, showTab: (tab: Tab) => void) {
    const queryClient = useQueryClient();
    const [edits, setDraft] = useState<SiteSettings>(site);
    const [errors, setErrors] = useState<FieldErrors>({});
    // The theme belongs to the theme picker, which saves at once: switching it keeps these edits.
    const draft = useMemo(() => ({ ...edits, theme: site.theme }), [edits, site.theme]);
    // The saved side only changes on save: serialise it once, not on every keystroke.
    const savedJson = useMemo(() => JSON.stringify(site), [site]);
    const dirty = JSON.stringify(draft) !== savedJson;

    const showErrors = (next: FieldErrors) => {
        setErrors(next);
        const first = Object.keys(next)[0]?.split('.')[0];
        showTab(first ? (TAB_OF[first] ?? 'settings') : 'settings');
    };

    const save = useMutation({
        mutationFn: async (next: SiteSettings) => {
            const { site: withImage, warning } = await withSiteShareImage(next);
            return { ...(await landingApi.saveSite(withImage)), warning };
        },
        onSuccess: ({ site: saved, warning }) => {
            queryClient.setQueryData<LandingState>(LANDING_QUERY_KEY, (old) => old && { ...old, site: saved });
            setDraft(saved);
            setErrors({});
            toast.success('Site settings saved');
            if (warning) toast.warning(warning);
        },
        onError: (err) => {
            if (isApiError(err) && err.fieldErrors) showErrors(err.fieldErrors);
            toast.error(getErrorMessage(err));
        },
    });

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        if (!dirty) return;
        const parsed = SiteSettingsSchema.safeParse(draft);
        if (!parsed.success) {
            showErrors(fieldErrors(parsed.error));
            toast.error('Please fix the highlighted fields.');
            return;
        }
        save.mutate(parsed.data);
    };

    /** The settings form, limited to some fields; shares this draft and its errors. (A render
     *  function, not a component: a component made here would remount its inputs on every keystroke.) */
    const fields = (only: string[], placeholders?: Record<string, string>) => (
        <FieldsForm
            fields={SITE_FIELDS}
            value={draft}
            onChange={(next) => setDraft(next as SiteSettings)}
            errors={errors}
            only={only}
            placeholders={placeholders}
        />
    );

    return {
        draft,
        setDraft,
        errors,
        dirty,
        saving: save.isPending,
        submit,
        discard: () => (setDraft(site), setErrors({})),
        fields,
    };
}

/** The way into the form-entries inbox, with how many are new. */
function InboxButton() {
    const unread = useLeads().data?.pages[0]?.unread ?? 0;
    return (
        <Button asChild variant="outline">
            <Link to="/admin/content/landing/leads">
                <Inbox className="mr-2 h-4 w-4" aria-hidden />
                Form entries
                {unread > 0 && (
                    <Badge className="ml-2" aria-label={`${unread} new`}>
                        {unread}
                    </Badge>
                )}
            </Link>
        </Button>
    );
}

// ── Design: theme ────────────────────────────────────────────────────────────

function ThemePicker({ state, draft: liveDraft }: { state: LandingState; draft: SiteSettings }) {
    // Three whole-page previews: let them trail the typing rather than block it.
    const draft = useDeferredValue(liveDraft);
    const queryClient = useQueryClient();
    const home = state.pages.find((p) => p.path === '/') ?? state.pages[0];
    const save = useMutation({
        // The social image is drawn in the theme's fonts, so it is re-rendered with the switch.
        mutationFn: async (theme: ThemeId) => {
            const { site, warning } = await withSiteShareImage({ ...state.site, theme });
            return { ...(await landingApi.saveSite(site)), warning };
        },
        onSuccess: ({ site, warning }) => {
            queryClient.setQueryData<LandingState>(LANDING_QUERY_KEY, (old) => old && { ...old, site });
            toast.success(`Theme changed to ${THEMES.find((t) => t.id === site.theme)?.label}`);
            if (warning) toast.warning(warning);
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });
    const current = save.isPending ? save.variables : state.site.theme;

    return (
        <section className="space-y-4" aria-labelledby="landing-theme">
            <div className="space-y-1">
                <h2 id="landing-theme" className="font-semibold">
                    Theme
                </h2>
                <p className="text-sm text-muted-foreground">
                    Applies as soon as you pick it. Previewed with your home page and brand.
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3" role="radiogroup" aria-labelledby="landing-theme">
                {THEMES.map((theme) => {
                    const selected = theme.id === current;
                    return (
                        // The preview is a whole page (links, buttons), so it can't live inside the
                        // radio button; the button covers the card from above instead.
                        <div
                            key={theme.id}
                            className={`relative overflow-hidden rounded-xl border transition-shadow focus-within:ring-2 focus-within:ring-ring ${selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:shadow-md'}`}
                        >
                            <div
                                className="relative h-44 overflow-hidden border-b border-border bg-muted/30"
                                aria-hidden
                            >
                                <LandingPreview
                                    site={{ ...draft, theme: theme.id }}
                                    sections={home?.sections ?? []}
                                    currentPath="/"
                                />
                            </div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="font-medium">{theme.label}</p>
                                    <p id={`theme-${theme.id}-desc`} className="text-sm text-muted-foreground">
                                        {theme.description}
                                    </p>
                                </div>
                                {selected && (
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <Check className="h-3.5 w-3.5" aria-hidden />
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={theme.label}
                                aria-describedby={`theme-${theme.id}-desc`}
                                disabled={save.isPending}
                                onClick={() => !selected && save.mutate(theme.id)}
                                className="absolute inset-0 focus-visible:outline-hidden"
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// ── Pages ────────────────────────────────────────────────────────────────────

const edited = (iso?: string) =>
    iso ? `Edited ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '';

function PagesTab({ state }: { state: LandingState }) {
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
        <section className="space-y-4" aria-label="Pages">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    Drafts are only visible here, or through a preview link, until you publish them.
                </p>
                <Button onClick={() => setCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New page
                </Button>
            </div>

            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {state.pages.map((page) => {
                    const live = page.published ? publicUrl(state.site, page.path) : undefined;
                    return (
                        <li key={page.id} className="flex items-center gap-1 pr-2 hover:bg-muted/40">
                            <Link
                                to="/admin/content/landing/$pageId"
                                params={{ pageId: page.id }}
                                className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{page.title}</p>
                                    <p className="truncate text-sm text-muted-foreground">
                                        {page.path}
                                        <span aria-hidden> · </span>
                                        {page.sections.length} {page.sections.length === 1 ? 'section' : 'sections'}
                                        {page.updatedAt && (
                                            <>
                                                <span aria-hidden> · </span>
                                                {edited(page.updatedAt)}
                                            </>
                                        )}
                                    </p>
                                </div>
                                <Badge variant={page.published ? 'default' : 'secondary'}>
                                    {page.published ? 'Published' : 'Draft'}
                                </Badge>
                            </Link>
                            {/* Empty slots keep the status badges in one column whichever actions a row has. */}
                            {!live && <span className="h-10 w-10 shrink-0" aria-hidden />}
                            {live && (
                                <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
                                    <a
                                        href={live}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`View ${page.title} on the site`}
                                        title="View on the site"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                            )}
                            {page.path !== '/' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleting(page)}
                                    aria-label={`Delete ${page.title}`}
                                    title="Delete page"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            {page.path === '/' && <span className="h-10 w-10 shrink-0" aria-hidden />}
                        </li>
                    );
                })}
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
