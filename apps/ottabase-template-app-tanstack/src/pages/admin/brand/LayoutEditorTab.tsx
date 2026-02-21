import { useBrand } from '@ottabase/brand-engine-react';
import {
    isValidPathPattern,
    LAYOUT_PRESETS,
    mergeLayoutConfig,
    type LayoutConfig,
    type LayoutPresetId,
} from '@ottabase/ottalayout';
import { useApiQuery } from '@ottabase/ottaorm/client';
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
import { IconAdjustments, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { layoutApi, type BrandKitItem, type LayoutMappingItem, type LayoutTemplateItem } from './brandApi';

const PRESET_IDS = Object.keys(LAYOUT_PRESETS) as LayoutPresetId[];

const BUILT_IN_PRESETS: LayoutTemplateItem[] = PRESET_IDS.map((key) => ({
    id: key,
    name: key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    componentKey: key,
    config: LAYOUT_PRESETS[key].config,
}));

const DEFAULT_CONFIGS = PRESET_IDS.reduce<Record<LayoutPresetId, LayoutConfig>>(
    (acc, key) => {
        acc[key] = LAYOUT_PRESETS[key].config;
        return acc;
    },
    {} as Record<LayoutPresetId, LayoutConfig>,
);

function getTemplateConfig(template: LayoutTemplateItem): LayoutConfig {
    const fallback = DEFAULT_CONFIGS[template.componentKey as LayoutPresetId] ?? DEFAULT_CONFIGS['app-shell'];
    return mergeLayoutConfig(template.config, fallback);
}

const LayoutMiniPreview = memo(function LayoutMiniPreview({ config }: { config: LayoutConfig }) {
    const densityGap = config.density === 'compact' ? 'gap-1' : config.density === 'spacious' ? 'gap-2' : 'gap-1.5';

    const contentMaxWidth =
        config.contentWidth === 'full'
            ? 'max-w-none'
            : ['lg', 'fluid', 'xl'].includes(config.contentWidth)
              ? 'max-w-[94%]'
              : ['xs', 'sm'].includes(config.contentWidth)
                ? 'max-w-[56%]'
                : 'max-w-[72%]';
    const navWidth = config.navigation === 'sidebar' ? 'w-10' : config.navigation === 'drawer' ? 'w-6' : 'w-0';
    const headerHeight = config.header === 'minimal' ? 'h-3' : config.header === 'topbar' ? 'h-4' : 'h-0';
    const hasHeader = config.header !== 'none';
    const hasNav = config.navigation !== 'none';

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
                            {hasNav && config.navigation !== 'topbar' ? (
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
});

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
                            {['sidebar', 'topbar', 'drawer', 'none'].map((v) => (
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
                            {['xs', 'sm', 'md', 'lg', 'xl', 'full'].map((v) => (
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
                            {['compact', 'comfy', 'spacious'].map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Extended layout controls */}
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <Label>Sidebar width</Label>
                    <Select
                        value={config.sidebarWidth ?? 'standard'}
                        onValueChange={(v) => onChange({ ...config, sidebarWidth: v as LayoutConfig['sidebarWidth'] })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {['narrow', 'standard', 'wide'].map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Container padding</Label>
                    <Select
                        value={config.containerPadding ?? 'md'}
                        onValueChange={(v) =>
                            onChange({ ...config, containerPadding: v as LayoutConfig['containerPadding'] })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {['none', 'sm', 'md', 'lg'].map((v) => (
                                <SelectItem key={v} value={v}>
                                    {v}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="layoutFooter">Footer</Label>
                    <Switch
                        id="layoutFooter"
                        checked={config.footer}
                        onCheckedChange={(v) => onChange({ ...config, footer: v })}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="layoutSticky">Sticky header</Label>
                    <Switch
                        id="layoutSticky"
                        checked={config.headerSticky ?? true}
                        onCheckedChange={(v) => onChange({ ...config, headerSticky: v })}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="layoutCollapsible">Collapsible sidebar</Label>
                    <Switch
                        id="layoutCollapsible"
                        checked={config.sidebarCollapsible ?? false}
                        onCheckedChange={(v) => onChange({ ...config, sidebarCollapsible: v })}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="layoutCenter">Center content</Label>
                    <Switch
                        id="layoutCenter"
                        checked={config.centerContent ?? false}
                        onCheckedChange={(v) => onChange({ ...config, centerContent: v })}
                    />
                </div>
            </div>
        </div>
    );
}

export function LayoutEditorTab() {
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const { data: templates = [], isLoading: loadingTemplates } = useApiQuery<LayoutTemplateItem[]>({
        entity: 'layout_templates',
        queryKey: ['list'],
        endpoint: '/api/brand/layouts',
    });

    const { data: kits = [], isLoading: loadingKits } = useApiQuery<BrandKitItem[]>({
        entity: 'brand_kits',
        queryKey: ['list'],
        endpoint: '/api/brand/kits',
    });

    const { data: mappings = [], isLoading: loadingMappings } = useApiQuery<LayoutMappingItem[]>({
        entity: 'layout_mappings',
        queryKey: ['list'],
        endpoint: '/api/brand/mappings',
    });

    const putMappingsMutation = useMutation({
        meta: { entity: 'layout_mappings' },
        mutationFn: layoutApi.putMappings,
        onSuccess: () => {
            toast.success('Mappings saved');
            queryClient.invalidateQueries({ queryKey: ['layout_mappings'] });
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

            <Card className="space-y-0">
                <CardHeader>
                    <CardTitle>Route mappings</CardTitle>
                    <CardDescription>
                        Higher priorities win. This form builds the list of patterns that the router evaluates every
                        request against.
                    </CardDescription>
                    <p className="text-xs text-muted-foreground mt-2">
                        <strong className="pl-1.5">*</strong> = one segment (e.g. <code>/docs/*</code> matches{' '}
                        <code>/docs/config</code> but not <code>/docs/packages/config</code>).
                        <br />
                        <strong>**</strong> = any depth (e.g. <code>/docs/**</code> matches all docs routes).
                    </p>
                </CardHeader>
                <CardContent>
                    <MappingsEditor
                        mappings={mappings}
                        layoutOptions={layoutOptions}
                        kits={kits}
                        onSave={(m) =>
                            putMappingsMutation.mutate({
                                mappings: m.map(
                                    ({ pathPattern, layoutTemplateId, brandKitId, priority, tokenOverridesJson }) => ({
                                        pathPattern,
                                        layoutTemplateId,
                                        brandKitId: brandKitId!,
                                        priority: priority ?? 0,
                                        tokenOverridesJson: tokenOverridesJson || null,
                                    }),
                                ),
                            })
                        }
                        saving={putMappingsMutation.isPending}
                    />
                </CardContent>
            </Card>

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
                                No custom templates yet. Use the built-in presets when creating mappings.
                            </p>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {templates.map((t) => {
                                    const config = getTemplateConfig(t);
                                    return (
                                        <div key={t.id} className="rounded-lg border p-4 dark:border-muted">
                                            <div className="mb-3 flex items-center justify-between gap-2">
                                                <p className="font-medium">{t.name}</p>
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
    );
}

function CreateTemplateDialog({ templates }: { templates: LayoutTemplateItem[] }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [basePreset, setBasePreset] = useState<LayoutPresetId>('app-shell');
    const [config, setConfig] = useState<LayoutConfig>(DEFAULT_CONFIGS['app-shell']);
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    useEffect(() => {
        setConfig(DEFAULT_CONFIGS[basePreset]);
    }, [basePreset]);

    const putMutation = useMutation({
        meta: { entity: 'layout_templates' },
        mutationFn: (body: { name: string; componentKey: string; config: object }) => layoutApi.putTemplate(body),
        onSuccess: () => {
            toast.success('Template created');
            queryClient.invalidateQueries({ queryKey: ['layout_templates'] });
            refresh();
            setName('');
            setBasePreset('app-shell');
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
                    <DialogDescription>
                        Start from a preset, then customise the config. Templates are reusable across route mappings.
                    </DialogDescription>
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
                        <Label className="mb-2 block">Start from preset</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESET_IDS.map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setBasePreset(id)}
                                    className={`rounded-lg border p-2 text-center text-xs transition-colors ${
                                        basePreset === id
                                            ? 'border-primary bg-primary/5 font-medium'
                                            : 'hover:bg-muted/40'
                                    }`}
                                >
                                    {id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                </button>
                            ))}
                        </div>
                    </div>
                    <LayoutConfigEditor config={config} onChange={setConfig} />
                    <Button
                        onClick={() => {
                            if (duplicateName) return;
                            putMutation.mutate({
                                name: name.trim() || basePreset,
                                componentKey: basePreset,
                                config,
                            });
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
    const [config, setConfig] = useState<LayoutConfig>(() => getTemplateConfig(template));
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    useEffect(() => {
        if (!open) return;
        setName(template.name);
        setConfig(getTemplateConfig(template));
    }, [open, template]);

    const putMutation = useMutation({
        meta: { entity: 'layout_templates' },
        mutationFn: (body: { id: string; name: string; componentKey: string; config: object }) =>
            layoutApi.putTemplate(body) as Promise<unknown>,
        onSuccess: () => {
            toast.success('Template updated');
            queryClient.invalidateQueries({ queryKey: ['layout_templates'] });
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
                    <DialogDescription>Change the name or layout config.</DialogDescription>
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
                    <LayoutConfigEditor config={config} onChange={setConfig} />
                    <Button
                        onClick={() =>
                            putMutation.mutate({
                                id: template.id,
                                name: name.trim() || template.name,
                                componentKey: template.componentKey,
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
            { pathPattern: pathPattern.trim(), layoutTemplateId, brandKitId, priority, tokenOverridesJson: null },
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

    /** Update a single field on an existing mapping row */
    const updateItem = useCallback((idx: number, patch: Partial<LayoutMappingItem>) => {
        setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    }, []);

    return (
        <div className="space-y-4">
            {/* Existing mappings table (shown first) */}
            {kits.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                    Create a Brand Kit first before adding mappings.
                </p>
            ) : null}
            {items.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center dark:border-muted">
                    <p className="text-sm text-muted-foreground">No mappings yet. Add one below.</p>
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
                                const hasOverrides = !!m.tokenOverridesJson && m.tokenOverridesJson !== '{}';
                                return (
                                    <MappingRow
                                        key={`${m.pathPattern}-${idx}`}
                                        mapping={m}
                                        layoutOptions={layoutOptions}
                                        kits={kits}
                                        hasOverrides={hasOverrides}
                                        onUpdate={(patch) => updateItem(idx, patch)}
                                        onRemove={() => remove(idx)}
                                        onTokenOverridesChange={(json) =>
                                            updateItem(idx, { tokenOverridesJson: json || null })
                                        }
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Button onClick={() => onSave(items)} disabled={saving || kits.length === 0}>
                {saving ? 'Saving...' : 'Save mappings'}
            </Button>

            {/* Add new mapping (below save button) */}
            <div className="space-y-3 rounded-lg border p-4 dark:border-muted">
                <p className="text-sm font-medium text-muted-foreground">Add new mapping</p>
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
        </div>
    );
}

/** Individual mapping row with inline-editable fields and collapsible token overrides */
const MappingRow = memo(function MappingRow({
    mapping,
    layoutOptions,
    kits,
    hasOverrides,
    onUpdate,
    onRemove,
    onTokenOverridesChange,
}: {
    mapping: LayoutMappingItem;
    layoutOptions: LayoutTemplateItem[];
    kits: Array<{ id: string; name: string }>;
    hasOverrides: boolean;
    onUpdate: (patch: Partial<LayoutMappingItem>) => void;
    onRemove: () => void;
    onTokenOverridesChange: (json: string | null) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [overrideText, setOverrideText] = useState(mapping.tokenOverridesJson ?? '');
    const [jsonError, setJsonError] = useState('');
    const [pathError, setPathError] = useState('');

    const handlePathChange = (value: string) => {
        onUpdate({ pathPattern: value });
        if (value.trim() && !isValidPathPattern(value.trim())) {
            setPathError('Invalid pattern');
        } else {
            setPathError('');
        }
    };

    const handleBlur = () => {
        const trimmed = overrideText.trim();
        if (!trimmed || trimmed === '{}') {
            onTokenOverridesChange(null);
            setJsonError('');
            return;
        }
        try {
            JSON.parse(trimmed);
            onTokenOverridesChange(trimmed);
            setJsonError('');
        } catch {
            setJsonError('Invalid JSON');
        }
    };

    return (
        <>
            <tr>
                <td className="px-3 py-2 align-top">
                    <div>
                        <Input
                            value={mapping.pathPattern}
                            onChange={(e) => handlePathChange(e.target.value)}
                            placeholder="/* or /admin/**"
                            className={`h-8 font-mono text-xs ${pathError ? 'border-red-500' : ''}`}
                        />
                        {pathError ? <p className="mt-0.5 text-[10px] text-red-500">{pathError}</p> : null}
                    </div>
                </td>
                <td className="px-3 py-2 align-top">
                    <Select value={mapping.layoutTemplateId} onValueChange={(v) => onUpdate({ layoutTemplateId: v })}>
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                            <SelectValue placeholder="Layout" />
                        </SelectTrigger>
                        <SelectContent>
                            {layoutOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                    {opt.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </td>
                <td className="px-3 py-2 align-top">
                    <Select value={mapping.brandKitId || ''} onValueChange={(v) => onUpdate({ brandKitId: v })}>
                        <SelectTrigger className="h-8 w-[160px] text-xs">
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
                </td>
                <td className="px-3 py-2 align-top">
                    <Input
                        type="number"
                        value={mapping.priority ?? 0}
                        onChange={(e) => onUpdate({ priority: Number(e.target.value) || 0 })}
                        className="h-8 w-16 text-xs"
                    />
                </td>
                <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant={hasOverrides ? 'default' : 'ghost'}
                            onClick={() => setExpanded(!expanded)}
                            title="Token overrides for this route"
                            className={hasOverrides ? 'h-7 w-7 p-0' : 'h-7 w-7 p-0'}
                        >
                            <IconAdjustments className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onRemove} className="h-7 w-7 p-0">
                            <IconTrash className="h-4 w-4" />
                        </Button>
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr>
                    <td colSpan={5} className="px-3 pb-3 pt-0">
                        <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium">Route token overrides</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Partial JSON merged on top of the Brand Kit's theme for this route only.
                                        Override colors, typography, etc. without creating a separate kit.
                                    </p>
                                </div>
                                {overrideText.trim() && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs text-muted-foreground"
                                        onClick={() => {
                                            setOverrideText('');
                                            onTokenOverridesChange(null);
                                        }}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                            <textarea
                                className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary dark:border-muted"
                                rows={5}
                                value={overrideText}
                                onChange={(e) => setOverrideText(e.target.value)}
                                onBlur={handleBlur}
                                placeholder={`{\n  "colors": {\n    "primary": "220 90% 56%"\n  }\n}`}
                                spellCheck={false}
                            />
                            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
                            <p className="text-[10px] text-muted-foreground">
                                Tip: Use HSL values matching your design tokens. E.g.{' '}
                                <code className="rounded bg-muted px-1">{`{"colors":{"primary":"220 90% 56%"}}`}</code>
                            </p>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
});
