// ---------------------------------------------------------------------------
// Assign menus to layout slots – sidebar-nav, header-nav, footer-nav, etc.
// ---------------------------------------------------------------------------

import { useBrand } from '@ottabase/brand-engine-react';
import { BUILT_IN_MENU_SLOTS } from '@ottabase/ottalayout';
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { menuSlotsApi, type MenuSlotAssignmentItem, type MenuSlotRenderType } from '../brand/brandApi';
import { menuApi, type MenuWithItemsDto } from './menuApi';

const RENDER_TYPES: MenuSlotRenderType[] = ['sidebar', 'flyout', 'mega', 'navbar', 'dropdown', 'footer'];

/** Stable empty arrays to avoid useEffect dependency churn (prevents infinite loop) */
const EMPTY_SLOTS: MenuSlotAssignmentItem[] = [];
const EMPTY_MENUS: MenuWithItemsDto[] = [];

function slotLabel(slot: string): string {
    return slot.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface AssignToSlotsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When set, pre-focus or highlight this menu (e.g. opened from a menu card) */
    preselectedMenuId?: string | null;
}

export function AssignToSlotsModal({ open, onOpenChange, preselectedMenuId }: AssignToSlotsModalProps) {
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const { data: assignmentsData, isLoading } = useQuery({
        queryKey: ['menu-slots', 'raw'],
        queryFn: () => menuSlotsApi.getRaw(),
        enabled: open,
    });
    const assignments = assignmentsData ?? EMPTY_SLOTS;

    const { data: menusData } = useQuery({
        queryKey: ['menus', 'list'],
        queryFn: () => menuApi.list(),
        enabled: open,
    });
    const menus = menusData ?? EMPTY_MENUS;

    const [items, setItems] = useState<MenuSlotAssignmentItem[]>([]);

    useEffect(() => {
        if (!open) return;
        const base = assignments.map((a) => ({
            slotName: a.slotName,
            menuId: a.menuId,
            renderType: (a.renderType ?? 'sidebar') as MenuSlotRenderType,
            sortOrder: a.sortOrder ?? 0,
        }));
        // When opened from a menu card, add that menu if not already assigned
        if (preselectedMenuId && menus.length) {
            const hasMenu = base.some((a) => a.menuId === preselectedMenuId);
            if (!hasMenu) {
                base.push({
                    slotName: 'sidebar-nav',
                    menuId: preselectedMenuId,
                    renderType: 'sidebar',
                    sortOrder: 0,
                });
            }
        }
        setItems(base);
    }, [open, assignments, preselectedMenuId, menus.length]);

    const putMutation = useMutation({
        mutationFn: (slots: MenuSlotAssignmentItem[]) => menuSlotsApi.put(slots),
        onSuccess: async () => {
            toast.success('Slot assignments saved');
            queryClient.invalidateQueries({ queryKey: ['menu-slots'] });
            await refresh();
            onOpenChange(false);
        },
        onError: () => toast.error('Failed to save slot assignments'),
    });

    const add = useCallback(() => {
        setItems((prev) => [
            ...prev,
            { slotName: BUILT_IN_MENU_SLOTS[0], menuId: menus[0]?.id ?? '', renderType: 'sidebar', sortOrder: 0 },
        ]);
    }, [menus]);

    const remove = useCallback((idx: number) => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const update = useCallback((idx: number, patch: Partial<MenuSlotAssignmentItem>) => {
        setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    }, []);

    const handleSave = useCallback(() => {
        const valid = items.filter((i) => i.slotName && i.menuId);
        if (valid.length !== items.length) {
            toast.error('Each assignment needs a slot and menu');
            return;
        }
        putMutation.mutate(valid);
    }, [items, putMutation]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Assign menus to slots</DialogTitle>
                    <DialogDescription>
                        Map menus to layout slots. Slots like sidebar-nav, header-nav, and footer-nav control where
                        menus appear in the app layout.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="space-y-2 py-4" aria-busy="true">
                        <span className="sr-only">Loading assignments...</span>
                        {Array.from({ length: 3 }, (_, index) => (
                            <div key={index} className="h-10 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col min-h-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Slot assignments
                            </Label>
                            <Button size="sm" variant="outline" onClick={add} disabled={menus.length === 0}>
                                <IconPlus className="h-4 w-4 mr-1" />
                                Add
                            </Button>
                        </div>

                        {menus.length === 0 ? (
                            <div className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
                                Create at least one menu before assigning slots.
                            </div>
                        ) : items.length === 0 ? (
                            <div className="rounded-xl bg-muted/40 py-8 text-center">
                                <p className="text-sm text-muted-foreground">No slot assignments yet.</p>
                                <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    Click Add to assign a menu to a layout slot (e.g. sidebar-nav, header-nav)
                                </p>
                                <Button size="sm" className="mt-3" onClick={add}>
                                    <IconPlus className="h-4 w-4 mr-1" />
                                    Add assignment
                                </Button>
                            </div>
                        ) : (
                            <div className="min-h-0 overflow-y-auto rounded-lg border border-border/60">
                                <table className="min-w-full text-sm">
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="bg-muted/40">
                                            <th className="px-3 py-2 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Slot
                                            </th>
                                            <th className="px-3 py-2 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Menu
                                            </th>
                                            <th className="px-3 py-2 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Render type
                                            </th>
                                            <th className="px-3 py-2 w-12" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {items.map((item, idx) => (
                                            <SlotRow
                                                key={idx}
                                                item={item}
                                                menus={menus}
                                                preselected={item.menuId === preselectedMenuId}
                                                onUpdate={(patch) => update(idx, patch)}
                                                onRemove={() => remove(idx)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4 flex justify-end gap-2 border-t border-border/60 pt-4">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={putMutation.isPending || menus.length === 0}>
                                {putMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function SlotRow({
    item,
    menus,
    preselected,
    onUpdate,
    onRemove,
}: {
    item: MenuSlotAssignmentItem;
    menus: MenuWithItemsDto[];
    preselected: boolean;
    onUpdate: (patch: Partial<MenuSlotAssignmentItem>) => void;
    onRemove: () => void;
}) {
    return (
        <tr
            className={`transition-colors duration-normal hover:bg-muted/40 ${preselected ? 'bg-background ring-1 ring-border' : ''}`}
        >
            <td className="px-3 py-2">
                <Select value={item.slotName} onValueChange={(v) => onUpdate({ slotName: v })}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {BUILT_IN_MENU_SLOTS.map((slot) => (
                            <SelectItem key={slot} value={slot}>
                                {slotLabel(slot)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </td>
            <td className="px-3 py-2">
                <Select value={item.menuId} onValueChange={(v) => onUpdate({ menuId: v })}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select menu" />
                    </SelectTrigger>
                    <SelectContent>
                        {menus.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                                <span className="flex items-center gap-2">
                                    {m.name}
                                    <Badge
                                        variant="secondary"
                                        className="rounded-full border-transparent bg-background text-[0.625rem] font-medium text-muted-foreground ring-1 ring-border"
                                    >
                                        {m.slug}
                                    </Badge>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </td>
            <td className="px-3 py-2">
                <Select
                    value={item.renderType}
                    onValueChange={(v) => onUpdate({ renderType: v as MenuSlotRenderType })}
                >
                    <SelectTrigger className="h-8 text-xs w-[120px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {RENDER_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                                {t}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </td>
            <td className="px-3 py-2">
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onRemove}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                    <IconTrash className="h-4 w-4" />
                </Button>
            </td>
        </tr>
    );
}
