// ---------------------------------------------------------------------------
// Brand Kits list – live theme-specimen gallery. Each card renders inside the
// kit's own resolved theme (background, fonts, radius, shadows, colors) so the
// gallery reads like a brand board, not a data table. Create, clone, delete,
// navigate to detail.
// ---------------------------------------------------------------------------

import { buildCSSVarMap, buildPreviewTheme, injectFont } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@ottabase/ui-shadcn';
import {
    IconAlertTriangle,
    IconCopy,
    IconDotsVertical,
    IconGitBranch,
    IconPalette,
    IconPlus,
    IconRoute,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { brandKitApi, type BrandKitItem } from './brand/brandApi';

/**
 * Mini brand specimen rendered in the kit's OWN theme. The wrapper carries the
 * kit's resolved CSS variables, so every var() below (colors, fonts, radius,
 * shadows) resolves against the kit – the truthful preview is the design.
 */
function KitSpecimen({ kit, logoBaseUrl }: { kit: BrandKitItem; logoBaseUrl: string }) {
    // Honor the kit's default scheme so dark-first kits show as they ship
    const mode = kit.defaultColorScheme === 'dark' ? 'dark' : 'light';
    const theme = useMemo(
        () => buildPreviewTheme({ tokensJson: kit.tokensJson, themePresetId: kit.themePresetId }, mode),
        [kit.tokensJson, kit.themePresetId, mode],
    );
    const varMap = useMemo(() => buildCSSVarMap(theme), [theme]);

    // Load the kit's real fonts so the specimen is typographically honest
    useEffect(() => {
        const urls = [theme.typography?.heading?.url, theme.typography?.body?.url].filter((u): u is string =>
            Boolean(u),
        );
        urls.forEach((url) => injectFont(url));
    }, [theme.typography]);

    const base = logoBaseUrl.replace(/\/$/, '');
    const logoKey = mode === 'dark' ? (kit.logoDarkKey ?? kit.logoKey) : kit.logoKey;
    const logoUrl = base && logoKey ? `${base}/${logoKey}` : undefined;

    return (
        <div
            className="relative flex h-44 flex-col justify-between overflow-hidden p-4"
            style={
                {
                    ...varMap,
                    backgroundColor: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                } as React.CSSProperties
            }
        >
            {/* Soft primary wash – gives flat palettes some depth without lying */}
            <div
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
                style={{ backgroundColor: 'hsl(var(--primary) / 0.14)' }}
            />

            {/* Identity row: logo when uploaded, otherwise brand name in the heading face */}
            <div className="relative flex min-w-0 items-center">
                {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-6 max-w-[70%] object-contain object-left" />
                ) : (
                    <span
                        className="truncate text-sm font-semibold"
                        style={{
                            fontFamily: 'var(--font-heading)',
                            fontWeight: 'var(--typography-heading-weight, 600)' as React.CSSProperties['fontWeight'],
                        }}
                    >
                        {kit.brandName}
                    </span>
                )}
            </div>

            {/* Type specimen: heading + body faces */}
            <div className="relative min-w-0">
                <p
                    className="text-[1.75rem] leading-none"
                    style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 'var(--typography-heading-weight, 700)' as React.CSSProperties['fontWeight'],
                        letterSpacing: 'var(--typography-heading-spacing, normal)',
                    }}
                >
                    Ag
                </p>
                <p
                    className="mt-1.5 truncate text-xs"
                    style={{ fontFamily: 'var(--font-body)', color: 'hsl(var(--muted-foreground))' }}
                >
                    {kit.tagline || 'The quick brown fox jumps over the lazy dog'}
                </p>
            </div>

            {/* Component row: real primary button chip + palette dots, kit radius & shadow */}
            <div className="relative flex items-center justify-between gap-2">
                <span
                    className="inline-flex items-center px-2.5 py-1 text-[0.6875rem] font-medium"
                    style={{
                        backgroundColor: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary-foreground))',
                        borderRadius: 'calc(var(--radius) - 2px)',
                        boxShadow: 'var(--shadow-sm)',
                        fontFamily: 'var(--font-body)',
                    }}
                >
                    Button
                </span>
                <div className="flex items-center gap-1.5">
                    {['secondary', 'accent', 'muted', 'destructive'].map((token) => (
                        <span
                            key={token}
                            className="h-3.5 w-3.5 rounded-full border border-border"
                            style={{ backgroundColor: `hsl(var(--${token}))` }}
                            title={token}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function KitCard({
    kit,
    logoBaseUrl,
    onClone,
    onDelete,
    cloning,
    deleting,
}: {
    kit: BrandKitItem;
    logoBaseUrl: string;
    onClone: () => void;
    onDelete: () => void;
    cloning: boolean;
    deleting: boolean;
}) {
    const isDefaultKit = Boolean(kit.isDefault);
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
        <div className="group relative overflow-hidden rounded-xl ring-1 ring-border transition-shadow duration-normal hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
            {/* Stretched link – the whole card navigates; menu sits above it */}
            <Link
                to="/admin/appearance/brand-kits/$kitId"
                params={{ kitId: kit.id }}
                aria-label={`Edit ${kit.name}`}
                className="absolute inset-0 z-[1] rounded-[inherit] outline-none"
            />

            <KitSpecimen kit={kit} logoBaseUrl={logoBaseUrl} />

            {/* Meta strip – rendered in the ADMIN theme, on purpose */}
            <div className="flex items-center justify-between gap-2 border-t bg-card p-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-medium">{kit.name}</h3>
                        {isDefaultKit && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Default
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {kit.parentBrandKitName ? (
                            <>
                                <IconGitBranch className="h-3 w-3 shrink-0" />
                                <span className="truncate">Inherits {kit.parentBrandKitName}</span>
                            </>
                        ) : (
                            <span className="truncate capitalize">{kit.themePresetId || 'default'} preset</span>
                        )}
                        {!kit.appId && (
                            <span
                                className="ml-1 inline-flex shrink-0 items-center gap-0.5 text-warning"
                                title="This Brand Kit is not linked to any app (appId is null)"
                            >
                                <IconAlertTriangle className="h-3 w-3" />
                                No app
                            </span>
                        )}
                    </p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative z-[2] h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-normal focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label={`Actions for ${kit.name}`}
                        >
                            <IconDotsVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[3]">
                        <DropdownMenuItem onClick={onClone} disabled={cloning}>
                            <IconCopy className="mr-2 h-4 w-4" />
                            Clone
                        </DropdownMenuItem>
                        {!isDefaultKit && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setDeleteOpen(true)}
                                    disabled={deleting}
                                    className="text-destructive focus:text-destructive"
                                >
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete Brand Kit?"
                description={`This cannot be undone. The Brand Kit "${kit.name}" will be permanently deleted.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={deleting ? 'Deleting…' : 'Delete'}
                onConfirm={() => {
                    onDelete();
                    setDeleteOpen(false);
                }}
                confirmProps={{ disabled: deleting }}
                cancelProps={{ disabled: deleting }}
            />
        </div>
    );
}

/** Dashed tile at the end of the gallery – spatial "add" affordance */
function NewKitTile() {
    return (
        <Link
            to="/admin/appearance/brand-kits/new"
            className="group flex min-h-[13.75rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground outline-none transition-colors duration-normal hover:border-foreground/25 hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted transition-colors duration-normal group-hover:bg-background group-hover:ring-1 group-hover:ring-border">
                <IconPlus className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">New Brand Kit</span>
        </Link>
    );
}

export function AdminBrandKitsListPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { config } = useBrand();
    const logoBaseUrl = config?.r2PublicUrl ?? '';

    const { data: kits = [], isLoading } = useApiQuery<BrandKitItem[]>({
        entity: 'brand_kits',
        queryKey: ['list'],
        endpoint: '/api/brand/kits',
    });

    // Default kit leads the gallery; everything else keeps API order
    const sortedKits = useMemo(
        () => [...kits].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault))),
        [kits],
    );

    const cloneMutation = useMutation({
        meta: { entity: 'brand_kits' },
        mutationFn: ({ id, name }: { id: string; name?: string }) => brandKitApi.clone(id, name),
        onSuccess: (kit) => {
            toast.success('Brand Kit cloned');
            queryClient.invalidateQueries({ queryKey: ['brand_kits'] });
            navigate({ to: '/admin/appearance/brand-kits/$kitId', params: { kitId: kit.id } });
        },
        onError: () => toast.error('Failed to clone'),
    });

    const deleteMutation = useMutation({
        meta: { entity: 'brand_kits' },
        mutationFn: (id: string) => brandKitApi.delete(id),
        onSuccess: () => toast.success('Brand Kit deleted'),
        onError: () => toast.error('Failed to delete'),
    });

    if (isLoading) {
        return (
            <div className="space-y-8" aria-busy="true">
                <span className="sr-only">Loading Brand Kits...</span>
                <div className="flex items-center justify-between">
                    <div className="h-16 w-72 animate-pulse rounded-xl bg-muted/40" />
                    <div className="h-9 w-64 animate-pulse rounded-xl bg-muted/40" />
                </div>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16.5rem,1fr))]">
                    {Array.from({ length: 6 }, (_, index) => (
                        <div key={index} className="h-[13.75rem] animate-pulse rounded-xl bg-muted/40" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Brand Kits</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Each kit is a complete identity — logo, colors, type, and motion. Click a kit to edit it, or
                        clone one for variants.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button asChild variant="outline">
                        <Link to="/admin/appearance/layouts">
                            <IconRoute className="mr-2 h-4 w-4" />
                            Layouts &amp; routes
                        </Link>
                    </Button>
                    <Button onClick={() => navigate({ to: '/admin/appearance/brand-kits/new' })}>
                        <IconPlus className="mr-2 h-4 w-4" />
                        New Brand Kit
                    </Button>
                </div>
            </div>

            {kits.length === 0 ? (
                <div className="rounded-xl bg-muted/40 py-16 text-center">
                    <IconPalette className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm font-medium">No Brand Kits yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        A Brand Kit holds everything a look needs. Create one and it previews live as you design.
                    </p>
                    <Button className="mt-5" onClick={() => navigate({ to: '/admin/appearance/brand-kits/new' })}>
                        <IconPlus className="mr-2 h-4 w-4" />
                        Create your first Brand Kit
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16.5rem,1fr))]">
                    {sortedKits.map((kit) => (
                        <KitCard
                            key={kit.id}
                            kit={kit}
                            logoBaseUrl={logoBaseUrl}
                            onClone={() => cloneMutation.mutate({ id: kit.id, name: `${kit.name} – Copy` })}
                            onDelete={() => deleteMutation.mutate(kit.id)}
                            cloning={cloneMutation.isPending}
                            deleting={deleteMutation.isPending}
                        />
                    ))}
                    <NewKitTile />
                </div>
            )}
        </div>
    );
}
