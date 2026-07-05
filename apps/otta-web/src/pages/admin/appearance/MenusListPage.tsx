// ---------------------------------------------------------------------------
// Menus list – Create, navigate to detail, assign to slots (Ottamenu)
// ---------------------------------------------------------------------------

import { ConfirmDialog } from '@ottabase/ui-components';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ottabase/ui-shadcn';
import { IconArrowRight, IconDotsVertical, IconMenu2, IconPlus, IconPuzzle } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { AssignToSlotsModal } from './menus/AssignToSlotsModal';
import { menuApi, type MenuWithItemsDto } from './menus/menuApi';

export function AdminMenusListPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [slotsModalOpen, setSlotsModalOpen] = useState(false);
    const [slotsModalMenuId, setSlotsModalMenuId] = useState<string | null>(null);
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

    const openSlotsModal = (menuId?: string) => {
        setSlotsModalMenuId(menuId ?? null);
        setSlotsModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="space-y-8" aria-busy="true">
                <span className="sr-only">Loading menus...</span>
                <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => (
                        <div key={index} className="h-28 animate-pulse rounded-xl bg-muted/40" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Menus</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Define navigation menus (sidebar, header, etc.). Assign to slots or use static nav links.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openSlotsModal()}>
                        <IconPuzzle className="h-4 w-4 mr-2" />
                        Assign to slots
                    </Button>
                    <Button onClick={() => navigate({ to: '/admin/appearance/menus/new' })}>
                        <IconPlus className="h-4 w-4 mr-2" />
                        Create Menu
                    </Button>
                </div>
            </div>

            <AssignToSlotsModal
                open={slotsModalOpen}
                onOpenChange={setSlotsModalOpen}
                preselectedMenuId={slotsModalMenuId}
            />

            <section className="space-y-4">
                <div className="space-y-1">
                    <h2 className="text-[0.9375rem] font-semibold">Your Menus</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {menus.length === 0
                            ? 'No menus yet. Create one and assign to slots to override default nav.'
                            : 'Click a menu to edit items. Use slug "sidebar" for main sidebar nav.'}
                    </p>
                </div>
                {menus.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <IconMenu2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-4 text-sm text-muted-foreground">No menus</p>
                        <Button className="mt-4" onClick={() => navigate({ to: '/admin/appearance/menus/new' })}>
                            <IconPlus className="h-4 w-4 mr-2" />
                            Create your first menu
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {menus.map((menu) => (
                            <MenuCard
                                key={menu.id}
                                menu={menu}
                                onAssignToSlots={() => openSlotsModal(menu.id)}
                                onDelete={() => setDeleteMenuId(menu.id)}
                                deleting={deleteMutation.isPending}
                            />
                        ))}
                    </div>
                )}
            </section>

            <ConfirmDialog
                open={deleteMenuId !== null}
                onOpenChange={(open) => !open && setDeleteMenuId(null)}
                title="Delete Menu?"
                description="All items in this menu will be removed. This action cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                onConfirm={() => {
                    if (deleteMenuId) deleteMutation.mutate(deleteMenuId);
                    setDeleteMenuId(null);
                }}
                confirmProps={{ disabled: deleteMutation.isPending }}
                cancelProps={{ disabled: deleteMutation.isPending }}
            />
        </div>
    );
}

function MenuCard({
    menu,
    onAssignToSlots,
    onDelete,
    deleting,
}: {
    menu: MenuWithItemsDto;
    onAssignToSlots: () => void;
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
                <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 className="truncate text-[0.9375rem] font-semibold">{menu.name}</h3>
                    <span className="inline-flex max-w-full items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border">
                        <span className="truncate">{menu.slug}</span>
                    </span>
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
                                e.stopPropagation();
                                onAssignToSlots();
                            }}
                        >
                            <IconPuzzle className="h-4 w-4 mr-2" />
                            Assign to slots
                        </DropdownMenuItem>
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
            <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {menu.items.length} items
                </span>
                <IconArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
        </Link>
    );
}
