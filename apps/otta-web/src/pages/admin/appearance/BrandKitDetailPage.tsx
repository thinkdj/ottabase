// ---------------------------------------------------------------------------
// Brand Kit detail – Tabbed editor with realtime preview
// ---------------------------------------------------------------------------

import { buildCSSVarMap, buildPreviewTheme, injectFont } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@ottabase/ui-shadcn';
import {
    IconActivity,
    IconArrowLeft,
    IconArrowRight,
    IconBadge,
    IconDownload,
    IconMoon,
    IconPalette,
    IconPhoto,
    IconPointer,
    IconSettings,
    IconSun,
    IconTrash,
    IconTypography,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { brandKitApi, type BrandKitItem } from './brand/brandApi';
import { BrandKitAdvancedTab } from './brand/BrandKitAdvancedTab';
import { BrandKitBrandTab } from './brand/BrandKitBrandTab';
import { BrandKitCursorsTab } from './brand/BrandKitCursorsTab';
import { BrandKitFontsTab } from './brand/BrandKitFontsTab';
import { BrandKitLogoTab, LOGO_DRAFT_FIELDS } from './brand/BrandKitLogoTab';
import { BrandKitMotionTab } from './brand/BrandKitMotionTab';
import { BrandKitThemeTab, colorSwatchClass } from './brand/BrandKitThemeTab';
import { TabDisableToggle } from './brand/TabDisableToggle';

const VALID_TABS = ['brand', 'logo', 'theme', 'fonts', 'motion', 'cursors', 'advanced'] as const;

/** Editor sections, in tab order */
const TAB_DEFS: Array<{ value: (typeof VALID_TABS)[number]; label: string; icon: typeof IconBadge }> = [
    { value: 'brand', label: 'Brand', icon: IconBadge },
    { value: 'logo', label: 'Logo', icon: IconPhoto },
    { value: 'theme', label: 'Theme', icon: IconPalette },
    { value: 'fonts', label: 'Fonts', icon: IconTypography },
    { value: 'motion', label: 'Motion', icon: IconActivity },
    { value: 'cursors', label: 'Cursors', icon: IconPointer },
    { value: 'advanced', label: 'Advanced', icon: IconSettings },
];

/**
 * Serializes exactly the fields the Save button persists, so unsaved-change
 * detection can't false-positive on logo uploads (those persist immediately
 * and are intentionally excluded from the Save payload).
 */
function savableSnapshot(src: {
    name?: string | null;
    brandName?: string | null;
    tagline?: string | null;
    parentBrandKitId?: string | null;
    tokensJson?: string | null;
    themePresetId?: string | null;
    defaultColorScheme?: string | null;
    allowDarkModeToggle?: boolean | null;
    customCss?: string | null;
    hideOttabaseBranding?: boolean | null;
}): string {
    return JSON.stringify({
        name: src.name ?? '',
        brandName: src.brandName ?? 'My App',
        tagline: src.tagline ?? '',
        parentBrandKitId: src.parentBrandKitId ?? null,
        tokensJson: src.tokensJson ?? '{}',
        themePresetId: src.themePresetId ?? null,
        defaultColorScheme: src.defaultColorScheme ?? 'system',
        allowDarkModeToggle: src.allowDarkModeToggle ?? true,
        customCss: src.customCss ?? '',
        hideOttabaseBranding: src.hideOttabaseBranding ?? false,
    });
}

/** Preview panel – reflects current draft (colors, fonts, motion, shadows) in realtime */
function BrandKitPreviewPanel({
    kitData,
    mode = 'light',
    logos,
}: {
    kitData: { tokensJson?: string | null; themePresetId?: string | null };
    mode?: 'light' | 'dark';
    logos?: { primary?: string; dark?: string; icon?: string };
}) {
    const theme = useMemo(
        () => buildPreviewTheme({ tokensJson: kitData.tokensJson, themePresetId: kitData.themePresetId }, mode),
        [kitData.tokensJson, kitData.themePresetId, mode],
    );
    const varMap = useMemo(() => buildCSSVarMap(theme), [theme]);
    const logoUrl = mode === 'dark' ? (logos?.dark ?? logos?.primary) : logos?.primary;

    useEffect(() => {
        const urls: string[] = [];
        if (theme.typography?.heading?.url) urls.push(theme.typography.heading.url);
        if (theme.typography?.body?.url) urls.push(theme.typography.body.url);
        if (theme.typography?.handwriting?.url) urls.push(theme.typography.handwriting.url);
        urls.forEach((url) => injectFont(url));
    }, [theme.typography]);

    return (
        <div
            className="rounded-xl border bg-background p-4 overflow-hidden relative group"
            style={
                {
                    ...varMap,
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-md)',
                    // Ensure text inherits preview theme's foreground (fixes dark mode contrast)
                    color: 'hsl(var(--foreground))',
                    cursor: 'var(--cursor-default, auto)',
                } as React.CSSProperties
            }
        >
            {/* Background animated element to demonstrate motion tokens */}
            <div
                className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none"
                style={{
                    transition:
                        'transform var(--motion-duration-slow, 500ms) var(--motion-ease-bouncy, cubic-bezier(0.34, 1.56, 0.64, 1))',
                    transform: 'scale(1)',
                }}
            />

            <div className="space-y-theme-section relative z-10 group-hover:[&>.absolute]:scale-150">
                <div className="flex items-center gap-3">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
                    ) : (
                        <div className="flex h-10 w-24 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                            Logo
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                            Preview UI
                        </h3>
                        <p className="text-sm text-muted-foreground" style={{ fontFamily: 'var(--font-body)' }}>
                            Changes reflect instantly
                        </p>
                    </div>
                </div>

                <div className="space-y-2 rounded-lg border p-3 bg-card border-border">
                    <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Color palette
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {['primary', 'secondary', 'accent', 'muted', 'destructive'].map((token) => (
                            <div
                                key={token}
                                className={`h-8 w-8 rounded-md ${colorSwatchClass} hover:scale-110`}
                                style={{
                                    backgroundColor: `hsl(var(--${token}))`,
                                    transition:
                                        'transform var(--motion-duration-normal, 200ms) var(--motion-ease-default, ease)',
                                    cursor: 'var(--cursor-pointer, pointer)',
                                }}
                                title={token}
                            />
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Shadows &amp; Interactive Elements
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
                            style={{
                                borderRadius: 'calc(var(--radius) - 2px)',
                                boxShadow: 'var(--shadow-sm)',
                                transition: 'all var(--motion-duration-fast, 150ms) var(--motion-ease-default, ease)',
                                cursor: 'var(--cursor-pointer, pointer)',
                            }}
                        >
                            Primary Button
                        </button>
                        <button
                            type="button"
                            className="border border-input bg-background/50 px-4 py-2 text-sm font-medium hover:bg-accent"
                            style={{
                                borderRadius: 'calc(var(--radius) - 2px)',
                                transition: 'all var(--motion-duration-fast, 150ms) var(--motion-ease-default, ease)',
                                cursor: 'var(--cursor-pointer, pointer)',
                            }}
                        >
                            Outline Variant
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        {['xs', 'sm', 'md', 'lg'].map((level) => (
                            <div
                                key={level}
                                className="p-3 border border-border bg-card group/card hover:-translate-y-1"
                                style={{
                                    borderRadius: 'var(--radius)',
                                    boxShadow: `var(--shadow-${level})`,
                                    transition:
                                        'box-shadow var(--motion-duration-normal, 200ms) var(--motion-ease-default, ease), transform var(--motion-duration-normal, 200ms) var(--motion-ease-default, ease)',
                                    cursor: 'var(--cursor-text, text)',
                                }}
                            >
                                <span className="text-xs font-medium text-card-foreground">--shadow-{level}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-2 border-t border-border">
                    <p
                        className="text-sm"
                        style={{
                            fontFamily: 'var(--font-heading)',
                            fontWeight: 'var(--typography-heading-weight, 700)',
                            letterSpacing: 'var(--typography-heading-spacing, normal)',
                            lineHeight: 'var(--typography-heading-line-height, 1.2)',
                        }}
                    >
                        Heading Typography
                    </p>
                    <p
                        className="text-sm text-muted-foreground mt-1"
                        style={{
                            fontFamily: 'var(--font-body)',
                            lineHeight: 'var(--typography-body-line-height, 1.5)',
                            fontWeight: 'var(--typography-body-weight, 400)',
                            letterSpacing: 'var(--typography-body-spacing, normal)',
                        }}
                    >
                        Body typography preview demonstrating the selected Google Fonts and precise typographic scaling.
                    </p>
                    <p
                        className="text-sm mt-3 text-primary"
                        style={{ fontFamily: 'var(--font-handwriting)', fontSize: '1.25rem' }}
                    >
                        Handwriting sample showing custom web fonts
                    </p>
                </div>
            </div>
        </div>
    );
}

function getLogoUrls(kit: BrandKitItem, base: string) {
    if (!base) return {};
    return {
        primary: kit.logoKey ? `${base.replace(/\/$/, '')}/${kit.logoKey}` : undefined,
        dark: kit.logoDarkKey ? `${base.replace(/\/$/, '')}/${kit.logoDarkKey}` : undefined,
        icon: kit.iconKey ? `${base.replace(/\/$/, '')}/${kit.iconKey}` : undefined,
    };
}

export function AdminBrandKitDetailPage() {
    const { kitId } = useParams({ strict: false }) as { kitId?: string };
    const queryClient = useQueryClient();
    const { config, refresh } = useBrand();
    const navigate = useNavigate();
    const isNew = !kitId || kitId === 'new';

    const { data: kit, isLoading } = useApiQuery<BrandKitItem>({
        entity: 'brand_kits',
        queryKey: ['detail', kitId],
        endpoint: `/api/brand/kits/${kitId}`,
        queryOptions: { enabled: !!kitId && kitId !== 'new', staleTime: 5000 },
    });

    // Draft state – updates preview in realtime
    const [draft, setDraft] = useState({
        name: '',
        brandName: '',
        tagline: '',
        parentBrandKitId: null as string | null,
        tokensJson: '{}',
        themePresetId: null as string | null,
        defaultColorScheme: 'system' as 'light' | 'dark' | 'system',
        allowDarkModeToggle: true,
        customCss: '',
        hideOttabaseBranding: false,
        logoKey: null as string | null,
        logoDarkKey: null as string | null,
        iconKey: null as string | null,
        ogImageKey: null as string | null,
        emailLogoKey: null as string | null,
    });
    const [tab, setTab] = useState<(typeof VALID_TABS)[number]>('brand');
    const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    useEffect(() => {
        if (kit) {
            // Preview in the scheme the brand actually ships with
            setPreviewMode(kit.defaultColorScheme === 'dark' ? 'dark' : 'light');
            setDraft({
                name: kit.name ?? '',
                brandName: kit.brandName ?? 'My App',
                tagline: kit.tagline ?? '',
                parentBrandKitId: kit.parentBrandKitId ?? null,
                tokensJson: kit.tokensJson ?? '{}',
                themePresetId: kit.themePresetId ?? null,
                defaultColorScheme: (kit.defaultColorScheme as 'light' | 'dark' | 'system') ?? 'system',
                allowDarkModeToggle: kit.allowDarkModeToggle ?? true,
                customCss: kit.customCss ?? '',
                hideOttabaseBranding: kit.hideOttabaseBranding ?? false,
                logoKey: kit.logoKey ?? null,
                logoDarkKey: kit.logoDarkKey ?? null,
                iconKey: kit.iconKey ?? null,
                ogImageKey: kit.ogImageKey ?? null,
                emailLogoKey: kit.emailLogoKey ?? null,
            });
        }
    }, [kit]);

    const updateMutation = useMutation({
        meta: { entity: 'brand_kits' },
        mutationFn: (body: Record<string, unknown>) => brandKitApi.update(kitId!, body),
        onSuccess: () => {
            toast.success('Brand Kit saved');
            queryClient.invalidateQueries({ queryKey: ['brand_kits'] });
            refresh();
        },
        onError: () => toast.error('Failed to save'),
    });

    const createMutation = useMutation({
        meta: { entity: 'brand_kits' },
        mutationFn: (body: Record<string, unknown>) => brandKitApi.create(body),
        onSuccess: (created) => {
            toast.success('Brand Kit created');
            queryClient.invalidateQueries({ queryKey: ['brand_kits'] });
            refresh();
            navigate({ to: '/admin/appearance/brand-kits/$kitId', params: { kitId: created.id } });
        },
        onError: () => toast.error('Failed to create'),
    });

    const deleteMutation = useMutation({
        meta: { entity: 'brand_kits' },
        mutationFn: () => brandKitApi.delete(kitId!),
        onSuccess: () => {
            toast.success('Brand Kit deleted');
            queryClient.invalidateQueries({ queryKey: ['brand_kits'] });
            refresh();
            navigate({ to: '/admin/appearance/brand-kits' });
        },
        onError: () => toast.error('Failed to delete'),
    });

    const saving = isNew ? createMutation.isPending : updateMutation.isPending;

    // Unsaved-change detection over exactly the fields Save persists
    const baseline = useMemo(() => (kit ? savableSnapshot(kit) : null), [kit]);
    const isDirty = isNew ? true : baseline !== null && savableSnapshot(draft) !== baseline;

    const handleSave = () => {
        if (saving || (!isNew && !isDirty)) return;
        const payload = {
            name: draft.name?.trim() || draft.brandName || 'New Brand Kit',
            brandName: draft.brandName || 'My App',
            tagline: draft.tagline || undefined,
            parentBrandKitId: draft.parentBrandKitId || null,
            tokensJson: draft.tokensJson.trim() || undefined,
            themePresetId: draft.themePresetId,
            defaultColorScheme: draft.defaultColorScheme,
            allowDarkModeToggle: draft.allowDarkModeToggle,
            customCss: draft.customCss || undefined,
            hideOttabaseBranding: draft.hideOttabaseBranding,
        };

        if (isNew) {
            createMutation.mutate(payload);
        } else {
            updateMutation.mutate(payload);
        }
    };

    // Cmd/Ctrl+S saves – matches the "editor" mental model of this page.
    // Ref indirection keeps the listener mounted once while always calling the latest closure.
    const saveRef = useRef(handleSave);
    saveRef.current = handleSave;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveRef.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const handleDelete = () => {
        if (deleteMutation.isPending || !kit) return;
        if (kit.isDefault) return;
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        deleteMutation.mutate();
        setDeleteDialogOpen(false);
    };

    /** Download kit as ottabase_<name>_YYYYMMDD.json – complete backup */
    const handleDownloadKit = () => {
        const themeName =
            (draft.name || draft.brandName || kitForView.name || 'brand-kit')
                .replace(/[^a-zA-Z0-9-_]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '') || 'brand-kit';
        const appId = kitForView.appId ?? 'default';
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `ottabase_${themeName}_${appId}_${date}.json`;

        const payload: Record<string, unknown> = {
            meta: { exportedAt: new Date().toISOString(), version: 'ottabase-brand-kit-v1' },
            id: kitForView.id,
            appId: kitForView.appId,
            isDefault: kitForView.isDefault,
            parentBrandKitId: draft.parentBrandKitId ?? kitForView.parentBrandKitId,
            createdBy: kitForView.createdBy,
            updatedBy: kitForView.updatedBy,
            name: draft.name || kitForView.name,
            slug: kitForView.slug,
            brandName: draft.brandName || kitForView.brandName,
            tagline: draft.tagline ?? kitForView.tagline,
            themePresetId: draft.themePresetId ?? kitForView.themePresetId,
            tokensJson: draft.tokensJson?.trim() || kitForView.tokensJson,
            defaultColorScheme: draft.defaultColorScheme ?? kitForView.defaultColorScheme,
            allowDarkModeToggle: draft.allowDarkModeToggle ?? kitForView.allowDarkModeToggle,
            customCss: draft.customCss ?? kitForView.customCss,
            hideOttabaseBranding: draft.hideOttabaseBranding ?? kitForView.hideOttabaseBranding,
            logoKey: draft.logoKey ?? kitForView.logoKey,
            logoDarkKey: draft.logoDarkKey ?? kitForView.logoDarkKey,
            iconKey: draft.iconKey ?? kitForView.iconKey,
            ogImageKey: draft.ogImageKey ?? kitForView.ogImageKey,
            emailLogoKey: draft.emailLogoKey ?? kitForView.emailLogoKey,
            createdAt: kitForView.createdAt,
            updatedAt: kitForView.updatedAt,
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Brand Kit downloaded');
    };

    // Stable handlers for child tab components (avoids re-render on every draft change)
    const handleDraftMerge = useCallback((d: Partial<typeof draft>) => setDraft((s) => ({ ...s, ...d })), []);
    const handleThemePresetChange = useCallback(
        (v: string | null) => setDraft((s) => ({ ...s, themePresetId: v })),
        [],
    );
    const handleTokensChange = useCallback((v: string) => setDraft((s) => ({ ...s, tokensJson: v })), []);
    // Uploads persist server-side immediately; merge the new key into the draft
    // instead of refetching — a refetch would reset the draft and discard
    // unsaved edits in other tabs.
    const handleLogoUploaded = useCallback(
        (logoType: string, key: string | null) => {
            const field = LOGO_DRAFT_FIELDS[logoType];
            if (field) setDraft((s) => ({ ...s, [field]: key }));
            refresh();
        },
        [refresh],
    );

    const hasColorOverrides = useMemo(() => {
        try {
            const parsed = JSON.parse(draft.tokensJson || '{}') as { color?: unknown };
            return Boolean(parsed.color);
        } catch {
            return false;
        }
    }, [draft.tokensJson]);

    if (!isNew && (isLoading || !kit)) {
        return (
            <div className="space-y-8" aria-busy="true">
                <span className="sr-only">Loading Brand Kit...</span>
                <div className="flex items-center justify-between">
                    <div className="h-9 w-64 animate-pulse rounded-xl bg-muted/40" />
                    <div className="h-9 w-48 animate-pulse rounded-xl bg-muted/40" />
                </div>
                <div className="grid gap-8 lg:grid-cols-[1fr,340px]">
                    <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
                    <div className="space-y-4">
                        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
                        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
                    </div>
                </div>
            </div>
        );
    }

    const kitForView: BrandKitItem =
        kit ??
        ({
            id: 'new',
            appId: null,
            name: draft.name || 'New Brand Kit',
            brandName: draft.brandName || 'My App',
            tagline: draft.tagline || null,
            themePresetId: draft.themePresetId,
            tokensJson: draft.tokensJson,
            defaultColorScheme: draft.defaultColorScheme,
            allowDarkModeToggle: draft.allowDarkModeToggle,
            customCss: draft.customCss || null,
            hideOttabaseBranding: draft.hideOttabaseBranding,
            logoKey: draft.logoKey,
            logoDarkKey: draft.logoDarkKey,
            iconKey: draft.iconKey,
            ogImageKey: draft.ogImageKey,
            emailLogoKey: draft.emailLogoKey,
            isDefault: false,
        } as BrandKitItem);

    const logoBaseUrl = config?.r2PublicUrl ?? '';
    const logoUrls = getLogoUrls({ ...kitForView, ...draft } as BrandKitItem, logoBaseUrl);
    const isDefaultKit = Boolean(kitForView.isDefault);

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin/appearance/brand-kits">
                        <IconArrowLeft className="h-4 w-4" />
                        Back to Kits
                    </Link>
                </Button>

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
                                {draft.name || kitForView.name}
                            </h1>
                            {isDefaultKit && (
                                <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    Default
                                </span>
                            )}
                        </div>
                        {!isNew ? (
                            <Link
                                to="/admin/appearance/layouts"
                                className="group inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors duration-normal hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                Configure layouts & route mappings
                                <IconArrowRight className="h-3.5 w-3.5 transition-transform duration-normal group-hover:translate-x-0.5" />
                            </Link>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {!isNew && isDirty && !saving ? (
                            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                                Unsaved changes
                            </span>
                        ) : null}
                        <Button
                            variant="outline"
                            onClick={handleDownloadKit}
                            title="Download kit as JSON backup (ottabase_&lt;name&gt;_YYYYMMDD.json)"
                        >
                            <IconDownload className="mr-2 h-4 w-4" />
                            Download
                        </Button>
                        {isNew || isDefaultKit ? null : (
                            <Button
                                variant="outline"
                                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={handleDelete}
                                disabled={deleteMutation.isPending}
                            >
                                <IconTrash className="mr-2 h-4 w-4" />
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </Button>
                        )}
                        <Button onClick={handleSave} disabled={saving || (!isNew && !isDirty)} title="Save (Ctrl+S)">
                            {saving
                                ? isNew
                                    ? 'Creating...'
                                    : 'Saving...'
                                : isNew
                                  ? 'Create Brand Kit'
                                  : isDirty
                                    ? 'Save changes'
                                    : 'Saved'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr,340px]">
                <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof VALID_TABS)[number])} className="w-full">
                    {/* Underline tabs: scroll horizontally instead of wrapping into a grid */}
                    <TabsList className="mb-2 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
                        {TAB_DEFS.map(({ value, label, icon: TabIcon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="-mb-px min-w-0 shrink-0 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-muted-foreground shadow-none transition-colors duration-normal hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                                <TabIcon className="h-4 w-4" />
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="brand">
                        <BrandKitBrandTab
                            name={draft.name}
                            brandName={draft.brandName}
                            tagline={draft.tagline}
                            parentBrandKitId={draft.parentBrandKitId}
                            currentKitId={isNew ? undefined : kitId}
                            onChange={handleDraftMerge}
                            nameReadOnly={!isNew && kitForView.appId === null}
                        />
                    </TabsContent>
                    <TabsContent value="logo">
                        {isNew ? (
                            <div className="rounded-xl bg-muted/40 p-6 text-sm text-muted-foreground">
                                Save the Brand Kit first to upload logos.
                            </div>
                        ) : (
                            <BrandKitLogoTab
                                kitId={kitId!}
                                logos={{
                                    logoKey: draft.logoKey,
                                    logoDarkKey: draft.logoDarkKey,
                                    iconKey: draft.iconKey,
                                    ogImageKey: draft.ogImageKey,
                                    emailLogoKey: draft.emailLogoKey,
                                }}
                                logoBaseUrl={logoBaseUrl}
                                onChanged={handleLogoUploaded}
                            />
                        )}
                    </TabsContent>
                    <TabsContent value="theme">
                        <BrandKitThemeTab
                            themePresetId={draft.themePresetId}
                            tokensJson={draft.tokensJson}
                            onThemePresetChange={handleThemePresetChange}
                            onTokensChange={handleTokensChange}
                            hasParent={!!draft.parentBrandKitId}
                        />
                    </TabsContent>
                    <TabsContent value="fonts">
                        <TabDisableToggle
                            section="fonts"
                            label="Disable fonts"
                            description="Skip all web-font downloads — the app renders with system fonts."
                            tokensJson={draft.tokensJson}
                            onTokensChange={handleTokensChange}
                        >
                            <BrandKitFontsTab
                                tokensJson={draft.tokensJson}
                                themePresetId={draft.themePresetId}
                                onTokensChange={handleTokensChange}
                                hasParent={!!draft.parentBrandKitId}
                            />
                        </TabDisableToggle>
                    </TabsContent>
                    <TabsContent value="motion">
                        <TabDisableToggle
                            section="motion"
                            label="Disable motion"
                            description="Turn off all animations and transitions (durations become 0s)."
                            tokensJson={draft.tokensJson}
                            onTokensChange={handleTokensChange}
                        >
                            <BrandKitMotionTab tokensJson={draft.tokensJson} onTokensChange={handleTokensChange} />
                        </TabDisableToggle>
                    </TabsContent>
                    <TabsContent value="cursors">
                        <TabDisableToggle
                            section="cursors"
                            label="Disable cursors"
                            description="Ignore custom cursors — the browser's native cursors are used."
                            tokensJson={draft.tokensJson}
                            onTokensChange={handleTokensChange}
                        >
                            <BrandKitCursorsTab tokensJson={draft.tokensJson} onTokensChange={handleTokensChange} />
                        </TabDisableToggle>
                    </TabsContent>
                    <TabsContent value="advanced">
                        <BrandKitAdvancedTab
                            defaultColorScheme={draft.defaultColorScheme}
                            allowDarkModeToggle={draft.allowDarkModeToggle}
                            customCss={draft.customCss}
                            hideOttabaseBranding={draft.hideOttabaseBranding}
                            tokensJson={draft.tokensJson}
                            onTokensChange={handleTokensChange}
                            onChange={handleDraftMerge}
                        />
                    </TabsContent>
                </Tabs>

                {/* Realtime preview – one panel, light/dark toggle */}
                <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Live preview
                        </p>
                        <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Preview color scheme">
                            {(['light', 'dark'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setPreviewMode(m)}
                                    aria-pressed={previewMode === m}
                                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium capitalize transition-colors duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        previewMode === m
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {m === 'light' ? (
                                        <IconSun className="h-3.5 w-3.5" />
                                    ) : (
                                        <IconMoon className="h-3.5 w-3.5" />
                                    )}
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                    {hasColorOverrides ? (
                        <p className="text-xs text-warning">Showing custom token colors (overrides preset).</p>
                    ) : null}
                    <BrandKitPreviewPanel
                        kitData={{
                            tokensJson: draft.tokensJson,
                            themePresetId: draft.themePresetId,
                        }}
                        mode={previewMode}
                        logos={logoUrls}
                    />
                    <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                        Edits preview instantly — save to publish them.
                    </p>
                </div>
            </div>

            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Brand Kit?"
                description={`This cannot be undone. The Brand Kit "${kitForView.name}" will be permanently deleted.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                onConfirm={handleConfirmDelete}
                confirmProps={{ disabled: deleteMutation.isPending }}
                cancelProps={{ disabled: deleteMutation.isPending }}
            />
        </div>
    );
}
