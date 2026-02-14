import { isValidPathPattern, LAYOUT_PRESETS, type LayoutComponentKey, type LayoutConfig } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import {
    Badge,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { brandKitApi, layoutApi, type LayoutMappingItem, type LayoutTemplateItem } from './brandApi';

const COMPONENT_KEYS = Object.keys(LAYOUT_PRESETS) as LayoutComponentKey[];

const BUILT_IN_PRESETS: LayoutTemplateItem[] = COMPONENT_KEYS.map((key) => ({
    id: key,
    name: key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    componentKey: key,
    config: LAYOUT_PRESETS[key].config,
}));

const DEFAULT_CONFIGS = COMPONENT_KEYS.reduce<Record<LayoutComponentKey, LayoutConfig>>(
    (acc, key) => {
        acc[key] = LAYOUT_PRESETS[key].config;
        return acc;
    },
    {} as Record<LayoutComponentKey, LayoutConfig>,
);

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

function getTemplateConfig(template: LayoutTemplateItem): LayoutConfig {
    const key = template.componentKey as LayoutComponentKey;
    const fallback = DEFAULT_CONFIGS[key] ?? DEFAULT_CONFIGS['app-shell'];
    return mergeLayoutConfig(template.config, fallback);
}

function LayoutMiniPreview({ config }: { config: LayoutConfig }) {
    const densityGap = config.density === 'compact' ? 'gap-1' : 'gap-1.5';

    const contentMaxWidth =
        config.contentWidth === 'full' ? 'max-w-none' : config.contentWidth === 'fluid' ? 'max-w-[94%]' : 'max-w-[72%]';
    const navWidth = config.navigation === 'sidebar' ? 'w-10' : config.navigation === 'drawer' ? 'w-6' : 'w-0';
    const headerHeight = config.header === 'minimal' ? 'h-3' : config.header === 'topbar' ? 'h-4' : 'h-0';
    const hasHeader = config.header !== 'none';

    return (
        <div className="space-y-2">
            <div className="aspect-[16/10] rounded-md border bg-muted/10 p-2 dark:border-muted/60">
                <div className="flex h-full gap-1.5">
                    {config.header === 'sidebar' ? <div className="w-2.5 rounded bg-muted" /> : null}
                    <div className="flex flex-1 flex-col gap-1">
                        {hasHeader && config.header !== 'sidebar' ? (
                            <div className={`${headerHeight} rounded bg-muted`} />
                        ) : null}
                        {config.navigation === 'topbar' ? <div className="h-2.5 rounded bg-muted/90" /> : null}
                        <div className="flex min-h-0 flex-1 gap-1">
                            {config.navigation !== 'topbar' ? (
                                <div className={`${navWidth} relative rounded bg-muted`}>
                                    {config.navigation === 'drawer' ? (
                                        <div className="absolute left-1.5 top-2 flex flex-col gap-0.5">
                                            <span className="h-0.5 w-3 rounded-full bg-background" />
                                            <span className="h-0.5 w-3 rounded-full bg-background" />
                                            <span className="h-0.5 w-3 rounded-full bg-background" />
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className="flex min-h-0 flex-1 justify-center rounded bg-muted/40 p-1.5">
                                <div className={`flex h-full w-full ${contentMaxWidth} flex-col ${densityGap}`}>
                                    <div className="grid flex-1 grid-cols-1 gap-1">
                                        <div className="rounded bg-background/90" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {config.footer ? <div className="h-2 rounded bg-muted" /> : null}
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">width: {config.contentWidth}</span>
                <span className="rounded bg-muted px-1.5 py-0.5">density: {config.density}</span>
                <span className="rounded bg-muted px-1.5 py-0.5">footer: {config.footer ? 'on' : 'off'}</span>
                <span className="rounded bg-muted px-1.5 py-0.5">header: {config.header}</span>
                <span className="rounded bg-muted px-1.5 py-0.5">nav: {config.navigation}</span>
            </div>
        </div>
    );
}

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

    const layoutOptions = useMemo(() => [...BUILT_IN_PRESETS, ...templates], [templates]);

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
                    <CardTitle>How layout routing works</CardTitle>
                    <CardDescription>
                        Route mappings are the primary control; layout templates simply describe the structures you
                        attach to those routes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <ol className="space-y-1 list-decimal pl-5">
                        <li>Define a path pattern &amp; assign the Brand Kit that should own it.</li>
                        <li>Select a layout preset or custom template that matches the desired structure.</li>
                        <li>Save mappings (higher priority wins) to apply the layout at runtime.</li>
                    </ol>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
                <Card className="space-y-0">
                    <CardHeader>
                        <CardTitle>Route mappings</CardTitle>
                        <CardDescription>
                            Higher priorities win. This form builds the list of patterns that the router evaluates every
                            request against.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MappingsEditor
                            mappings={mappings}
                            layoutOptions={layoutOptions}
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

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Layout templates</CardTitle>
                            <CardDescription>
                                Built-in presets are guaranteed, but you can clone any structure as a template to map on
                                multiple routes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <CreateTemplateDialog templates={templates} />
                                {templates.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">
                                        No custom templates yet. Use the built-in presets listed on the right when
                                        creating mappings.
                                    </p>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-1">
                                        {templates.map((t) => {
                                            const config = getTemplateConfig(t);
                                            return (
                                                <div key={t.id} className="rounded-lg border p-4 dark:border-muted">
                                                    <div className="mb-3 flex items-center justify-between gap-2">
                                                        <div>
                                                            <p className="font-medium">{t.name}</p>
                                                            <p className="font-mono text-xs text-muted-foreground">
                                                                {t.componentKey}
                                                            </p>
                                                        </div>
                                                        <EditTemplateDialog template={t} />
                                                    </div>
                                                    <LayoutMiniPreview config={config} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
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

    const duplicateName = templates.some((t) => t.name.toLowerCase() === name.trim().toLowerCase());

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <IconPlus className="mr-2 h-4 w-4" />
                    New template
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create layout template</DialogTitle>
                    <DialogDescription>Use this only for reusable layouts you plan to map on routes.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="layoutName">Name</Label>
                        <Input
                            id="layoutName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Marketing Shell"
                        />
                        {duplicateName ? <p className="mt-1 text-xs text-amber-600">Name already exists.</p> : null}
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
                        onClick={() => {
                            if (duplicateName) {
                                return;
                            }
                            putMutation.mutate({ name: name.trim() || componentKey, componentKey, config });
                        }}
                        disabled={putMutation.isPending || duplicateName}
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
    const [config, setConfig] = useState<LayoutConfig>(() => getTemplateConfig(template));
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    useEffect(() => {
        if (!open) return;
        setName(template.name);
        setComponentKey(template.componentKey as LayoutComponentKey);
        setConfig(getTemplateConfig(template));
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
                    <DialogDescription>Change the name, component, or config.</DialogDescription>
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
    layoutOptions,
    kits,
    onSave,
    saving,
}: {
    mappings: LayoutMappingItem[];
    layoutOptions: LayoutTemplateItem[];
    kits: Array<{ id: string; name: string }>;
    onSave: (m: LayoutMappingItem[]) => void;
    saving: boolean;
}) {
    const [pathPattern, setPathPattern] = useState('');
    const [patternError, setPatternError] = useState('');
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

    const handlePathPatternChange = useCallback((value: string) => {
        setPathPattern(value);
        if (value.trim() && !isValidPathPattern(value.trim())) {
            setPatternError('Invalid pattern. Use *, **, or literal paths.');
        } else {
            setPatternError('');
        }
    }, []);

    const add = useCallback(() => {
        if (!pathPattern.trim() || patternError || !layoutTemplateId || !brandKitId) return;
        setItems((prevItems) => [
            ...prevItems,
            { pathPattern: pathPattern.trim(), layoutTemplateId, brandKitId, priority },
        ]);
        setPathPattern('');
        setPatternError('');
        setLayoutTemplateId('');
        setBrandKitId('');
        setPriority(0);
    }, [pathPattern, patternError, layoutTemplateId, brandKitId, priority]);

    const remove = useCallback((idx: number) => {
        setItems((prevItems) => prevItems.filter((_, i) => i !== idx));
    }, []);

    return (
        <div className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4 dark:border-muted">
                <div className="flex flex-wrap gap-2">
                    <div>
                        <Input
                            value={pathPattern}
                            onChange={(e) => handlePathPatternChange(e.target.value)}
                            placeholder="/* or /admin/**"
                            className={`max-w-[180px] ${patternError ? 'border-red-500' : ''}`}
                        />
                        {patternError ? <p className="mt-1 text-xs text-red-500">{patternError}</p> : null}
                    </div>
                    <Select value={brandKitId} onValueChange={setBrandKitId}>
                        <SelectTrigger className="w-[220px]">
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
                        disabled={
                            !pathPattern.trim() ||
                            !!patternError ||
                            !layoutTemplateId ||
                            !brandKitId ||
                            kits.length === 0
                        }
                    >
                        Add mapping
                    </Button>
                </div>
                <div>
                    <p className="mb-2 text-sm font-medium">Select layout</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {layoutOptions.map((option) => {
                            const selected = layoutTemplateId === option.id;
                            const config = getTemplateConfig(option);
                            const isPreset = BUILT_IN_PRESETS.some((p) => p.id === option.id);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setLayoutTemplateId(option.id)}
                                    className={`rounded-lg border p-2 text-left transition-colors ${
                                        selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                                    }`}
                                >
                                    <div className="mb-1 flex items-center gap-2">
                                        <p className="truncate text-sm font-medium">{option.name}</p>
                                        {isPreset ? (
                                            <Badge variant="secondary" className="text-[10px]">
                                                Preset
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <LayoutMiniPreview config={config} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            {kits.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                    Create a Brand Kit first before adding mappings.
                </p>
            ) : null}
            {items.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center dark:border-muted">
                    <p className="text-sm text-muted-foreground">No mappings yet. Add pattern rows above.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Example: <code className="rounded bg-muted px-1">/blog/**</code> or{' '}
                        <code className="rounded bg-muted px-1">/admin/**</code>
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border dark:border-muted">
                    <table className="min-w-full divide-y divide-muted text-sm">
                        <thead className="bg-muted/20">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                    Path pattern
                                </th>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Layout</th>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Brand Kit</th>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Priority</th>
                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-muted bg-background">
                            {items.map((m, idx) => {
                                const layout = layoutOptions.find((t) => t.id === m.layoutTemplateId);
                                const kit = kits.find((k) => k.id === m.brandKitId);
                                return (
                                    <tr key={`${m.pathPattern}-${idx}`}>
                                        <td className="px-3 py-3 align-top">
                                            <code className="font-mono text-xs text-muted-foreground">
                                                {m.pathPattern}
                                            </code>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <p className="font-medium">{layout?.name ?? m.layoutTemplateId}</p>
                                            <p className="text-xs text-muted-foreground">{layout?.componentKey}</p>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <p className="font-medium">{kit?.name ?? m.brandKitId}</p>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <span className="rounded bg-muted/40 px-2 py-0.5 text-[10px] font-semibold">
                                                {m.priority ?? 0}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <Button size="sm" variant="ghost" onClick={() => remove(idx)}>
                                                <IconTrash className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <Button onClick={() => onSave(items)} disabled={saving || kits.length === 0} className="mt-4">
                {saving ? 'Saving...' : 'Save mappings'}
            </Button>
        </div>
    );
}
