/**
 * CRUD for `homepage_features` scoped to the features section.
 * Each row uses local draft state; changes persist only when that row's Save is clicked.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@ottabase/ui-shadcn';
import { IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    HOMEPAGE_ICON_SELECT_NONE,
    HOMEPAGE_ICON_SLUGS,
    iconSlugToSelectValue,
    selectValueToIconSlug,
} from '../constants';
import { featureHooks, type HomepageFeatureRow } from '../homepage-model-hooks';
import { normalizeList } from '../utils';

type Props = {
    sectionId: string | undefined;
};

function FeatureRowDraft({
    row,
    onSave,
    onDelete,
    saving,
    deleting,
}: {
    row: HomepageFeatureRow;
    onSave: (data: { title: string; description: string; icon: string | null }) => void;
    onDelete: () => void;
    saving: boolean;
    deleting: boolean;
}) {
    const [title, setTitle] = useState(row.title);
    const [description, setDescription] = useState(row.description);
    const [iconSelect, setIconSelect] = useState(() => iconSlugToSelectValue(row.icon));

    useEffect(() => {
        setTitle(row.title);
        setDescription(row.description);
        setIconSelect(iconSlugToSelectValue(row.icon));
    }, [row.id, row.title, row.description, row.icon]);

    const dirty = useMemo(() => {
        const iconDb = selectValueToIconSlug(iconSelect);
        return (
            title.trim() !== row.title.trim() ||
            description.trim() !== row.description.trim() ||
            (iconDb ?? null) !== (row.icon ?? null)
        );
    }, [title, description, iconSelect, row.title, row.description, row.icon]);

    const handleSave = () => {
        const t = title.trim();
        const d = description.trim();
        if (!t || !d) {
            toast.error('Title and description are required');
            return;
        }
        onSave({ title: t, description: d, icon: selectValueToIconSlug(iconSelect) });
    };

    return (
        <div className="grid gap-3 rounded-lg border border-border p-3 dark:border-border md:grid-cols-2">
            <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="dark:border-border" />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs">Icon (optional)</Label>
                <Select value={iconSelect} onValueChange={setIconSelect}>
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
            <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="dark:border-border"
                />
            </div>
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleSave} disabled={saving || !dirty}>
                    <IconDeviceFloppy className="mr-1 size-4" aria-hidden />
                    {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onDelete} disabled={deleting}>
                    <IconTrash className="mr-1 size-4" aria-hidden />
                    Remove
                </Button>
            </div>
        </div>
    );
}

export function FeaturesEditor({ sectionId }: Props) {
    const queryClient = useQueryClient();
    const [pendingRowId, setPendingRowId] = useState<string | null>(null);
    const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
    const { data, isLoading } = featureHooks.useList(
        sectionId
            ? { where: { sectionId }, orderBy: 'sortOrder', orderDirection: 'asc' }
            : { orderBy: 'sortOrder', orderDirection: 'asc' },
        { ...ADMIN_LIST_QUERY_CONFIG, enabled: Boolean(sectionId) },
    );
    const createFeature = featureHooks.useCreate();
    const updateFeature = featureHooks.useUpdate();
    const deleteFeature = featureHooks.useDelete();

    const rows = useMemo(() => normalizeList<HomepageFeatureRow>(data), [data]);

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries();
    }, [queryClient]);

    const handleAdd = useCallback(() => {
        if (!sectionId) return;
        const maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), -1);
        createFeature.mutate(
            {
                sectionId,
                title: 'New feature',
                description: 'Description',
                icon: null,
                sortOrder: maxOrder + 1,
            },
            {
                onSuccess: () => {
                    toast.success('Feature added — edit and click Save on the row');
                    invalidate();
                },
                onError: () => toast.error('Failed to add feature'),
            },
        );
    }, [sectionId, rows, createFeature, invalidate]);

    const handleSaveRow = useCallback(
        (id: string, data: { title: string; description: string; icon: string | null }) => {
            setPendingRowId(id);
            updateFeature.mutate(
                { id, data },
                {
                    onSettled: () => setPendingRowId(null),
                    onSuccess: () => {
                        toast.success('Feature saved');
                        invalidate();
                    },
                    onError: () => toast.error('Failed to save'),
                },
            );
        },
        [updateFeature, invalidate],
    );

    const handleDelete = useCallback(
        (id: string) => {
            setDeletingRowId(id);
            deleteFeature.mutate(id, {
                onSettled: () => setDeletingRowId(null),
                onSuccess: () => {
                    toast.success('Feature removed');
                    invalidate();
                },
                onError: () => toast.error('Failed to delete'),
            });
        },
        [deleteFeature, invalidate],
    );

    if (!sectionId) {
        return (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                Seed defaults or create the features section first.
            </p>
        );
    }

    return (
        <Card className="border-border dark:border-border">
            <CardHeader>
                <CardTitle>Feature items</CardTitle>
                <CardDescription className="dark:text-muted-foreground">
                    Edit fields, then click Save on each row. Nothing is stored until you save.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading && <p className="text-sm text-muted-foreground dark:text-muted-foreground">Loading…</p>}
                {!isLoading && rows.length === 0 && (
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">No features yet.</p>
                )}
                {rows.map((row) => (
                    <FeatureRowDraft
                        key={row.id}
                        row={row}
                        onSave={(data) => handleSaveRow(row.id, data)}
                        onDelete={() => handleDelete(row.id)}
                        saving={pendingRowId === row.id}
                        deleting={deletingRowId === row.id}
                    />
                ))}
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAdd}
                    disabled={createFeature.isPending}
                >
                    <IconPlus className="mr-2 size-4" aria-hidden />
                    Add feature
                </Button>
            </CardContent>
        </Card>
    );
}
