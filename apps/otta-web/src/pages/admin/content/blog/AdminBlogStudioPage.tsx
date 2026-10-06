/**
 * Admin Content studio page
 *
 * Manage content themes and plugins, and run the one-time demo content seed.
 */
import { isPlatformAdmin, useSession } from '@/lib/auth';
import type { BlogLanguageConfig, StudioPluginState, StudioThemeState } from '@ottabase/ottablog';
import { useApiMutation, useApiQuery } from '@ottabase/ottaorm/client';
import {
    Alert,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
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
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Loader2, Palette, Puzzle, Settings, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { BlogAdminNav } from './BlogAdminNav';
import { BlogLanguageSettingsCard } from './BlogLanguageSettingsCard';
import { useBlogSurface } from './blogAdminPaths';
import { LoadingState } from '@ottabase/ui-components';

const STUDIO_ENTITY = 'blog_studio' as const;

interface StudioStateResponse {
    activeThemeId: string | null;
    themes: StudioThemeState[];
    plugins: StudioPluginState[];
    languageConfig: BlogLanguageConfig;
}

/** POST /api/admin/demo-seed: create-only, so `existing` counts what it left alone. */
type SeedCount = { created: number; existing: number };
type DemoSeedResponse = Record<
    'people' | 'media' | 'posts' | 'comments' | 'shortlinks' | 'menus' | 'notifications',
    SeedCount
>;

/** "12 posts, 4 people" for what a seed run created, or null when it created nothing */
function seededSummary(result: DemoSeedResponse): string | null {
    const parts = (Object.keys(result) as Array<keyof DemoSeedResponse>)
        .filter((key) => result[key].created > 0)
        .map((key) => `${result[key].created} ${key === 'people' && result[key].created === 1 ? 'person' : key}`);
    return parts.length ? parts.join(', ') : null;
}

/** Content Injector plugin config form shape (enable/disable is on the plugin row, not in config modal) */
interface ContentInjectorConfigForm {
    content: string;
    position: 'beginning' | 'end' | 'random';
    contentTypes: string;
    priority: number;
}

const defaultContentInjectorForm: ContentInjectorConfigForm = {
    content: '',
    position: 'end',
    contentTypes: '',
    priority: 10,
};

function pluginConfigToForm(config: Record<string, unknown> | null): ContentInjectorConfigForm {
    if (!config) return defaultContentInjectorForm;
    const ct = config.contentTypes as string[] | undefined;
    return {
        content: (config.content as string) ?? '',
        position: (config.position as 'beginning' | 'end' | 'random') ?? 'end',
        contentTypes: Array.isArray(ct) ? ct.join(', ') : '',
        priority: (config.priority as number) ?? 10,
    };
}

function formToPluginConfig(form: ContentInjectorConfigForm): Record<string, unknown> {
    return {
        content: form.content,
        position: form.position,
        contentTypes: form.contentTypes
            ? form.contentTypes
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [],
        priority: form.priority,
    };
}

export function AdminBlogStudioPage() {
    const surface = useBlogSurface();
    const {
        data: state,
        isLoading,
        isError,
        error,
    } = useApiQuery<StudioStateResponse>({
        entity: STUDIO_ENTITY,
        queryKey: ['state'],
        endpoint: '/api/blog/studio/state?full=1',
    });
    const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: '',
        message: '',
    });
    const [configModal, setConfigModal] = useState<{ open: boolean; plugin: StudioPluginState | null }>({
        open: false,
        plugin: null,
    });
    const [configForm, setConfigForm] = useState<ContentInjectorConfigForm>(defaultContentInjectorForm);
    const [savingConfig, setSavingConfig] = useState(false);

    const activateThemeMutation = useApiMutation<unknown, { themeId: string }>({
        endpoint: '/api/blog/studio/theme/activate',
        method: 'POST',
        invalidateEntities: [STUDIO_ENTITY],
        mutationOptions: {
            onError: () =>
                setAlertDialog({ open: true, title: 'Error', message: 'Failed to activate theme. Please try again.' }),
        },
    });

    const setPluginEnabledMutation = useApiMutation<unknown, { pluginId: string; enabled: boolean }>({
        endpoint: '/api/blog/studio/plugin/enable',
        method: 'POST',
        invalidateEntities: [STUDIO_ENTITY],
        mutationOptions: {
            onError: () =>
                setAlertDialog({ open: true, title: 'Error', message: 'Failed to update plugin. Please try again.' }),
        },
    });

    // Demo seeding is a platform-owner setup step: it writes sample posts into the
    // app's own content. The server gate (system-scoped platform:admin) is
    // authoritative; this only hides a card the caller could not act on.
    const { user } = useSession();
    const canSeedDemo = isPlatformAdmin(user);
    const [demoSeedResult, setDemoSeedResult] = useState<DemoSeedResponse | null>(null);

    const seedDemoMutation = useApiMutation<DemoSeedResponse, Record<string, never>>({
        endpoint: '/api/admin/demo-seed',
        method: 'POST',
        // Refresh what the seed filled so it shows up without a reload.
        invalidateEntities: ['posts', 'media', 'comments', 'shortlinks', 'menus', 'users', 'notifications'],
        mutationOptions: {
            onSuccess: (result) => setDemoSeedResult(result),
            onError: (error) => {
                setDemoSeedResult(null);
                setAlertDialog({
                    open: true,
                    title: 'Could not seed demo content',
                    message:
                        error instanceof Error && error.message
                            ? error.message
                            : 'Seeding needs the platform owner role. Check your access and try again.',
                });
            },
        },
    });

    const savePluginConfigMutation = useApiMutation<unknown, { pluginId: string; config: Record<string, unknown> }>({
        endpoint: '/api/blog/studio/plugin/config',
        method: 'POST',
        invalidateEntities: [STUDIO_ENTITY],
        mutationOptions: {
            onSuccess: () => closeConfigModal(),
            onError: () =>
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: 'Failed to save plugin config. Please try again.',
                }),
        },
    });

    const activateTheme = useCallback(
        (themeId: string) => activateThemeMutation.mutate({ themeId }),
        [activateThemeMutation],
    );

    const setPluginEnabled = useCallback(
        (pluginId: string, enabled: boolean) => setPluginEnabledMutation.mutate({ pluginId, enabled }),
        [setPluginEnabledMutation],
    );

    const openConfigModal = useCallback((plugin: StudioPluginState) => {
        setConfigModal({ open: true, plugin });
        setConfigForm(
            plugin.pluginId === 'content-injector-plugin'
                ? pluginConfigToForm(plugin.config as Record<string, unknown> | null)
                : defaultContentInjectorForm,
        );
    }, []);

    const closeConfigModal = useCallback(() => {
        setConfigModal({ open: false, plugin: null });
        setSavingConfig(false);
    }, []);

    const savePluginConfig = useCallback(() => {
        const plugin = configModal.plugin;
        if (!plugin) return;
        setSavingConfig(true);
        const config =
            plugin.pluginId === 'content-injector-plugin'
                ? formToPluginConfig(configForm)
                : ((configModal.plugin?.config as Record<string, unknown>) ?? {});
        savePluginConfigMutation.mutate(
            { pluginId: plugin.pluginId, config },
            { onSettled: () => setSavingConfig(false) },
        );
    }, [configModal.plugin, configForm, savePluginConfigMutation]);

    if (isError && error) {
        return (
            <div className="space-y-6">
                <Alert variant="destructive">Failed to load studio state.</Alert>
                <Button asChild variant="outline">
                    <Link to={surface.contentPath}>Back to Blog</Link>
                </Button>
            </div>
        );
    }

    if (!state) {
        return (
            <div className="space-y-6" aria-busy="true">
                <span className="sr-only">Loading content studio...</span>
                <LoadingState count={1} height="h-8" className="w-64" />
                <div className="grid gap-6 md:grid-cols-2">
                    <LoadingState count={1} height="h-64" />
                    <LoadingState count={1} height="h-64" />
                </div>
            </div>
        );
    }

    const languageConfig = state.languageConfig ?? {
        defaultLanguage: 'en',
        supportedLanguages: [{ code: 'en', name: 'English', nativeName: 'English' }],
        fallbackToDefault: true,
    };

    return (
        <div className="space-y-8">
            <BlogAdminNav />

            <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Content studio</h1>
                <p className="max-w-3xl text-muted-foreground">
                    Manage themes, plugins, and the languages your readers can use.
                </p>
            </div>

            <BlogLanguageSettingsCard config={languageConfig} />

            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
                    <span className="sr-only">Loading themes and plugins...</span>
                    <LoadingState count={1} height="h-64" />
                    <LoadingState count={1} height="h-64" />
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                                <Palette className="h-4 w-4 text-muted-foreground" />
                                Themes
                            </CardTitle>
                            <CardDescription>Choose the active theme for your blog.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {state?.themes?.length ? (
                                state.themes.map((theme) => (
                                    <div
                                        key={theme.id}
                                        className="flex items-center justify-between rounded-lg bg-background p-3 ring-1 ring-border"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{theme.name}</p>
                                            {theme.description && (
                                                <p className="text-sm leading-relaxed text-muted-foreground">
                                                    {theme.description}
                                                </p>
                                            )}
                                            {(theme.version || theme.author) && (
                                                <p className="mt-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                    {[
                                                        theme.version && `v${theme.version}`,
                                                        theme.author && `by ${theme.author}`,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant={theme.isActive ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => activateTheme(theme.themeId)}
                                            disabled={theme.isActive}
                                        >
                                            {theme.isActive ? 'Active' : 'Activate'}
                                        </Button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-sm">
                                    No themes in database. Default theme is used.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                                <Puzzle className="h-4 w-4 text-muted-foreground" />
                                Plugins
                            </CardTitle>
                            <CardDescription>Enable or disable plugins.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {state?.plugins?.length ? (
                                state.plugins.map((plugin) => (
                                    <div
                                        key={plugin.id}
                                        className="flex items-center justify-between gap-2 rounded-lg bg-background p-3 ring-1 ring-border"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{plugin.name}</p>
                                            {plugin.description && (
                                                <p className="text-sm leading-relaxed text-muted-foreground">
                                                    {plugin.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            {plugin.pluginId === 'content-injector-plugin' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openConfigModal(plugin)}
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant={plugin.enabled ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setPluginEnabled(plugin.pluginId, !plugin.enabled)}
                                            >
                                                {plugin.enabled ? 'Enabled' : 'Enable'}
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-sm">No plugins in database.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {canSeedDemo ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            Demo Content
                        </CardTitle>
                        <CardDescription>
                            Fills a fresh install with a believable site: four people with roles, a media library, six
                            months of articles, release notes, short thoughts and photo journals with their tags and
                            series, comment threads, shortlinks and navigation. The kitchensink post renders every block
                            the editor supports, which is the quickest way to check a theme end to end.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => seedDemoMutation.mutate({})}
                            disabled={seedDemoMutation.isPending}
                        >
                            {seedDemoMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Seeding…
                                </>
                            ) : (
                                'Seed demo content'
                            )}
                        </Button>
                        {demoSeedResult ? (
                            <span className="inline-flex items-center rounded-full bg-background px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                                {seededSummary(demoSeedResult)
                                    ? `Seeded ${seededSummary(demoSeedResult)}`
                                    : 'Already seeded'}
                            </span>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Creates only what is missing. Nothing you edited is overwritten, so it is safe to
                                repeat.
                            </p>
                        )}
                    </CardContent>
                </Card>
            ) : null}

            <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog((d) => ({ ...d, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>{alertDialog.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>OK</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setAlertDialog((d) => ({ ...d, open: false }))}>
                            Close
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={configModal.open} onOpenChange={(open) => !open && closeConfigModal()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Plugin config: {configModal.plugin?.name ?? 'Plugin'}</DialogTitle>
                        <DialogDescription>
                            {configModal.plugin?.pluginId === 'content-injector-plugin'
                                ? 'Configure injected content, position, and filters.'
                                : 'Configure plugin options.'}
                        </DialogDescription>
                    </DialogHeader>
                    {configModal.plugin?.pluginId === 'content-injector-plugin' ? (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="config-content">Content (HTML allowed)</Label>
                                <Textarea
                                    id="config-content"
                                    value={configForm.content}
                                    onChange={(e) => setConfigForm((f) => ({ ...f, content: e.target.value }))}
                                    rows={4}
                                    className="font-mono text-sm"
                                    placeholder="<p>Injected content here</p>"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="config-position">Position</Label>
                                <Select
                                    value={configForm.position}
                                    onValueChange={(v: 'beginning' | 'end' | 'random') =>
                                        setConfigForm((f) => ({ ...f, position: v }))
                                    }
                                >
                                    <SelectTrigger id="config-position">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="beginning">Beginning</SelectItem>
                                        <SelectItem value="end">End</SelectItem>
                                        <SelectItem value="random">Random</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="config-content-types">
                                    Content types (comma-separated, empty = all)
                                </Label>
                                <Input
                                    id="config-content-types"
                                    value={configForm.contentTypes}
                                    onChange={(e) => setConfigForm((f) => ({ ...f, contentTypes: e.target.value }))}
                                    placeholder="blog, changelog, docs"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="config-priority">Priority</Label>
                                <Input
                                    id="config-priority"
                                    type="number"
                                    value={configForm.priority}
                                    onChange={(e) =>
                                        setConfigForm((f) => ({ ...f, priority: Number(e.target.value) || 10 }))
                                    }
                                />
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm py-4">
                            This plugin has no configurable options in the UI.
                        </p>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={closeConfigModal}>
                            Cancel
                        </Button>
                        <Button onClick={savePluginConfig} disabled={savingConfig}>
                            {savingConfig ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
