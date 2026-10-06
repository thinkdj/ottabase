// ---------------------------------------------------------------------------
// Menus list: create, open a menu, see where each one is shown (Ottamenu)
// ---------------------------------------------------------------------------

import { useBrand } from '@ottabase/brand-engine-react';
import { ConfirmDialog, EmptyState, LoadingState } from '@ottabase/ui-components';
import {
    Badge,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@ottabase/ui-shadcn';
import { IconArrowRight, IconDotsVertical, IconMenu2, IconPlus, IconPuzzle } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { menuApi, type MenuWithItemsDto } from './menus/menuApi';
import { slotLabel, slotsForMenu } from './menus/menuSlots';

export function AdminMenusListPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { config } = useBrand();
    const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);

    const { data: menus = [], isLoading } = useQuery({
        queryKey: ['menus', 'list'],
        queryFn: () => menuApi.list(),
    });

    const deleteMutation = useMutation({
        meta: { entity: 'menus' },
        mutationFn: (id: string) => menuApi.delete(id),
        onSuccess: () => {
            toast.success('Menu deleted');
            queryClient.invalidateQueries({ queryKey: ['menus'] });
        },
        onError: () => toast.error('Failed to delete'),
    });

    if (isLoading) {
        return (
            <div className="space-y-8">
                <LoadingState kind="text" count={2} label="Loading menus" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <LoadingState kind="blocks" count={6} height="h-28" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Menus</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Navigation for the header, sidebar, footer and more. A menu shows up where its slots put it.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link to="/admin/appearance">
                            <IconPuzzle className="mr-2 h-4 w-4" />
                            Menu slots
                        </Link>
                    </Button>
                    <Button onClick={() => navigate({ to: '/admin/appearance/menus/new' })}>
                        <IconPlus className="mr-2 h-4 w-4" />
                        New menu
                    </Button>
                </div>
            </div>

            {menus.length === 0 ? (
                <EmptyState
                    icon={<IconMenu2 />}
                    title="No menus yet"
                    description="Make one, add its items, then assign it to a slot to replace the built-in navigation."
                    action={
                        <Button onClick={() => navigate({ to: '/admin/appearance/menus/new' })}>
                            <IconPlus className="mr-2 h-4 w-4" />
                            New menu
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {menus.map((menu) => (
                        <MenuCard
                            key={menu.id}
                            menu={menu}
                            slots={slotsForMenu(config?.menuSlots, menu.id)}
                            onDelete={() => setDeleteMenuId(menu.id)}
                            deleting={deleteMutation.isPending}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deleteMenuId !== null}
                onOpenChange={(open) => !open && setDeleteMenuId(null)}
                title="Delete this menu?"
                description="Its items go with it, and any slot showing it falls back to the built-in navigation."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={deleteMutation.isPending ? 'Deleting' : 'Delete'}
                onConfirm={() => (deleteMenuId ? deleteMutation.mutateAsync(deleteMenuId) : undefined)}
            />
        </div>
    );
}

function MenuCard({
    menu,
    slots,
    onDelete,
    deleting,
}: {
    menu: MenuWithItemsDto;
    slots: string[];
    onDelete: () => void;
    deleting: boolean;
}) {
    return (
        <Link
            to="/admin/appearance/menus/$menuId"
            params={{ menuId: menu.id }}
            className="group flex h-full flex-col rounded-xl bg-muted/40 p-4 outline-none transition-colors duration-normal hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="truncate text-[0.9375rem] font-semibold">{menu.name}</h3>
                    <p className="truncate font-mono text-xs text-muted-foreground">{menu.slug}</p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${menu.name}`}
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
                                onDelete();
                            }}
                            disabled={deleting}
                            className="text-destructive focus:text-destructive"
                        >
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {slots.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Not in a slot yet</span>
                ) : (
                    slots.map((slot) => (
                        <Badge key={slot} variant="secondary" className="rounded-full font-normal">
                            {slotLabel(slot)}
                        </Badge>
                    ))
                )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {menu.items.length} {menu.items.length === 1 ? 'item' : 'items'}
                </span>
                <IconArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
        </Link>
    );
}
