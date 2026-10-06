/**
 * Site design: how the site is put together. Which brand kit and layout each route gets,
 * which menu fills each slot, the layout templates and the brand kits, beside a preview of
 * the site as the draft would render it. One Save stores the routes and the slots.
 */
import { UnsavedChangesDialog } from '@/components/editor/UnsavedChangesDialog';
import { useEditorLeaveGuard } from '@/hooks/useEditorLeaveGuard';
import { useBrand, type FullBrandConfig } from '@ottabase/brand-engine-react';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { LoadingState } from '@ottabase/ui-components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    NativeSelect,
    NativeSelectOption,
} from '@ottabase/ui-shadcn';
import { IconMoon, IconPalette, IconSun } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    brandConfigApi,
    layoutApi,
    menuSlotsApi,
    type BrandKitItem,
    type LayoutMappingItem,
    type LayoutTemplateItem,
    type MenuSlotAssignmentItem,
} from './brand/brandApi';
import { menuApi } from './menus/menuApi';
import { BUILT_IN_PRESETS, LayoutTemplates } from './site/LayoutTemplates';
import { mappingComplete, MappingsEditor, stripRowKey, withRowKey, type MappingRowItem } from './site/MappingsEditor';
import { MenuSlotsEditor } from './site/MenuSlotsEditor';
import { SitePreview } from './site/SitePreview';
import { describePath, resolveSlots, samplePath, toRouteMappings, withDraft } from './site/siteDraft';

const headingClass = 'text-[0.9375rem] font-semibold';
const EYEBROW = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const NO_KITS: BrandKitItem[] = [];
const NO_TEMPLATES: LayoutTemplateItem[] = [];

/** The shape that is compared for unsaved changes and sent on Save */
const slotPayload = (slots: MenuSlotAssignmentItem[]) =>
    slots.map((s, i) => ({ slotName: s.slotName, menuId: s.menuId, renderType: s.renderType, sortOrder: i }));
const mappingPayload = (mappings: LayoutMappingItem[]) =>
    toRouteMappings(mappings).map((m) => ({ ...m, pathPattern: m.pathPattern.trim() }));

export function AdminSiteDesignPage() {
    const queryClient = useQueryClient();
    const { refresh } = useBrand();

    const kits = useApiQuery<BrandKitItem[]>({ entity: 'brand_kits', queryKey: ['list'], endpoint: '/api/brand/kits' });
    const templates = useApiQuery<LayoutTemplateItem[]>({
        entity: 'layout_templates',
        queryKey: ['list'],
        endpoint: '/api/brand/layouts',
    });
    const mappings = useApiQuery<LayoutMappingItem[]>({
        entity: 'layout_mappings',
        queryKey: ['list'],
        endpoint: '/api/brand/mappings',
    });
    const menus = useQuery({ queryKey: ['menus', 'list'], queryFn: () => menuApi.list() });
    const slots = useQuery({ queryKey: ['menu-slots', 'raw'], queryFn: () => menuSlotsApi.getRaw() });
    const full = useQuery({
        queryKey: ['brand', 'full'],
        queryFn: () => brandConfigApi.get() as Promise<FullBrandConfig>,
    });

    // The drafts load once from the server copy; a refetch never clobbers edits, a save resets the baseline
    const [mappingDraft, setMappingDraft] = useState<MappingRowItem[] | null>(null);
    const [slotDraft, setSlotDraft] = useState<MenuSlotAssignmentItem[] | null>(null);
    const [baseline, setBaseline] = useState('');
    useEffect(() => {
        if (mappingDraft === null && mappings.data) setMappingDraft(mappings.data.map(withRowKey));
    }, [mappingDraft, mappings.data]);
    useEffect(() => {
        if (slotDraft === null && slots.data) setSlotDraft(slotPayload(slots.data));
    }, [slotDraft, slots.data]);
    useEffect(() => {
        if (!baseline && mappings.data && slots.data) {
            setBaseline(JSON.stringify([mappingPayload(mappings.data), slotPayload(slots.data)]));
        }
    }, [baseline, mappings.data, slots.data]);

    const draftMappings = useMemo(() => (mappingDraft ?? []).map(stripRowKey), [mappingDraft]);
    const draftSlots = useMemo(() => slotDraft ?? [], [slotDraft]);
    const snapshot = JSON.stringify([mappingPayload(draftMappings), slotPayload(draftSlots)]);
    const isDirty = !!baseline && snapshot !== baseline;
    const valid = draftMappings.every(mappingComplete) && draftSlots.every((s) => !!s.slotName && !!s.menuId);
    const { blocker } = useEditorLeaveGuard(isDirty);

    const save = useMutation({
        mutationFn: async () => {
            await layoutApi.putMappings({ mappings: mappingPayload(draftMappings) });
            await menuSlotsApi.put(slotPayload(draftSlots));
        },
        onSuccess: () => {
            toast.success('Site design saved');
            setBaseline(snapshot);
            queryClient.invalidateQueries({ queryKey: ['layout_mappings'] });
            queryClient.invalidateQueries({ queryKey: ['menu-slots'] });
            queryClient.invalidateQueries({ queryKey: ['brand', 'full'] });
            refresh();
        },
        onError: () => toast.error('Could not save the site design'),
    });
    const canSave = isDirty && valid && !save.isPending;

    // Ctrl+S saves, as in the other editors
    const saveRef = useRef<() => void>(() => {});
    saveRef.current = () => canSave && save.mutate();
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveRef.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Preview: the draft laid over the live config, for one path, in one color scheme
    const kitList = kits.data ?? NO_KITS;
    const layoutOptions = useMemo(() => [...BUILT_IN_PRESETS, ...(templates.data ?? NO_TEMPLATES)], [templates.data]);
    const [path, setPath] = useState('/');
    const [mode, setMode] = useState<'light' | 'dark'>('light');
    const paths = useMemo(
        () => Array.from(new Set(['/', ...draftMappings.map((m) => samplePath(m.pathPattern))])),
        [draftMappings],
    );
    const previewFull = useMemo(
        () =>
            full.data
                ? withDraft(full.data, {
                      mappings: draftMappings,
                      menuSlots: resolveSlots(draftSlots, menus.data ?? []),
                  })
                : null,
        [full.data, draftMappings, draftSlots, menus.data],
    );
    const about = previewFull ? describePath(previewFull, path, kitList, layoutOptions) : null;

    if (mappingDraft === null || slotDraft === null || !full.data || !menus.data) {
        return (
            <div className="space-y-8" aria-busy="true">
                <span className="sr-only">Loading site design</span>
                <LoadingState count={1} height="h-9" className="w-64" />
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr),minmax(22rem,32rem)]">
                    <LoadingState count={3} height="h-48" />
                    <LoadingState count={1} height="h-80" />
                </div>
            </div>
        );
    }

    const defaultKit = kitList.find((k) => k.isDefault) ?? kitList[0];

    return (
        <div className="space-y-8">
            <UnsavedChangesDialog blocker={blocker} />
            <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <IconPalette className="h-7 w-7 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Site design</h1>
                    </div>
                    <p className="max-w-3xl text-muted-foreground">
                        Which brand kit and layout each route gets, and which menu fills each slot. The preview shows
                        the draft; Save publishes it.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {isDirty && !save.isPending && (
                        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                            Unsaved changes
                        </span>
                    )}
                    <Button onClick={() => save.mutate()} disabled={!canSave} title="Save (Ctrl+S)">
                        {save.isPending ? 'Saving' : isDirty ? 'Save changes' : 'Saved'}
                    </Button>
                </div>
            </header>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr),minmax(22rem,32rem)] 2xl:grid-cols-[minmax(0,1fr),40rem]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className={headingClass}>Routes</CardTitle>
                            <CardDescription className="leading-relaxed">
                                Each path takes the first pattern that matches it, highest priority first. A path no
                                pattern matches gets the default kit on the homepage layout.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MappingsEditor
                                value={mappingDraft}
                                layoutOptions={layoutOptions}
                                kits={kitList}
                                onChange={setMappingDraft}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className={headingClass}>Menu slots</CardTitle>
                            <CardDescription className="leading-relaxed">
                                The header, sidebar and footer each have a slot. A menu in a slot replaces the built-in
                                navigation there.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MenuSlotsEditor value={slotDraft} menus={menus.data} onChange={setSlotDraft} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className={headingClass}>Brand kits</CardTitle>
                            <CardDescription className="leading-relaxed">
                                Colors, type, radius, motion and cursors live in a kit. The routes above choose which
                                one applies where.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm">
                                {kitList.length} {kitList.length === 1 ? 'kit' : 'kits'}
                                {defaultKit && (
                                    <span className="text-muted-foreground">, default: {defaultKit.name}</span>
                                )}
                            </p>
                            <div className="flex gap-2">
                                <Button asChild variant="outline" size="sm">
                                    <Link to="/admin/appearance/brand-kits">Open the gallery</Link>
                                </Button>
                                <Button asChild size="sm">
                                    <Link to="/admin/appearance/brand-kits/new">New kit</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <LayoutTemplates templates={templates.data ?? NO_TEMPLATES} mappings={draftMappings} />
                </div>

                <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <p className={EYEBROW}>Preview</p>
                            <NativeSelect
                                size="sm"
                                value={path}
                                onChange={(e) => setPath(e.target.value)}
                                aria-label="Preview path"
                                className="font-mono"
                            >
                                {paths.map((p) => (
                                    <NativeSelectOption key={p} value={p}>
                                        {p}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>
                        <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Preview color scheme">
                            {(['light', 'dark'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMode(m)}
                                    aria-pressed={mode === m}
                                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium capitalize transition-colors duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        mode === m
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {m === 'light' ? (
                                        <IconSun className="h-3.5 w-3.5" />
                                    ) : (
                                        <IconMoon className="h-3.5 w-3.5" />
                                    )}
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                    {previewFull && <SitePreview full={previewFull} path={path} mode={mode} />}
                    {about && (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Uses {about.kit} on the {about.layout} layout. Edits preview at once; Save publishes them.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
