// ---------------------------------------------------------------------------
// Menus list – Create, navigate to detail (Ottamenu)
// ---------------------------------------------------------------------------

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
import { IconDotsVertical, IconMenu2, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { menuApi, type MenuWithItemsDto } from './menus/menuApi';

export function AdminMenusListPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

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
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading menus...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Menus</h1>
                    <p className="text-muted-foreground mt-1">
                        Define navigation menus (sidebar, header, etc.). Default fallback is static nav links.
                    </p>
                </div>
                <Button onClick={() => navigate({ to: '/admin/menus/new' })}>
                    <IconPlus className="h-4 w-4 mr-2" />
                    Create Menu
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Your Menus</CardTitle>
                    <CardDescription>
                        {menus.length === 0
                            ? 'No menus yet. Create one (e.g. slug: sidebar) to override default nav.'
                            : 'Click a menu to edit items. Use slug "sidebar" for main sidebar nav.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {menus.length === 0 ? (
                        <div className="rounded-lg border border-dashed py-12 text-center">
                            <IconMenu2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-4 text-muted-foreground">No menus</p>
                            <Button className="mt-4" onClick={() => navigate({ to: '/admin/menus/new' })}>
                                <IconPlus className="h-4 w-4 mr-2" />
                                Create your first menu
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {menus.map((menu) => (
                                <MenuCard
                                    key={menu.id}
                                    menu={menu}
                                    onDelete={() => {
                                        if (window.confirm('Delete this menu? All items will be removed.')) {
                                            deleteMutation.mutate(menu.id);
                                        }
                                    }}
                                    deleting={deleteMutation.isPending}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function MenuCard({ menu, onDelete, deleting }: { menu: MenuWithItemsDto; onDelete: () => void; deleting: boolean }) {
    return (
        <Link
            to="/admin/menus/$menuId"
            params={{ menuId: menu.id }}
            className="group flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/5 dark:border-muted"
        >
            <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-semibold truncate">{menu.name}</h3>
                    <p className="text-sm text-muted-foreground">slug: {menu.slug}</p>
                    <p className="text-xs text-muted-foreground">{menu.items.length} items</p>
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
                                if (window.confirm('Delete this menu? All items will be removed.')) onDelete();
                            }}
                            disabled={deleting}
                            className="text-destructive focus:text-destructive"
                        >
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </Link>
    );
}
