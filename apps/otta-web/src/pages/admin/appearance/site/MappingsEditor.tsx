/**
 * Which brand kit and layout each route gets: the mapping rows, and a form to add one.
 * The highest priority wins when several patterns match a path.
 */
import { isValidPathPattern } from '@ottabase/ottalayout';
import { EmptyState } from '@ottabase/ui-components';
import {
    Badge,
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { IconAdjustments, IconPlus, IconTrash } from '@tabler/icons-react';
import { memo, useState } from 'react';
import type { LayoutMappingItem, LayoutTemplateItem } from '../brand/brandApi';
import { BUILT_IN_PRESETS, getTemplateConfig, LayoutMiniPreview } from './LayoutTemplates';

/** A mapping row with a client-only key, so editing its pattern never remounts the row */
export type MappingRowItem = LayoutMappingItem & { rowKey: string };
let nextRowKey = 0;
export const withRowKey = (m: LayoutMappingItem): MappingRowItem => ({ ...m, rowKey: m.id ?? `new-${nextRowKey++}` });
export const stripRowKey = ({ rowKey: _rowKey, ...m }: MappingRowItem): LayoutMappingItem => m;
export const mappingComplete = (m: LayoutMappingItem) =>
    !!m.pathPattern.trim() && isValidPathPattern(m.pathPattern.trim()) && !!m.layoutTemplateId && !!m.brandKitId;

const th = 'px-3 py-2 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const eyebrow = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

export function MappingsEditor({
    value,
    layoutOptions,
    kits,
    onChange,
}: {
    value: MappingRowItem[];
    layoutOptions: LayoutTemplateItem[];
    kits: Array<{ id: string; name: string }>;
    onChange: (next: MappingRowItem[]) => void;
}) {
    const [pathPattern, setPathPattern] = useState('');
    const [layoutTemplateId, setLayoutTemplateId] = useState('');
    const [brandKitId, setBrandKitId] = useState('');
    const [priority, setPriority] = useState(0);
    const patternError =
        pathPattern.trim() && !isValidPathPattern(pathPattern.trim()) ? 'Use *, ** or a literal path' : '';
    const ready = !!pathPattern.trim() && !patternError && !!layoutTemplateId && !!brandKitId;

    const update = (idx: number, patch: Partial<LayoutMappingItem>) =>
        onChange(value.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    const add = () => {
        if (!ready) return;
        onChange([
            ...value,
            withRowKey({
                pathPattern: pathPattern.trim(),
                layoutTemplateId,
                brandKitId,
                priority,
                tokenOverridesJson: null,
            }),
        ]);
        setPathPattern('');
        setLayoutTemplateId('');
        setBrandKitId('');
        setPriority(0);
    };

    return (
        <div className="space-y-4">
            {kits.length === 0 && <p className="text-sm text-warning">Make a brand kit before mapping routes.</p>}
            {value.length === 0 ? (
                <EmptyState
                    compact
                    title="No routes mapped yet."
                    description={
                        <>
                            Every path falls back to the default kit and layout. Add{' '}
                            <code className="rounded bg-muted/70 px-1">/**</code> to set the whole site, or{' '}
                            <code className="rounded bg-muted/70 px-1">/blog/**</code> for one area.
                        </>
                    }
                />
            ) : (
                <div className="overflow-x-auto rounded-lg bg-background ring-1 ring-border">
                    <table className="min-w-full divide-y divide-border/60 text-sm">
                        <thead className="bg-muted/40">
                            <tr>
                                <th className={th}>Path pattern</th>
                                <th className={th}>Layout</th>
                                <th className={th}>Brand kit</th>
                                <th className={th}>Priority</th>
                                <th className={th}>
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 bg-background">
                            {value.map((m, idx) => (
                                <MappingRow
                                    key={m.rowKey}
                                    mapping={m}
                                    layoutOptions={layoutOptions}
                                    kits={kits}
                                    onUpdate={(patch) => update(idx, patch)}
                                    onRemove={() => onChange(value.filter((_, i) => i !== idx))}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="space-y-4 rounded-lg bg-muted/40 p-4">
                <p className={eyebrow}>Add a route</p>
                <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-[10rem] flex-1">
                        <Input
                            value={pathPattern}
                            onChange={(e) => setPathPattern(e.target.value)}
                            placeholder="/blog/** or /docs/*"
                            aria-label="Path pattern"
                            className={`bg-background font-mono ${patternError ? 'border-destructive' : ''}`}
                        />
                        {patternError && <p className="mt-1 text-xs text-destructive">{patternError}</p>}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Priority
                        <Input
                            type="number"
                            value={priority}
                            onChange={(e) => setPriority(Number(e.target.value) || 0)}
                            aria-label="Priority"
                            title="Higher wins when several patterns match"
                            className="w-16 bg-background"
                        />
                    </label>
                    <Select value={brandKitId} onValueChange={setBrandKitId}>
                        <SelectTrigger className="w-full bg-background" aria-label="Brand kit">
                            <SelectValue placeholder="Brand kit" />
                        </SelectTrigger>
                        <SelectContent>
                            {kits.map((k) => (
                                <SelectItem key={k.id} value={k.id}>
                                    {k.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <p className={`mb-2 ${eyebrow}`}>Layout</p>
                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]">
                        {layoutOptions.map((option) => {
                            const selected = layoutTemplateId === option.id;
                            const isPreset = BUILT_IN_PRESETS.some((p) => p.id === option.id);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setLayoutTemplateId(selected ? '' : option.id)}
                                    aria-pressed={selected}
                                    className={`rounded-lg bg-background p-2 text-left transition-all duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        selected ? 'ring-2 ring-primary' : 'ring-1 ring-border/60 hover:ring-border'
                                    }`}
                                >
                                    <div className="mb-1.5 flex items-center justify-between gap-1.5">
                                        <p className="truncate text-xs font-medium">{option.name}</p>
                                        {!isPreset && (
                                            <Badge
                                                variant="secondary"
                                                className="shrink-0 bg-background px-1.5 text-[0.5625rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border"
                                            >
                                                Custom
                                            </Badge>
                                        )}
                                    </div>
                                    <LayoutMiniPreview config={getTemplateConfig(option)} compact />
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <p className="text-xs text-muted-foreground">
                        {kits.length === 0
                            ? 'Make a brand kit first.'
                            : !pathPattern.trim()
                              ? 'Start with a path pattern.'
                              : patternError
                                ? 'Fix the path pattern.'
                                : !brandKitId
                                  ? 'Choose a brand kit.'
                                  : !layoutTemplateId
                                    ? 'Pick a layout.'
                                    : 'Ready. Add it, then save.'}
                    </p>
                    <Button size="sm" onClick={add} disabled={!ready || kits.length === 0}>
                        <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                        Add route
                    </Button>
                </div>
            </div>
        </div>
    );
}

/** One mapping row: inline fields, and token overrides for the route behind a toggle */
const MappingRow = memo(function MappingRow({
    mapping,
    layoutOptions,
    kits,
    onUpdate,
    onRemove,
}: {
    mapping: LayoutMappingItem;
    layoutOptions: LayoutTemplateItem[];
    kits: Array<{ id: string; name: string }>;
    onUpdate: (patch: Partial<LayoutMappingItem>) => void;
    onRemove: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [overrideText, setOverrideText] = useState(mapping.tokenOverridesJson ?? '');
    const [jsonError, setJsonError] = useState('');
    const hasOverrides = !!mapping.tokenOverridesJson && mapping.tokenOverridesJson !== '{}';
    const pathError = mapping.pathPattern.trim() && !isValidPathPattern(mapping.pathPattern.trim());

    const commitOverrides = () => {
        const trimmed = overrideText.trim();
        if (!trimmed || trimmed === '{}') {
            onUpdate({ tokenOverridesJson: null });
            setJsonError('');
            return;
        }
        try {
            JSON.parse(trimmed);
            onUpdate({ tokenOverridesJson: trimmed });
            setJsonError('');
        } catch {
            setJsonError('Not valid JSON');
        }
    };

    return (
        <>
            <tr className="transition-colors duration-normal hover:bg-muted/40">
                <td className="px-3 py-2 align-top">
                    <Input
                        value={mapping.pathPattern}
                        onChange={(e) => onUpdate({ pathPattern: e.target.value })}
                        aria-label="Path pattern"
                        className={`h-8 min-w-[9rem] font-mono text-xs ${pathError ? 'border-destructive' : ''}`}
                    />
                    {pathError && (
                        <p className="mt-0.5 text-[0.625rem] text-destructive">Use *, ** or a literal path</p>
                    )}
                </td>
                <td className="px-3 py-2 align-top">
                    <Select value={mapping.layoutTemplateId} onValueChange={(v) => onUpdate({ layoutTemplateId: v })}>
                        <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Layout">
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
                        <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Brand kit">
                            <SelectValue placeholder="Brand kit" />
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
                        aria-label="Priority"
                        className="h-8 w-16 text-xs"
                    />
                </td>
                <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant={hasOverrides ? 'default' : 'ghost'}
                            onClick={() => setExpanded(!expanded)}
                            aria-label="Token overrides for this route"
                            aria-expanded={expanded}
                            className="h-7 w-7 p-0"
                        >
                            <IconAdjustments className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onRemove}
                            aria-label="Remove route"
                            className="h-7 w-7 p-0"
                        >
                            <IconTrash className="h-4 w-4" />
                        </Button>
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr>
                    <td colSpan={5} className="px-3 pb-3 pt-0">
                        <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className={eyebrow}>Route token overrides</p>
                                    <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                                        Partial JSON merged over the kit's theme on this route only.
                                    </p>
                                </div>
                                {overrideText.trim() && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs text-muted-foreground"
                                        onClick={() => {
                                            setOverrideText('');
                                            onUpdate({ tokenOverridesJson: null });
                                        }}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                            <textarea
                                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                rows={5}
                                value={overrideText}
                                onChange={(e) => setOverrideText(e.target.value)}
                                onBlur={commitOverrides}
                                placeholder={`{\n  "color": {\n    "primary": "220 90% 56%"\n  }\n}`}
                                spellCheck={false}
                                aria-label="Token overrides JSON"
                            />
                            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
});
