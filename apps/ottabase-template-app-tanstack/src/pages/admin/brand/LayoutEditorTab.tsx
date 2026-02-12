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
    Switch,
} from '@ottabase/ui-shadcn';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { LayoutComponentKey, LayoutConfig } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { layoutApi, brandKitApi, type LayoutTemplateItem, type LayoutMappingItem } from './brandApi';

const COMPONENT_KEYS: LayoutComponentKey[] = ['homepage', 'app-shell', 'docs', 'minimal'];

const DEFAULT_CONFIGS: Record<LayoutComponentKey, LayoutConfig> = {
    homepage: { header: 'minimal', navigation: 'topbar', contentWidth: 'full', footer: true, density: 'comfy' },
    'app-shell': { header: 'topbar', navigation: 'sidebar', contentWidth: 'fluid', footer: false, density: 'comfy' },
    docs: { header: 'topbar', navigation: 'sidebar', contentWidth: 'fixed', footer: true, density: 'compact' },
    minimal: { header: 'none', navigation: 'topbar', contentWidth: 'full', footer: false, density: 'comfy' },
};

function LayoutConfigEditor({ config, onChange }: { config: LayoutConfig; onChange: (c: LayoutConfig) => void }) {
    return (
        <div className="space-y-3 rounded-lg border p-3 dark:border-muted">
            <p className="text-sm font-medium">Layout config</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <Label>Header</Label>
                    <Select
                        value={config.header}
                        onValueChange={(v) => onChange({ ...config, header: v as LayoutConfig['header'] })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {['minimal', 'sidebar', 'topbar', 'none'].map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Navigation</Label>
                    <Select
                        value={config.navigation}
                        onValueChange={(v) => onChange({ ...config, navigation: v as LayoutConfig['navigation'] })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {['sidebar', 'topbar', 'drawer'].map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Content width</Label>
                    <Select
                        value={config.contentWidth}
                        onValueChange={(v) => onChange({ ...config, contentWidth: v as LayoutConfig['contentWidth'] })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {['fixed', 'fluid', 'full'].map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Density</Label>
                    <Select
                        value={config.density}
                        onValueChange={(v) => onChange({ ...config, density: v as LayoutConfig['density'] })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {['compact', 'comfy'].map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="layoutFooter">Footer</Label>
                <Switch
                    id="layoutFooter"
                    checked={config.footer}
                    onCheckedChange={(v) => onChange({ ...config, footer: v })}
                />
            </div>
        </div>
    );
}

export function LayoutEditorTab() {
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const { data: templates = [], isLoading: loadingTemplates } = useQuery<LayoutTemplateItem[]>({
        queryKey: ['brand', 'layouts'],
        queryFn: () => layoutApi.getTemplates(),
    });

    const { data: kits = [], isLoading: loadingKits } = useQuery({
        queryKey: ['brand', 'kits'],
        queryFn: () => brandKitApi.list(),
    });

    const { data: mappings = [], isLoading: loadingMappings } = useQuery<LayoutMappingItem[]>({
        queryKey: ['brand', 'mappings'],
        queryFn: () => layoutApi.getMappings(),
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

    if (loadingTemplates || loadingMappings || loadingKits) {
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
                        Match paths to layout + Brand Kit. Higher priority wins. Use * and ** for wildcards.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MappingsEditor
                        mappings={mappings}
                        templates={templates}
                        kits={kits}
                        onSave={(m) =>
                            putMappingsMutation.mutate({
                                mappings: m.map(({ pathPattern, layoutTemplateId, brandKitId, priority }) => ({
                                    pathPattern,
                                    layoutTemplateId,
                                    brandKitId: brandKitId!,
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
    const [config, setConfig] = useState<LayoutConfig>(DEFAULT_CONFIGS['app-shell']);
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    // Reset config when component changes
    useEffect(() => {
        setConfig(DEFAULT_CONFIGS[componentKey]);
    }, [componentKey]);

    const putMutation = useMutation({
        mutationFn: (body: { name: string; componentKey: string; config: object }) => layoutApi.putTemplate(body),
        onSuccess: () => {
            toast.success('Template created');
            queryClient.invalidateQueries({ queryKey: ['brand', 'layouts'] });
            refresh();
            setName('');
            setConfig(DEFAULT_CONFIGS['app-shell']);
            setOpen(false);
        },
        onError: () => toast.error('Failed to create'),
    });

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
                    <DialogDescription>Add a layout preset with custom config for route mappings.</DialogDescription>
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
                    <LayoutConfigEditor config={config} onChange={setConfig} />
                    <Button
                        onClick={() =>
                            putMutation.mutate({
                                name: name.trim() || componentKey,
                                componentKey,
                                config,
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

function mergeLayoutConfig(existing: object | undefined, fallback: LayoutConfig): LayoutConfig {
    if (!existing || typeof existing !== 'object') return fallback;
    const c = existing as Record<string, unknown>;
    return {
        header: (c.header as LayoutConfig['header']) ?? fallback.header,
        navigation: (c.navigation as LayoutConfig['navigation']) ?? fallback.navigation,
        contentWidth: (c.contentWidth as LayoutConfig['contentWidth']) ?? fallback.contentWidth,
        footer: typeof c.footer === 'boolean' ? c.footer : fallback.footer,
        density: (c.density as LayoutConfig['density']) ?? fallback.density,
    };
}

function EditTemplateDialog({ template }: { template: LayoutTemplateItem }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(template.name);
    const [componentKey, setComponentKey] = useState<LayoutComponentKey>(template.componentKey as LayoutComponentKey);
    const [config, setConfig] = useState<LayoutConfig>(() =>
        mergeLayoutConfig(
            template.config,
            DEFAULT_CONFIGS[template.componentKey as LayoutComponentKey] ?? DEFAULT_CONFIGS['app-shell'],
        ),
    );
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    useEffect(() => {
        if (open) {
            setName(template.name);
            setComponentKey(template.componentKey as LayoutComponentKey);
            setConfig(
                mergeLayoutConfig(
                    template.config,
                    DEFAULT_CONFIGS[template.componentKey as LayoutComponentKey] ?? DEFAULT_CONFIGS['app-shell'],
                ),
            );
        }
    }, [open, template]);

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
                    <DialogDescription>Change name, component, or layout config.</DialogDescription>
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
                    <LayoutConfigEditor config={config} onChange={setConfig} />
                    <Button
                        onClick={() =>
                            putMutation.mutate({
                                id: template.id,
                                name: name.trim() || template.name,
                                componentKey,
                                config,
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
    kits,
    onSave,
    saving,
}: {
    mappings: LayoutMappingItem[];
    templates: LayoutTemplateItem[];
    kits: Array<{ id: string; name: string }>;
    onSave: (m: LayoutMappingItem[]) => void;
    saving: boolean;
}) {
    const [pathPattern, setPathPattern] = useState('');
    const [layoutTemplateId, setLayoutTemplateId] = useState('');
    const [brandKitId, setBrandKitId] = useState('');
    const [priority, setPriority] = useState(0);
    const [items, setItems] = useState<LayoutMappingItem[]>(mappings);

    useEffect(() => {
        setItems(
            mappings.map((m) => ({
                ...m,
                brandKitId: m.brandKitId || kits[0]?.id || '',
            })),
        );
    }, [mappings, kits]);

    const add = () => {
        if (!pathPattern.trim() || !layoutTemplateId || !brandKitId) return;
        setItems([...items, { pathPattern: pathPattern.trim(), layoutTemplateId, brandKitId, priority }]);
        setPathPattern('');
        setLayoutTemplateId('');
        setBrandKitId('');
        setPriority(0);
    };

    const remove = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <Input
                    value={pathPattern}
                    onChange={(e) => setPathPattern(e.target.value)}
                    placeholder="/* or /admin/**"
                    className="max-w-[180px]"
                />
                <Select value={layoutTemplateId} onValueChange={setLayoutTemplateId}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Layout" />
                    </SelectTrigger>
                    <SelectContent>
                        {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                                {t.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={brandKitId} onValueChange={setBrandKitId}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Brand Kit" />
                    </SelectTrigger>
                    <SelectContent>
                        {kits.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                                {k.name}
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
                <Button
                    size="sm"
                    variant="outline"
                    onClick={add}
                    disabled={!pathPattern.trim() || !layoutTemplateId || !brandKitId || kits.length === 0}
                >
                    Add
                </Button>
            </div>
            {kits.length === 0 && (
                <p className="text-sm text-muted-foreground">Create a Brand Kit first before adding mappings.</p>
            )}
            <div className="space-y-2">
                {items.map((m, idx) => (
                    <div
                        key={idx}
                        className="flex items-center justify-between rounded border px-3 py-2 dark:border-muted"
                    >
                        <span className="font-mono text-sm">{m.pathPattern}</span>
                        <span className="text-muted-foreground text-sm">
                            {templates.find((t) => t.id === m.layoutTemplateId)?.name ?? m.layoutTemplateId} →{' '}
                            {kits.find((k) => k.id === m.brandKitId)?.name ?? m.brandKitId}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => remove(idx)}>
                            <IconTrash className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button onClick={() => onSave(items)} disabled={saving || kits.length === 0}>
                {saving ? 'Saving...' : 'Save mappings'}
            </Button>
        </div>
    );
}
