// ---------------------------------------------------------------------------
// Brand Kits list – Create, Clone, navigate to detail
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
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
import { IconCopy, IconDotsVertical, IconPlus, IconPalette, IconSettings2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { brandKitApi, layoutApi, type BrandKitItem } from './brand/brandApi';

export function AdminBrandKitsListPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: kits = [], isLoading } = useQuery<BrandKitItem[]>({
        queryKey: ['brand', 'kits'],
        queryFn: () => brandKitApi.list(),
    });

    const createMutation = useMutation({
        mutationFn: () => brandKitApi.create({ name: 'New Brand Kit', brandName: 'My App' }),
        onSuccess: (kit) => {
            toast.success('Brand Kit created');
            queryClient.invalidateQueries({ queryKey: ['brand', 'kits'] });
            // Prime cache so detail page has data immediately (avoids GET 404 race with D1)
            queryClient.setQueryData(['brand', 'kit', kit.id], kit);
            navigate({ to: '/admin/brand-engine/kits/$kitId', params: { kitId: kit.id } });
        },
        onError: () => toast.error('Failed to create'),
    });

    const cloneMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name?: string }) => brandKitApi.clone(id, name),
        onSuccess: (kit) => {
            toast.success('Brand Kit cloned');
            queryClient.invalidateQueries({ queryKey: ['brand', 'kits'] });
            queryClient.setQueryData(['brand', 'kit', kit.id], kit);
            navigate({ to: '/admin/brand-engine/kits/$kitId', params: { kitId: kit.id } });
        },
        onError: () => toast.error('Failed to clone'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => brandKitApi.delete(id),
        onSuccess: () => {
            toast.success('Brand Kit deleted');
            queryClient.invalidateQueries({ queryKey: ['brand', 'kits'] });
        },
        onError: () => toast.error('Failed to delete'),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading Brand Kits...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Brand Kits</h1>
                    <p className="text-muted-foreground mt-1">
                        Self-contained identity, logos, colors, fonts, and theme. Create and clone for variants.
                    </p>
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                    <IconPlus className="h-4 w-4 mr-2" />
                    Create Brand Kit
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Route mappings</CardTitle>
                    <CardDescription>
                        Map paths to layouts and Brand Kits. Configure which layout and brand apply per route.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link to="/admin/brand-engine/layouts">
                        <Button variant="outline">
                            <IconSettings2 className="h-4 w-4 mr-2" />
                            Edit layouts & mappings
                        </Button>
                    </Link>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Your Brand Kits</CardTitle>
                    <CardDescription>
                        {kits.length === 0
                            ? 'No Brand Kits yet. Create one to get started.'
                            : 'Click a kit to edit. Clone to create variants (e.g. seasonal).'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {kits.length === 0 ? (
                        <div className="rounded-lg border border-dashed py-12 text-center">
                            <IconPalette className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-4 text-muted-foreground">No Brand Kits</p>
                            <Button
                                className="mt-4"
                                onClick={() => createMutation.mutate()}
                                disabled={createMutation.isPending}
                            >
                                <IconPlus className="h-4 w-4 mr-2" />
                                Create your first Brand Kit
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {kits.map((kit) => (
                                <KitCard
                                    key={kit.id}
                                    kit={kit}
                                    onClone={() => cloneMutation.mutate({ id: kit.id, name: `${kit.name} – Copy` })}
                                    onDelete={() => deleteMutation.mutate(kit.id)}
                                    cloning={cloneMutation.isPending}
                                    deleting={deleteMutation.isPending}
                                    isDefault={kit.organizationId === null}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
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
    return (
        <Link
            to="/admin/brand-engine/kits/$kitId"
            params={{ kitId: kit.id }}
            className="group flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/5 dark:border-muted"
        >
            <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{kit.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{kit.brandName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Preset: {kit.themePresetId || 'default'}</p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
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
                        {!isDefault && (
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (window.confirm('Delete this Brand Kit? This cannot be undone.')) onDelete();
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
        </Link>
    );
}
