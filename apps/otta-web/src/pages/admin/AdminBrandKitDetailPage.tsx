// ---------------------------------------------------------------------------
// Brand Kit detail – Tabbed editor with realtime preview
// ---------------------------------------------------------------------------

import { buildCSSVarMap, buildPreviewTheme, injectFont } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ottabase/ui-shadcn';
import {
    IconActivity,
    IconArrowLeft,
    IconBadge,
    IconDownload,
    IconPalette,
    IconPhoto,
    IconPointer,
    IconSettings,
    IconTrash,
    IconTypography,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { brandKitApi, type BrandKitItem } from './brand/brandApi';
import { BrandKitAdvancedTab } from './brand/BrandKitAdvancedTab';
import { BrandKitBrandTab } from './brand/BrandKitBrandTab';
import { BrandKitCursorsTab } from './brand/BrandKitCursorsTab';
import { BrandKitFontsTab } from './brand/BrandKitFontsTab';
import { BrandKitLogoTab } from './brand/BrandKitLogoTab';
import { BrandKitMotionTab } from './brand/BrandKitMotionTab';
import { BrandKitThemeTab, colorSwatchClass } from './brand/BrandKitThemeTab';

const VALID_TABS = ['brand', 'logo', 'theme', 'fonts', 'motion', 'cursors', 'advanced'] as const;

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
            className="rounded-xl border bg-background p-4 dark:border-muted overflow-hidden relative group"
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

                <div className="space-y-2 rounded-lg border p-3 bg-card border-border dark:border-muted">
                    <p className="text-xs font-medium text-muted-foreground">Color palette</p>
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
                    <p className="text-xs font-medium text-muted-foreground">Shadows &amp; Interactive Elements</p>
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
                        className="text-[13px] text-muted-foreground mt-1"
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
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    useEffect(() => {
        if (kit) {
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
            navigate({ to: '/admin/brand-engine/kits/$kitId', params: { kitId: created.id } });
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
            navigate({ to: '/admin/brand-engine' });
        },
        onError: () => toast.error('Failed to delete'),
    });

    const handleSave = () => {
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
    const handleLogoUploaded = useCallback(
        (_logoType: string, _key: string, _url: string) => {
            queryClient.invalidateQueries({ queryKey: ['brand', 'kit', kitId] });
        },
        [queryClient, kitId],
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
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading Brand Kit...</p>
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
    const saving = isNew ? createMutation.isPending : updateMutation.isPending;

    return (
        <div className="space-y-theme-section">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-theme-card">
                    <Link to="/admin/brand-engine">
                        <button
                            type="button"
                            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                        >
                            <IconArrowLeft className="mr-2 h-4 w-4" />
                            Back to Kits
                        </button>
                    </Link>
                    <h1 className="text-2xl font-bold">{draft.name || kitForView.name}</h1>
                </div>
                {!isNew ? (
                    <Link
                        to="/admin/brand-engine/layouts"
                        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                    >
                        Configure layouts & route mappings
                    </Link>
                ) : null}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                        onClick={handleDownloadKit}
                        title="Download kit as JSON backup (ottabase_&lt;name&gt;_YYYYMMDD.json)"
                    >
                        <IconDownload className="mr-2 h-4 w-4" />
                        Download
                    </button>
                    {isNew || isDefaultKit ? null : (
                        <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                        >
                            <IconTrash className="mr-2 h-4 w-4" />
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </button>
                    )}
                    <button
                        type="button"
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (isNew ? 'Creating...' : 'Saving...') : isNew ? 'Create Brand Kit' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="grid gap-theme-section lg:grid-cols-[1fr,320px]">
                <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof VALID_TABS)[number])} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 gap-1 sm:grid-cols-5 lg:w-auto lg:inline-flex lg:flex-wrap">
                        <TabsTrigger value="brand">
                            <IconBadge className="h-4 w-4 mr-2" />
                            Brand
                        </TabsTrigger>
                        <TabsTrigger value="logo">
                            <IconPhoto className="h-4 w-4 mr-2" />
                            Logo
                        </TabsTrigger>
                        <TabsTrigger value="theme">
                            <IconPalette className="h-4 w-4 mr-2" />
                            Theme
                        </TabsTrigger>
                        <TabsTrigger value="fonts">
                            <IconTypography className="h-4 w-4 mr-2" />
                            Fonts
                        </TabsTrigger>
                        <TabsTrigger value="motion">
                            <IconActivity className="h-4 w-4 mr-2" />
                            Motion
                        </TabsTrigger>
                        <TabsTrigger value="cursors">
                            <IconPointer className="h-4 w-4 mr-2" />
                            Cursors
                        </TabsTrigger>
                        <TabsTrigger value="advanced">
                            <IconSettings className="h-4 w-4 mr-2" />
                            Advanced
                        </TabsTrigger>
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
                            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
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
                                onUploaded={handleLogoUploaded}
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
                        <BrandKitFontsTab
                            tokensJson={draft.tokensJson}
                            themePresetId={draft.themePresetId}
                            onTokensChange={handleTokensChange}
                            hasParent={!!draft.parentBrandKitId}
                        />
                    </TabsContent>
                    <TabsContent value="motion">
                        <BrandKitMotionTab tokensJson={draft.tokensJson} onTokensChange={handleTokensChange} />
                    </TabsContent>
                    <TabsContent value="cursors">
                        <BrandKitCursorsTab tokensJson={draft.tokensJson} onTokensChange={handleTokensChange} />
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

                {/* Realtime preview – light and dark stacked */}
                <div className="space-y-theme-card lg:sticky lg:top-4 lg:self-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Live preview</p>
                        {hasColorOverrides ? (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                                Showing custom token colors (overrides preset).
                            </p>
                        ) : null}
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Light</p>
                        <BrandKitPreviewPanel
                            kitData={{
                                tokensJson: draft.tokensJson,
                                themePresetId: draft.themePresetId,
                            }}
                            mode="light"
                            logos={logoUrls}
                        />
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Dark</p>
                        <BrandKitPreviewPanel
                            kitData={{
                                tokensJson: draft.tokensJson,
                                themePresetId: draft.themePresetId,
                            }}
                            mode="dark"
                            logos={logoUrls}
                        />
                    </div>
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
