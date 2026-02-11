import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { LayoutComponentKey, LayoutTemplateItem, LayoutMappingItem } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { layoutApi } from './brandApi';

const COMPONENT_KEYS: LayoutComponentKey[] = ['homepage', 'app-shell', 'docs', 'minimal'];

export function LayoutEditorTab() {
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const { data: templates = [], isLoading: loadingTemplates } = useQuery<LayoutTemplateItem[]>({
        queryKey: ['brand', 'layouts'],
        queryFn: () => layoutApi.getTemplates() as Promise<LayoutTemplateItem[]>,
    });

    const { data: mappings = [], isLoading: loadingMappings } = useQuery<LayoutMappingItem[]>({
        queryKey: ['brand', 'mappings'],
        queryFn: () => layoutApi.getMappings() as Promise<LayoutMappingItem[]>,
    });

    const putMappingsMutation = useMutation({
        mutationFn: layoutApi.putMappings,
        onSuccess: () => {
            toast.success('Mappings saved');
            queryClient.invalidateQueries({ queryKey: ['brand', 'mappings'] });
            refresh();
        },
        onError: () => toast.error('Failed to save mappings'),
    });

    if (loadingTemplates || loadingMappings) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading layouts...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Layout templates</CardTitle>
                    <CardDescription>
                        Define layout presets (component + config). Route mappings decide which layout applies per path.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <CreateTemplateDialog templates={templates} />
                        {templates.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">
                                No layout templates. Create one to map routes.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {templates.map((t) => (
                                    <div key={t.id} className="flex items-center justify-between rounded-lg border p-4">
                                        <div>
                                            <span className="font-medium">{t.name}</span>
                                            <span className="ml-2 text-xs text-muted-foreground font-mono">
                                                {t.componentKey}
                                            </span>
                                        </div>
                                        <EditTemplateDialog template={t} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Route mappings</CardTitle>
                    <CardDescription>
                        Match URL paths to layout templates. Higher priority wins. Use * for wildcard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MappingsEditor
                        mappings={mappings}
                        templates={templates}
                        onSave={(m) =>
                            putMappingsMutation.mutate({
                                mappings: m.map(({ pathPattern, layoutTemplateId, priority }) => ({
                                    pathPattern,
                                    layoutTemplateId,
                                    priority: priority ?? 0,
                                })),
                            })
                        }
                        saving={putMappingsMutation.isPending}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

function CreateTemplateDialog({ templates }: { templates: LayoutTemplateItem[] }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [componentKey, setComponentKey] = useState<LayoutComponentKey>('app-shell');
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const putMutation = useMutation({
        mutationFn: (body: { name: string; componentKey: string; config: object }) => layoutApi.putTemplate(body),
        onSuccess: () => {
            toast.success('Template created');
            queryClient.invalidateQueries({ queryKey: ['brand', 'layouts'] });
            refresh();
            setName('');
            setOpen(false);
        },
        onError: () => toast.error('Failed to create'),
    });

    const defaultConfigs: Record<LayoutComponentKey, object> = {
        homepage: { header: 'minimal', navigation: 'topbar', contentWidth: 'full', footer: true, density: 'comfy' },
        'app-shell': {
            header: 'topbar',
            navigation: 'sidebar',
            contentWidth: 'fluid',
            footer: false,
            density: 'comfy',
        },
        docs: { header: 'topbar', navigation: 'sidebar', contentWidth: 'fixed', footer: true, density: 'compact' },
        minimal: { header: 'none', navigation: 'topbar', contentWidth: 'full', footer: false, density: 'comfy' },
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <IconPlus className="h-4 w-4 mr-2" />
                    New template
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create layout template</DialogTitle>
                    <DialogDescription>Add a layout preset for route mappings.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="layoutName">Name</Label>
                        <Input
                            id="layoutName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Main App Shell"
                        />
                    </div>
                    <div>
                        <Label>Component</Label>
                        <Select value={componentKey} onValueChange={(v) => setComponentKey(v as LayoutComponentKey)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COMPONENT_KEYS.map((k) => (
                                    <SelectItem key={k} value={k}>
                                        {k}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={() =>
                            putMutation.mutate({
                                name: name.trim() || componentKey,
                                componentKey,
                                config: defaultConfigs[componentKey],
                            })
                        }
                        disabled={putMutation.isPending}
                    >
                        {putMutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EditTemplateDialog({ template }: { template: LayoutTemplateItem }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(template.name);
    const [componentKey, setComponentKey] = useState<LayoutComponentKey>(template.componentKey as LayoutComponentKey);
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    useEffect(() => {
        if (open) {
            setName(template.name);
            setComponentKey(template.componentKey as LayoutComponentKey);
        }
    }, [open, template]);

    const defaultConfigs: Record<LayoutComponentKey, object> = {
        homepage: { header: 'minimal', navigation: 'topbar', contentWidth: 'full', footer: true, density: 'comfy' },
        'app-shell': {
            header: 'topbar',
            navigation: 'sidebar',
            contentWidth: 'fluid',
            footer: false,
            density: 'comfy',
        },
        docs: { header: 'topbar', navigation: 'sidebar', contentWidth: 'fixed', footer: true, density: 'compact' },
        minimal: { header: 'none', navigation: 'topbar', contentWidth: 'full', footer: false, density: 'comfy' },
    };

    const putMutation = useMutation({
        mutationFn: (body: { id: string; name: string; componentKey: string; config: object }) =>
            layoutApi.putTemplate(body) as Promise<unknown>,
        onSuccess: () => {
            toast.success('Template updated');
            queryClient.invalidateQueries({ queryKey: ['brand', 'layouts'] });
            refresh();
            setOpen(false);
        },
        onError: () => toast.error('Failed to update'),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <IconEdit className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit layout template</DialogTitle>
                    <DialogDescription>Change name or component.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="editLayoutName">Name</Label>
                        <Input
                            id="editLayoutName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Main App Shell"
                        />
                    </div>
                    <div>
                        <Label>Component</Label>
                        <Select value={componentKey} onValueChange={(v) => setComponentKey(v as LayoutComponentKey)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COMPONENT_KEYS.map((k) => (
                                    <SelectItem key={k} value={k}>
                                        {k}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={() =>
                            putMutation.mutate({
                                id: template.id,
                                name: name.trim() || template.name,
                                componentKey,
                                config: (template.config as object) ?? defaultConfigs[componentKey],
                            })
                        }
                        disabled={putMutation.isPending}
                    >
                        {putMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MappingsEditor({
    mappings,
    templates,
    onSave,
    saving,
}: {
    mappings: LayoutMappingItem[];
    templates: LayoutTemplateItem[];
    onSave: (m: LayoutMappingItem[]) => void;
    saving: boolean;
}) {
    const [pathPattern, setPathPattern] = useState('');
    const [layoutTemplateId, setLayoutTemplateId] = useState('');
    const [priority, setPriority] = useState(0);
    const [items, setItems] = useState<LayoutMappingItem[]>(mappings);

    useEffect(() => {
        setItems(mappings);
    }, [mappings]);

    const add = () => {
        if (!pathPattern.trim() || !layoutTemplateId) return;
        setItems([...items, { pathPattern: pathPattern.trim(), layoutTemplateId, priority }]);
        setPathPattern('');
        setLayoutTemplateId('');
        setPriority(0);
    };

    const remove = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    // Fix: use useEffect to sync items when mappings change
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <Input
                    value={pathPattern}
                    onChange={(e) => setPathPattern(e.target.value)}
                    placeholder="/admin/*"
                    className="max-w-[180px]"
                />
                <Select value={layoutTemplateId} onValueChange={setLayoutTemplateId}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Layout template" />
                    </SelectTrigger>
                    <SelectContent>
                        {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                                {t.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value) || 0)}
                    placeholder="Priority"
                    className="w-20"
                />
                <Button size="sm" variant="outline" onClick={add} disabled={!pathPattern.trim() || !layoutTemplateId}>
                    Add
                </Button>
            </div>
            <div className="space-y-2">
                {items.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded border px-3 py-2">
                        <span className="font-mono text-sm">{m.pathPattern}</span>
                        <span className="text-muted-foreground text-sm">
                            {templates.find((t) => t.id === m.layoutTemplateId)?.name ?? m.layoutTemplateId}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => remove(idx)}>
                            <IconTrash className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button onClick={() => onSave(items)} disabled={saving}>
                {saving ? 'Saving...' : 'Save mappings'}
            </Button>
        </div>
    );
}
