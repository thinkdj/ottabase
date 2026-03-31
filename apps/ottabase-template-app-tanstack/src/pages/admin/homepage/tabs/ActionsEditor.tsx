/**
 * CRUD for `homepage_actions` scoped to one section (hero, cta).
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
    HOMEPAGE_ACTION_VARIANT_OPTIONS,
    HOMEPAGE_ICON_SELECT_NONE,
    HOMEPAGE_ICON_SLUGS,
    iconSlugToSelectValue,
    selectValueToIconSlug,
} from '../constants';
import { actionHooks, type HomepageActionRow } from '../homepage-model-hooks';
import { normalizeList } from '../utils';

type Props = {
    sectionId: string | undefined;
    title: string;
    description?: string;
};

export function ActionsEditor({ sectionId, title, description }: Props) {
    const queryClient = useQueryClient();
    const { data, isLoading } = actionHooks.useList(
        sectionId
            ? { where: { sectionId }, orderBy: 'sortOrder', orderDirection: 'asc' }
            : { orderBy: 'sortOrder', orderDirection: 'asc' },
        { ...ADMIN_LIST_QUERY_CONFIG, enabled: Boolean(sectionId) },
    );
    const createAction = actionHooks.useCreate();
    const updateAction = actionHooks.useUpdate();
    const deleteAction = actionHooks.useDelete();

    const rows = useMemo(() => normalizeList<HomepageActionRow>(data), [data]);

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries();
    }, [queryClient]);

    const handleAdd = useCallback(() => {
        if (!sectionId) return;
        const maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), -1);
        createAction.mutate(
            {
                sectionId,
                label: 'New button',
                href: '/',
                variant: 'default',
                icon: null,
                isExternal: false,
                sortOrder: maxOrder + 1,
            },
            {
                onSuccess: () => {
                    toast.success('Action added');
                    invalidate();
                },
                onError: () => toast.error('Failed to add action'),
            },
        );
    }, [sectionId, rows, createAction, invalidate]);

    const handleDelete = useCallback(
        (id: string) => {
            deleteAction.mutate(id, {
                onSuccess: () => {
                    toast.success('Action removed');
                    invalidate();
                },
                onError: () => toast.error('Failed to delete'),
            });
        },
        [deleteAction, invalidate],
    );

    const handleUpdate = useCallback(
        (id: string, data: Partial<HomepageActionRow>) => {
            updateAction.mutate(
                { id, data },
                {
                    onSuccess: () => {
                        toast.success('Saved');
                        invalidate();
                    },
                    onError: () => toast.error('Failed to save'),
                },
            );
        },
        [updateAction, invalidate],
    );

    if (!sectionId) {
        return (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                Seed defaults or create the section first.
            </p>
        );
    }

    return (
        <Card className="border-border dark:border-border">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description ? (
                    <CardDescription className="dark:text-muted-foreground">{description}</CardDescription>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading && (
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">Loading actions…</p>
                )}
                {!isLoading && rows.length === 0 && (
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">No actions yet.</p>
                )}
                {rows.map((row) => (
                    <ActionRowForm
                        key={row.id}
                        row={row}
                        onSave={(patch) => handleUpdate(row.id, patch)}
                        onDelete={() => handleDelete(row.id)}
                        busy={updateAction.isPending || deleteAction.isPending}
                    />
                ))}
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAdd}
                    disabled={createAction.isPending || !sectionId}
                >
                    <IconPlus className="mr-2 size-4" aria-hidden />
                    Add action
                </Button>
            </CardContent>
        </Card>
    );
}

function ActionRowForm({
    row,
    onSave,
    onDelete,
    busy,
}: {
    row: HomepageActionRow;
    onSave: (patch: Partial<HomepageActionRow>) => void;
    onDelete: () => void;
    busy: boolean;
}) {
    return (
        <div className="grid gap-3 rounded-lg border border-border p-3 dark:border-border md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Label</Label>
                <Input
                    key={`${row.id}-label`}
                    defaultValue={row.label}
                    className="dark:border-border"
                    onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== row.label) onSave({ label: v });
                    }}
                />
            </div>
            <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Href</Label>
                <Input
                    key={`${row.id}-href`}
                    defaultValue={row.href}
                    className="font-mono text-sm dark:border-border"
                    onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== row.href) onSave({ href: v });
                    }}
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs">Variant</Label>
                <Select value={row.variant ?? 'default'} onValueChange={(v) => onSave({ variant: v })} disabled={busy}>
                    <SelectTrigger className="dark:border-border">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {HOMEPAGE_ACTION_VARIANT_OPTIONS.map((v) => (
                            <SelectItem key={v} value={v}>
                                {v}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs">Icon (optional)</Label>
                <Select
                    value={iconSlugToSelectValue(row.icon)}
                    onValueChange={(v) => onSave({ icon: selectValueToIconSlug(v) })}
                    disabled={busy}
                >
                    <SelectTrigger className="dark:border-border">
                        <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={HOMEPAGE_ICON_SELECT_NONE}>None</SelectItem>
                        {HOMEPAGE_ICON_SLUGS.map((v) => (
                            <SelectItem key={v} value={v}>
                                {v}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-end gap-2 pb-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`ext-${row.id}`}
                        checked={Boolean(row.isExternal)}
                        onCheckedChange={(c) => onSave({ isExternal: Boolean(c) })}
                        disabled={busy}
                    />
                    <Label htmlFor={`ext-${row.id}`} className="text-xs font-normal">
                        External link
                    </Label>
                </div>
            </div>
            <div className="flex items-end justify-end gap-2 md:col-span-2 lg:col-span-3">
                <Button type="button" variant="ghost" size="sm" onClick={onDelete} disabled={busy}>
                    <IconTrash className="mr-1 size-4" aria-hidden />
                    Remove
                </Button>
            </div>
        </div>
    );
}
