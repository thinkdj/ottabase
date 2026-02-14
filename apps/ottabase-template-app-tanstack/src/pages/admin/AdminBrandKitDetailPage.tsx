// ---------------------------------------------------------------------------
// Brand Kit detail – Tabbed editor with realtime preview
// ---------------------------------------------------------------------------

import { buildCSSVarMap, buildPreviewTheme, injectFont } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ottabase/ui-shadcn';
import {
    IconArrowLeft,
    IconBadge,
    IconColorSwatch,
    IconPalette,
    IconPhoto,
    IconSettings,
    IconTrash,
    IconTypography,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { brandKitApi, type BrandKitItem } from './brand/brandApi';
import { BrandKitAdvancedTab } from './brand/BrandKitAdvancedTab';
import { BrandKitBrandTab } from './brand/BrandKitBrandTab';
import { BrandKitColorsTab } from './brand/BrandKitColorsTab';
import { BrandKitFontsTab } from './brand/BrandKitFontsTab';
import { BrandKitLogoTab } from './brand/BrandKitLogoTab';
import { BrandKitThemeTab } from './brand/BrandKitThemeTab';

const VALID_TABS = ['brand', 'logo', 'colors', 'theme', 'fonts', 'advanced'] as const;

/** Preview panel – reflects current draft (colors, fonts) in realtime */
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
            className="rounded-xl border bg-background p-4 shadow-sm dark:border-muted"
            style={
                {
                    ...varMap,
                    // Ensure text inherits preview theme's foreground (fixes dark mode contrast)
                    color: 'hsl(var(--foreground))',
                } as React.CSSProperties
            }
        >
            <div className="space-y-4">
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
                            Preview
                        </h3>
                        <p className="text-sm text-muted-foreground" style={{ fontFamily: 'var(--font-body)' }}>
                            Changes reflect here
                        </p>
                    </div>
                </div>
                <div className="space-y-2 rounded-lg border p-3 dark:border-muted">
                    <p className="text-xs font-medium text-muted-foreground">Color palette</p>
                    <div className="flex flex-wrap gap-2">
                        {['primary', 'secondary', 'accent', 'muted', 'destructive'].map((token) => (
                            <div
                                key={token}
                                className="h-8 w-8 rounded-md border border-border shadow-sm dark:border-muted"
                                style={{ backgroundColor: `hsl(var(--${token}))` }}
                                title={token}
                            />
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Sample UI</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                        >
                            Button
                        </button>
                        <button
                            type="button"
                            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
                        >
                            Outline
                        </button>
                    </div>
                </div>
                <p className="text-xs" style={{ fontFamily: 'var(--font-handwriting)' }}>
                    Handwriting sample
                </p>
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

    const { data: kit, isLoading } = useQuery<BrandKitItem>({
        queryKey: ['brand', 'kit', kitId],
        queryFn: () => brandKitApi.get(kitId!),
        enabled: !!kitId && kitId !== 'new',
        // Trust cached data from create/clone for 5s to avoid D1 eventual consistency
        staleTime: 5000,
    });

    // Draft state – updates preview in realtime
    const [draft, setDraft] = useState({
        name: '',
        brandName: '',
        tagline: '',
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

    useEffect(() => {
        if (kit) {
            setDraft({
                name: kit.name ?? '',
                brandName: kit.brandName ?? 'My App',
                tagline: kit.tagline ?? '',
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
        mutationFn: (body: Record<string, unknown>) => brandKitApi.update(kitId!, body),
        onSuccess: () => {
            toast.success('Brand Kit saved');
            queryClient.invalidateQueries({ queryKey: ['brand', 'kit', kitId] });
            queryClient.invalidateQueries({ queryKey: ['brand', 'kits'] });
            refresh();
        },
        onError: () => toast.error('Failed to save'),
    });

    const createMutation = useMutation({
        mutationFn: (body: Record<string, unknown>) => brandKitApi.create(body),
        onSuccess: (created) => {
            toast.success('Brand Kit created');
            queryClient.invalidateQueries({ queryKey: ['brand', 'kits'] });
            queryClient.setQueryData(['brand', 'kit', created.id], created);
            refresh();
            navigate({ to: '/admin/brand-engine/kits/$kitId', params: { kitId: created.id } });
        },
        onError: () => toast.error('Failed to create'),
    });

    const deleteMutation = useMutation({
        mutationFn: () => brandKitApi.delete(kitId!),
        onSuccess: () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: ['brand', 'kit', kitId] }),
                queryClient.invalidateQueries({ queryKey: ['brand', 'kits'] }),
            ]).then(() => {
                toast.success('Brand Kit deleted');
                refresh();
                navigate({ to: '/admin/brand-engine' });
            }),
        onError: () => toast.error('Failed to delete'),
    });

    const handleSave = () => {
        const payload = {
            name: draft.name?.trim() || draft.brandName || 'New Brand Kit',
            brandName: draft.brandName || 'My App',
            tagline: draft.tagline || undefined,
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
        const isDefault = (kit.isDefault ?? false) || kit.organizationId === null;
        if (isDefault) return;
        if (window.confirm('Delete this Brand Kit? This cannot be undone.')) deleteMutation.mutate();
    };

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
            organizationId: null,
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
    const isDefaultKit = (kitForView.isDefault ?? false) || kitForView.organizationId === null;
    const saving = isNew ? createMutation.isPending : updateMutation.isPending;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
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

            <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
                <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof VALID_TABS)[number])} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 gap-1 sm:grid-cols-6 lg:w-auto lg:inline-flex lg:flex-wrap">
                        <TabsTrigger value="brand">
                            <IconBadge className="h-4 w-4 mr-2" />
                            Brand
                        </TabsTrigger>
                        <TabsTrigger value="logo">
                            <IconPhoto className="h-4 w-4 mr-2" />
                            Logo
                        </TabsTrigger>
                        <TabsTrigger value="colors">
                            <IconColorSwatch className="h-4 w-4 mr-2" />
                            Colors
                        </TabsTrigger>
                        <TabsTrigger value="theme">
                            <IconPalette className="h-4 w-4 mr-2" />
                            Theme
                        </TabsTrigger>
                        <TabsTrigger value="fonts">
                            <IconTypography className="h-4 w-4 mr-2" />
                            Fonts
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
                            onChange={(d) => setDraft((s) => ({ ...s, ...d }))}
                            nameReadOnly={!isNew && kitForView.organizationId === null}
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
                                onUploaded={(_, url) => {
                                    // Parent should refetch; we could also update local draft
                                    queryClient.invalidateQueries({ queryKey: ['brand', 'kit', kitId] });
                                }}
                            />
                        )}
                    </TabsContent>
                    <TabsContent value="colors">
                        <BrandKitColorsTab
                            tokensJson={draft.tokensJson}
                            onTokensChange={(v) => setDraft((s) => ({ ...s, tokensJson: v }))}
                        />
                    </TabsContent>
                    <TabsContent value="theme">
                        <BrandKitThemeTab
                            themePresetId={draft.themePresetId}
                            tokensJson={draft.tokensJson}
                            onThemePresetChange={(v) => setDraft((s) => ({ ...s, themePresetId: v }))}
                            onTokensChange={(v) => setDraft((s) => ({ ...s, tokensJson: v }))}
                        />
                    </TabsContent>
                    <TabsContent value="fonts">
                        <BrandKitFontsTab
                            tokensJson={draft.tokensJson}
                            themePresetId={draft.themePresetId}
                            onTokensChange={(v) => setDraft((s) => ({ ...s, tokensJson: v }))}
                        />
                    </TabsContent>
                    <TabsContent value="advanced">
                        <BrandKitAdvancedTab
                            defaultColorScheme={draft.defaultColorScheme}
                            allowDarkModeToggle={draft.allowDarkModeToggle}
                            customCss={draft.customCss}
                            hideOttabaseBranding={draft.hideOttabaseBranding}
                            onChange={(d) => setDraft((s) => ({ ...s, ...d }))}
                        />
                    </TabsContent>
                </Tabs>

                {/* Realtime preview – light and dark stacked */}
                <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
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
        </div>
    );
}
