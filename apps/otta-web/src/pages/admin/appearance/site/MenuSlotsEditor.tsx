/**
 * Which menu fills each layout slot (header, sidebar, footer and so on) and how it renders.
 */
import { BUILT_IN_MENU_SLOTS } from '@ottabase/ottalayout';
import { EmptyState } from '@ottabase/ui-components';
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ottabase/ui-shadcn';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { MenuSlotAssignmentItem, MenuSlotRenderType } from '../brand/brandApi';
import type { MenuWithItemsDto } from '../menus/menuApi';
import { slotLabel } from '../menus/menuSlots';

const RENDER_TYPES: MenuSlotRenderType[] = ['sidebar', 'flyout', 'mega', 'navbar', 'dropdown', 'footer'];
const th = 'px-3 py-2 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

export function MenuSlotsEditor({
    value,
    menus,
    onChange,
}: {
    value: MenuSlotAssignmentItem[];
    menus: MenuWithItemsDto[];
    onChange: (next: MenuSlotAssignmentItem[]) => void;
}) {
    const update = (idx: number, patch: Partial<MenuSlotAssignmentItem>) =>
        onChange(value.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    const add = () =>
        onChange([
            ...value,
            {
                slotName: BUILT_IN_MENU_SLOTS[0],
                menuId: menus[0]?.id ?? '',
                renderType: 'navbar',
                sortOrder: value.length,
            },
        ]);

    if (menus.length === 0) {
        return (
            <p className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
                Make a menu first; then it can fill a slot here.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {value.length === 0 ? (
                <EmptyState
                    compact
                    title="The built-in navigation fills every slot."
                    description="Put a menu in a slot to replace it."
                />
            ) : (
                <div className="overflow-x-auto rounded-lg bg-background ring-1 ring-border">
                    <table className="min-w-full text-sm">
                        <thead className="bg-muted/40">
                            <tr>
                                <th className={th}>Slot</th>
                                <th className={th}>Menu</th>
                                <th className={th}>Shown as</th>
                                <th className="w-12 px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {value.map((item, idx) => (
                                <tr key={idx} className="transition-colors duration-normal hover:bg-muted/40">
                                    <td className="px-3 py-2">
                                        <Select
                                            value={item.slotName}
                                            onValueChange={(v) => update(idx, { slotName: v })}
                                        >
                                            <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Slot">
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
                                        <Select value={item.menuId} onValueChange={(v) => update(idx, { menuId: v })}>
                                            <SelectTrigger className="h-8 w-[200px] text-xs" aria-label="Menu">
                                                <SelectValue placeholder="Choose a menu" />
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
                                                                {m.items.length} items
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
                                            onValueChange={(v) => update(idx, { renderType: v as MenuSlotRenderType })}
                                        >
                                            <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Shown as">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {RENDER_TYPES.map((t) => (
                                                    <SelectItem key={t} value={t} className="capitalize">
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
                                            aria-label="Remove from slot"
                                            onClick={() => onChange(value.filter((_, i) => i !== idx))}
                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                        >
                                            <IconTrash className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Button size="sm" variant="outline" onClick={add}>
                <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                Put a menu in a slot
            </Button>
        </div>
    );
}
