// ---------------------------------------------------------------------------
// Brand Kits list – Create, Clone, navigate to detail
// ---------------------------------------------------------------------------

import { useApiQuery } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@ottabase/ui-shadcn';
import {
    IconAlertTriangle,
    IconArrowRight,
    IconCopy,
    IconDotsVertical,
    IconGitBranch,
    IconPalette,
    IconPlus,
    IconSettings2,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { brandKitApi, type BrandKitItem } from './brand/brandApi';

/** Tokens sampled for the kit-card color preview, in display order */
const SWATCH_TOKENS = ['primary', 'secondary', 'accent', 'muted', 'background'];

/** Convert HSL channel string "221 83% 53%" to CSS hsl(); null when unparseable */
function hslToCss(hsl: string): string | null {
    const base = hsl.split('/')[0].trim();
    const parts = base
        .split(/\s+/)
        .map((v) => parseFloat(v))
        .filter((n) => !Number.isNaN(n));
    if (parts.length < 3) return null;
    return `hsl(${parts[0]}, ${parts[1]}%, ${parts[2]}%)`;
}

/** Extract preview swatch colors from a kit's tokensJson (light palette) */
function kitSwatches(tokensJson?: string | null): string[] {
    if (!tokensJson) return [];
    try {
        const parsed = JSON.parse(tokensJson) as { color?: { light?: Record<string, string> } };
        const light = parsed.color?.light ?? {};
        return SWATCH_TOKENS.map((token) => light[token])
            .filter((v): v is string => Boolean(v))
            .map(hslToCss)
            .filter((v): v is string => v !== null);
    } catch {
        return [];
    }
}

export function AdminBrandKitsListPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: kits = [], isLoading } = useApiQuery<BrandKitItem[]>({
        entity: 'brand_kits',
        queryKey: ['list'],
        endpoint: '/api/brand/kits',
    });

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
                <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => (
                        <div key={index} className="h-36 animate-pulse rounded-xl bg-muted/40" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Brand Kits</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Self-contained identity, logos, colors, fonts, and theme. Create and clone for variants.
                    </p>
                </div>
                <Button onClick={() => navigate({ to: '/admin/appearance/brand-kits/new' })}>
                    <IconPlus className="h-4 w-4 mr-2" />
                    Create Brand Kit
                </Button>
            </div>

            <Link
                to="/admin/appearance/layouts"
                className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal group-hover:bg-muted/70">
                    <CardHeader className="gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border transition-colors group-hover:text-foreground">
                            <IconSettings2 className="h-[1.125rem] w-[1.125rem]" />
                        </span>
                        <CardTitle className="text-[0.9375rem] font-semibold">Route mappings</CardTitle>
                        <CardDescription className="leading-relaxed">
                            Map paths to layouts and Brand Kits. Configure which layout and brand apply per route.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                            Edit layouts &amp; mappings
                            <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                    </CardContent>
                </Card>
            </Link>

            <section className="space-y-4">
                <div className="space-y-1">
                    <h2 className="text-[0.9375rem] font-semibold">Your Brand Kits</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {kits.length === 0
                            ? 'No Brand Kits yet. Create one to get started.'
                            : 'Click a kit to edit. Clone to create variants (e.g. seasonal).'}
                    </p>
                </div>
                {kits.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <IconPalette className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-4 text-sm text-muted-foreground">No Brand Kits</p>
                        <Button className="mt-4" onClick={() => navigate({ to: '/admin/appearance/brand-kits/new' })}>
                            <IconPlus className="h-4 w-4 mr-2" />
                            Create your first Brand Kit
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {kits.map((kit) => (
                            <KitCard
                                key={kit.id}
                                kit={kit}
                                onClone={() => cloneMutation.mutate({ id: kit.id, name: `${kit.name} – Copy` })}
                                onDelete={() => deleteMutation.mutate(kit.id)}
                                cloning={cloneMutation.isPending}
                                deleting={deleteMutation.isPending}
                                isDefault={Boolean(kit.isDefault)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function KitCard({
    kit,
    onClone,
    onDelete,
    cloning,
    deleting,
    isDefault,
}: {
    kit: BrandKitItem;
    onClone: () => void;
    onDelete: () => void;
    cloning: boolean;
    deleting: boolean;
    isDefault?: boolean;
}) {
    const isDefaultKit = Boolean(isDefault ?? kit.isDefault);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const swatches = kitSwatches(kit.tokensJson);

    return (
        <Link
            to="/admin/appearance/brand-kits/$kitId"
            params={{ kitId: kit.id }}
            className="group flex h-full flex-col rounded-xl bg-muted/40 p-4 outline-none transition-colors duration-normal hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-[0.9375rem] font-semibold">{kit.name}</h3>
                        {isDefaultKit && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                                Default
                            </span>
                        )}
                        {!kit.appId && (
                            <span
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-warning ring-1 ring-border"
                                title="This Brand Kit is not linked to any app (appId is null)"
                            >
                                <IconAlertTriangle className="h-3 w-3" />
                                No App
                            </span>
                        )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{kit.brandName}</p>
                    {kit.parentBrandKitName && (
                        <p className="flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            <IconGitBranch className="h-3 w-3" />
                            Inherits from {kit.parentBrandKitName}
                        </p>
                    )}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 opacity-0 transition-colors group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <IconDotsVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.preventDefault();
                                onClone();
                            }}
                            disabled={cloning}
                        >
                            <IconCopy className="h-4 w-4 mr-2" />
                            Clone
                        </DropdownMenuItem>
                        {!isDefaultKit && (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.preventDefault();
                                    setDeleteOpen(true);
                                }}
                                disabled={deleting}
                                className="text-destructive focus:text-destructive"
                            >
                                Delete
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {swatches.length > 0 && (
                <div className="mt-3 flex gap-1.5">
                    {swatches.map((color, i) => (
                        <span
                            key={i}
                            className="h-4 w-4 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
                <span className="truncate text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    Preset: {kit.themePresetId || 'default'}
                </span>
                <IconArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
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
        </Link>
    );
}
