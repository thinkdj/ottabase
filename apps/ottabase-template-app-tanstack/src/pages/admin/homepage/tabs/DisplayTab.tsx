import {
    homepageSlotNames,
    homepageSlotVariantRegistry,
    homepageVariantBySlotSchema,
} from '@ottabase/homepage-contract';
import { PRESET_MAP } from '@ottabase/brand-engine';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
} from '@ottabase/ui-shadcn';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { displayHooks, sectionHooks, type HomepageDisplayRow, type HomepageSectionRow } from '../homepage-model-hooks';

const THEME_PRESET_IDS = Object.keys(PRESET_MAP).sort((a, b) => a.localeCompare(b));

type Props = {
    display: HomepageDisplayRow | undefined;
    displayLoading: boolean;
    sections: HomepageSectionRow[];
    sectionsLoading: boolean;
};

export function DisplayTab({ display, displayLoading, sections, sectionsLoading }: Props) {
    const queryClient = useQueryClient();
    const updateDisplay = displayHooks.useUpdate();
    const updateSection = sectionHooks.useUpdate();

    const [themePresetId, setThemePresetId] = useState('');
    const [variantBySlot, setVariantBySlot] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!display) return;
        setThemePresetId(display.themePresetId ?? '');
        setVariantBySlot({ ...(display.variantBySlotJson ?? {}) });
    }, [display]);

    const sectionForSlot = useCallback((slot: string) => sections.find((s) => s.slot === slot), [sections]);

    const mergedVariantMap = useMemo(() => {
        const out: Record<string, string> = {};
        for (const slot of homepageSlotNames) {
            const def = homepageSlotVariantRegistry[slot].defaultVariant;
            out[slot] = variantBySlot[slot] ?? def;
        }
        return out;
    }, [variantBySlot]);

    const saveDisplay = useCallback(() => {
        const variantResult = homepageVariantBySlotSchema.safeParse(mergedVariantMap);
        if (!variantResult.success) {
            toast.error('Invalid variant selection');
            return;
        }
        updateDisplay.mutate(
            {
                id: 'default',
                data: {
                    themePresetId: themePresetId.trim() || 'default',
                    variantBySlotJson: variantResult.data,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Display settings saved');
                    void queryClient.invalidateQueries();
                },
                onError: () => toast.error('Failed to save display settings'),
            },
        );
    }, [themePresetId, mergedVariantMap, updateDisplay, queryClient]);

    const setSlotVariant = useCallback((slot: string, value: string) => {
        setVariantBySlot((prev) => ({ ...prev, [slot]: value }));
    }, []);

    const setSlotActive = useCallback(
        (section: HomepageSectionRow | undefined, checked: boolean) => {
            if (!section?.id) {
                toast.error('Section row missing — run Seed defaults first.');
                return;
            }
            updateSection.mutate(
                { id: section.id, data: { isActive: checked } },
                {
                    onSuccess: () => {
                        toast.success(checked ? 'Section enabled' : 'Section disabled');
                        void queryClient.invalidateQueries();
                    },
                    onError: () => toast.error('Failed to update section'),
                },
            );
        },
        [updateSection, queryClient],
    );

    return (
        <Card className="border-border dark:border-border">
            <CardHeader>
                <CardTitle>Display settings</CardTitle>
                <CardDescription className="dark:text-muted-foreground">
                    Theme preset, per-slot layout variant, and whether each section is shown on the homepage.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {(displayLoading || sectionsLoading) && (
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">Loading…</p>
                )}
                {!displayLoading && !display && (
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        No display row yet. Run migrations then use &quot;Seed defaults&quot; or create id{' '}
                        <code className="text-xs">default</code>.
                    </p>
                )}
                {display && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="theme-preset-select">Theme preset</Label>
                            <Select value={themePresetId || 'default'} onValueChange={setThemePresetId}>
                                <SelectTrigger id="theme-preset-select" className="max-w-md dark:border-border">
                                    <SelectValue placeholder="Preset" />
                                </SelectTrigger>
                                <SelectContent>
                                    {THEME_PRESET_IDS.map((id) => (
                                        <SelectItem key={id} value={id}>
                                            {id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Slots</Label>
                            <div className="grid gap-3">
                                {homepageSlotNames.map((slot) => {
                                    const reg = homepageSlotVariantRegistry[slot];
                                    const sec = sectionForSlot(slot);
                                    const value = variantBySlot[slot] ?? reg.defaultVariant;
                                    const active = sec ? sec.isActive !== false : false;
                                    return (
                                        <div
                                            key={slot}
                                            className="flex flex-col gap-3 rounded-lg border border-border p-4 dark:border-border sm:flex-row sm:items-start sm:justify-between"
                                        >
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="font-medium text-foreground dark:text-foreground">
                                                        {reg.label}
                                                    </span>
                                                    <span className="font-mono text-xs text-muted-foreground dark:text-muted-foreground">
                                                        {slot}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                                                    {reg.variants.find((x) => x.id === value)?.description}
                                                </p>
                                            </div>
                                            <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[280px] sm:flex-row sm:items-center sm:justify-end">
                                                <div className="flex items-center gap-2 sm:order-first">
                                                    <Switch
                                                        id={`active-${slot}`}
                                                        checked={active}
                                                        disabled={!sec}
                                                        onCheckedChange={(c) => setSlotActive(sec, c)}
                                                        aria-label={`${reg.label} visible on homepage`}
                                                    />
                                                    <Label
                                                        htmlFor={`active-${slot}`}
                                                        className="cursor-pointer text-sm font-normal text-muted-foreground dark:text-muted-foreground"
                                                    >
                                                        {sec ? 'Shown' : 'No row'}
                                                    </Label>
                                                </div>
                                                <Select value={value} onValueChange={(v) => setSlotVariant(slot, v)}>
                                                    <SelectTrigger
                                                        id={`variant-${slot}`}
                                                        className="w-full dark:border-border sm:w-[200px]"
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {reg.variants.map((v) => (
                                                            <SelectItem key={v.id} value={v.id}>
                                                                {v.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Button type="button" onClick={saveDisplay} disabled={updateDisplay.isPending}>
                            Save theme &amp; variants
                        </Button>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                            Section on/off saves immediately. Theme and variant picks apply when you click the button
                            above.
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
