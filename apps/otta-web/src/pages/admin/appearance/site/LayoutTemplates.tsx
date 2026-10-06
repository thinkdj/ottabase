/**
 * Layout templates: the mini preview, the config editor, and the create, edit and delete
 * dialogs for custom templates. The site design workspace renders the card.
 */
import { useBrand } from '@ottabase/brand-engine-react';
import { LAYOUT_PRESETS, mergeLayoutConfig, type LayoutConfig, type LayoutPresetId } from '@ottabase/ottalayout';
import { ConfirmDialog } from '@ottabase/ui-components';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memo, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { layoutApi, type LayoutMappingItem, type LayoutTemplateItem } from '../brand/brandApi';

const PRESET_IDS = Object.keys(LAYOUT_PRESETS) as LayoutPresetId[];

/** The built-in presets as layout options, ahead of any custom template */
export const BUILT_IN_PRESETS: LayoutTemplateItem[] = PRESET_IDS.map((key) => ({
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

export function getTemplateConfig(template: LayoutTemplateItem): LayoutConfig {
    const fallback = DEFAULT_CONFIGS[template.componentKey as LayoutPresetId] ?? DEFAULT_CONFIGS['app-shell'];
    return mergeLayoutConfig(template.config, fallback);
}

export const LayoutMiniPreview = memo(function LayoutMiniPreview({
    config,
    compact = false,
}: {
    config: LayoutConfig;
    /** Compact = single meta line instead of config chips (for dense picker grids) */
    compact?: boolean;
}) {
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

    // Structural bars use a muted-foreground tint, which reads clearly on light and dark
    const bar = 'bg-muted-foreground/25';
    const summary = `header ${config.header} · nav ${config.navigation} · width ${config.contentWidth} · ${config.density}${config.footer ? ' · footer' : ''}`;

    return (
        <div className="space-y-2">
            <div className="aspect-[16/10] rounded-lg bg-background p-2 ring-1 ring-border">
                <div className="flex h-full gap-1.5">
                    {config.header === 'sidebar' ? <div className={`w-2.5 rounded ${bar}`} /> : null}
                    <div className="flex flex-1 flex-col gap-1">
                        {hasHeader && config.header !== 'sidebar' ? (
                            <div className={`${headerHeight} rounded ${bar}`} />
                        ) : null}
                        {config.navigation === 'topbar' ? <div className={`h-2.5 rounded ${bar}`} /> : null}
                        <div className="flex min-h-0 flex-1 gap-1">
                            {hasNav && config.navigation !== 'topbar' ? (
                                <div className={`${navWidth} relative rounded ${bar}`}>
                                    {config.navigation === 'drawer' ? (
                                        <div className="absolute left-1.5 top-2 flex flex-col gap-0.5">
                                            <span className="h-0.5 w-3 rounded-full bg-background" />
                                            <span className="h-0.5 w-3 rounded-full bg-background" />
                                            <span className="h-0.5 w-3 rounded-full bg-background" />
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className="flex min-h-0 flex-1 justify-center rounded bg-muted/70 p-1.5">
                                <div className={`flex h-full w-full ${contentMaxWidth} flex-col ${densityGap}`}>
                                    <div className="grid flex-1 grid-cols-1 gap-1">
                                        <div className="rounded bg-background ring-1 ring-border/60" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {config.footer ? <div className={`h-2 rounded ${bar}`} /> : null}
                    </div>
                </div>
            </div>
            {compact ? (
                <p className="truncate text-[0.625rem] leading-tight text-muted-foreground" title={summary}>
                    {config.navigation} nav · {config.contentWidth} · {config.density}
                    {config.footer ? ' · footer' : ''}
                </p>
            ) : (
                <div className="flex flex-wrap gap-1 text-[0.625rem] text-muted-foreground">
                    <span className="rounded-full bg-background px-1.5 py-0.5 ring-1 ring-border">
                        width: {config.contentWidth}
                    </span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 ring-1 ring-border">
                        density: {config.density}
                    </span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 ring-1 ring-border">
                        footer: {config.footer ? 'on' : 'off'}
                    </span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 ring-1 ring-border">
                        header: {config.header}
                    </span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 ring-1 ring-border">
                        nav: {config.navigation}
                    </span>
                </div>
            )}
        </div>
    );
});

function LayoutConfigEditor({ config, onChange }: { config: LayoutConfig; onChange: (c: LayoutConfig) => void }) {
    return (
        <div className="space-y-3 rounded-lg bg-muted/40 p-3">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Layout config</p>
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
                        {duplicateName ? <p className="mt-1 text-xs text-warning">Name already exists.</p> : null}
                    </div>
                    <div>
                        <Label className="mb-2 block">Start from preset</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESET_IDS.map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setBasePreset(id)}
                                    aria-pressed={basePreset === id}
                                    className={`rounded-lg border p-2 text-center text-xs transition-all duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        basePreset === id
                                            ? 'border-transparent bg-primary/5 font-medium ring-2 ring-primary'
                                            : 'border-transparent bg-muted/40 hover:bg-muted/70'
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

function DeleteTemplateButton({ template, inUseCount }: { template: LayoutTemplateItem; inUseCount: number }) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const deleteMutation = useMutation({
        meta: { entity: 'layout_templates' },
        mutationFn: () => layoutApi.deleteTemplate(template.id),
        onSuccess: () => {
            toast.success('Template deleted');
            queryClient.invalidateQueries({ queryKey: ['layout_templates'] });
            refresh();
        },
        // Failure toasts (incl. the server's 409 "in use" message) come from the global api error handler
    });

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Delete template"
                disabled={deleteMutation.isPending}
                onClick={() => {
                    if (inUseCount > 0) {
                        toast.warning(
                            `"${template.name}" is used by ${inUseCount} route mapping${inUseCount === 1 ? '' : 's'}. Remove those mappings first.`,
                        );
                        return;
                    }
                    setOpen(true);
                }}
            >
                <IconTrash className="h-4 w-4" />
            </Button>
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title="Delete layout template?"
                description={`This cannot be undone. The template "${template.name}" will be permanently deleted.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                onConfirm={() => deleteMutation.mutateAsync()}
            />
        </>
    );
}

/** Custom layout templates: saved structures that several routes can share */
export function LayoutTemplates({
    templates,
    mappings,
}: {
    templates: LayoutTemplateItem[];
    mappings: LayoutMappingItem[];
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Layout templates</CardTitle>
                <CardDescription className="leading-relaxed">
                    The built-in presets are always there. Save a custom structure as a template to use it on several
                    routes.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <CreateTemplateDialog templates={templates} />
                    {templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No custom templates yet; the presets cover the routes.
                        </p>
                    ) : (
                        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(13.75rem,1fr))]">
                            {templates.map((t) => {
                                const config = getTemplateConfig(t);
                                const inUseCount = mappings.filter((m) => m.layoutTemplateId === t.id).length;
                                return (
                                    <div key={t.id} className="rounded-lg bg-background p-4 ring-1 ring-border">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <p className="truncate font-medium">{t.name}</p>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <EditTemplateDialog template={t} />
                                                <DeleteTemplateButton template={t} inUseCount={inUseCount} />
                                            </div>
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
    );
}
