import type { TokenCursors } from '@ottabase/brand-engine';
import { CURSOR_SVG_REGISTRY, getCursorSvg, resolveCursor } from '@ottabase/brand-engine';
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Switch,
} from '@ottabase/ui-shadcn';
import {
    IconArrowsMove,
    IconBan,
    IconCrosshair,
    IconEdit,
    IconGripVertical,
    IconHelpCircle,
    IconLoader2,
    IconMoon,
    IconPointer,
    IconSun,
    IconTrash,
} from '@tabler/icons-react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

/** Convert raw SVG string to CSS cursor data URI */
function svgToCursorUri(svg: string): string {
    const trimmed = svg.trim();
    const encoded = encodeURIComponent(trimmed);
    return `url("data:image/svg+xml;utf8,${encoded}"), auto`;
}

/** Extract raw SVG from stored cursor value (url data URI or svg: prefix) */
function extractSvgFromCursor(val: string): string {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed.toLowerCase().startsWith('svg:')) return trimmed.slice(4).trim();
    // Match url("data:image/svg+xml;utf8,ENCODED") or similar
    const urlMatch = trimmed.match(
        /url\s*\(\s*["']?data:image\/svg\+xml(?:;(?:utf8|charset=utf-8))?,([^"')]+)["']?\s*\)/i,
    );
    if (urlMatch) {
        try {
            return decodeURIComponent(urlMatch[1].replace(/"/g, ''));
        } catch {
            return '';
        }
    }
    return '';
}

/** Basic SVG validation – must contain <svg */
function isValidSvgInput(str: string): boolean {
    const trimmed = str.trim();
    return trimmed.length > 0 && /<svg[\s>]/i.test(trimmed);
}

/** Dangerous patterns that could execute JS or cause XSS */
const UNSAFE_SVG_PATTERNS: { pattern: RegExp; msg: string }[] = [
    { pattern: /<script[\s>]/i, msg: 'Script tags are not allowed' },
    { pattern: /javascript\s*:/i, msg: 'javascript: URLs are not allowed' },
    { pattern: /vbscript\s*:/i, msg: 'vbscript: URLs are not allowed' },
    { pattern: /data\s*:\s*text\s*\/\s*html/i, msg: 'Embedded HTML data URIs are not allowed' },
    { pattern: /\bon\w+\s*=/i, msg: 'Event handlers (onload, onclick, etc.) are not allowed' },
    { pattern: /<\s*foreignObject/i, msg: 'foreignObject is not allowed (can embed HTML)' },
    { pattern: /<\s*object[\s>]/i, msg: 'object tags are not allowed' },
    { pattern: /<\s*embed[\s>]/i, msg: 'embed tags are not allowed' },
    { pattern: /<\s*iframe/i, msg: 'iframe tags are not allowed' },
    { pattern: /<\s*\?xml/i, msg: 'XML processing instructions are not allowed' },
];

/** Validate SVG is safe (no script, event handlers, or embedded HTML). Returns error message if unsafe. */
function validateSvgSafety(svg: string): string | null {
    const trimmed = svg.trim();
    if (!trimmed) return null;
    for (const { pattern, msg } of UNSAFE_SVG_PATTERNS) {
        if (pattern.test(trimmed)) return msg;
    }
    return null;
}

/** All cursor states that can be themed (matches globals.css bindings) */
const CURSOR_STATES = [
    'default',
    'pointer',
    'text',
    'grab',
    'grabbing',
    'crosshair',
    'not-allowed',
    'help',
    'wait',
    'move',
] as const;
type CursorState = (typeof CURSOR_STATES)[number];

/** Registry keys whose role matches a cursor state, listed first in the picker */
const REGISTRY_ROLE_FOR_STATE: Partial<Record<CursorState, string>> = {
    default: 'default',
    pointer: 'pointer',
    text: 'text',
    crosshair: 'crosshair',
};

interface CursorPreviewInfo {
    /** Resolved CSS cursor declaration (same resolution the runtime applies) */
    css: string;
    /** Raw SVG markup when the value renders an image, else null */
    svg: string | null;
    kind: 'registry' | 'custom' | 'native' | 'empty';
    /** Registry key when kind === 'registry' */
    registryKey?: string;
}

/** Resolve any stored cursor value the way the runtime does, plus preview metadata */
function cursorPreview(value: string): CursorPreviewInfo {
    const trimmed = (value || '').trim();
    if (!trimmed) return { css: 'auto', svg: null, kind: 'empty' };
    if (trimmed.startsWith('registry:')) {
        const key = trimmed.slice(9);
        const svg = getCursorSvg(key) ?? null;
        return { css: resolveCursor(trimmed), svg, kind: svg ? 'registry' : 'native', registryKey: key };
    }
    const svg = extractSvgFromCursor(trimmed);
    if (svg) return { css: resolveCursor(trimmed), svg, kind: 'custom' };
    return { css: resolveCursor(trimmed), svg: null, kind: 'native' };
}

const svgThumbSrc = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Popover gallery of all registry cursors; hover a tile to feel it */
function RegistryPicker({
    state,
    value,
    onPick,
}: {
    state: CursorState;
    value: string;
    onPick: (val: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const entries = useMemo(() => {
        const all = Object.entries(CURSOR_SVG_REGISTRY);
        const role = REGISTRY_ROLE_FOR_STATE[state];
        // Role-matching cursors first (arrows for default, hands for pointer, …)
        return role
            ? [...all.filter(([, d]) => d.fallback === role), ...all.filter(([, d]) => d.fallback !== role)]
            : all;
    }, [state]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="shrink-0" title="Pick from registry">
                    <IconPointer className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
                <p className="text-xs text-muted-foreground px-1 pb-2">
                    Built-in cursors — hover a tile to try it, click to use.
                </p>
                <div className="grid grid-cols-4 gap-1">
                    <button
                        type="button"
                        className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border p-2 hover:bg-accent"
                        onClick={() => {
                            onPick('');
                            setOpen(false);
                        }}
                    >
                        <span className="h-8 w-8 flex items-center justify-center text-muted-foreground text-lg">
                            —
                        </span>
                        <span className="text-[9px] text-muted-foreground">native</span>
                    </button>
                    {entries.map(([key, def]) => {
                        const selected = value.trim() === `registry:${key}`;
                        return (
                            <button
                                key={key}
                                type="button"
                                className={`flex flex-col items-center gap-1 rounded-md border p-2 hover:bg-accent ${
                                    selected ? 'border-primary ring-1 ring-primary' : 'border-transparent'
                                }`}
                                style={{ cursor: resolveCursor(`registry:${key}`) }}
                                onClick={() => {
                                    onPick(`registry:${key}`);
                                    setOpen(false);
                                }}
                                title={`registry:${key}`}
                            >
                                <img src={svgThumbSrc(def.svg)} alt={key} className="h-8 w-8" />
                                <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                                    {key}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

/** How a cursor state resolves for preview: the CSS to apply plus how to describe its source */
interface ResolvedCursor {
    css: string;
    /** Human label for the readout — `registry:key`, `custom SVG`, or `native <state>` */
    label: string;
    /** Art to show in the readout, when the cursor renders an image */
    svg: string | null;
    /** False when the state falls through to the browser's own cursor */
    themed: boolean;
}

/**
 * One hoverable target in the preview. Each tile is shaped like the thing its cursor
 * means (a button for `pointer`, a paragraph for `text`, …) so hovering feels like
 * using the site rather than reading a list of state names.
 */
interface PreviewTile {
    state: CursorState;
    /** Swapped in while the pointer is held down — lets one tile exercise grab → grabbing */
    pressState?: CursorState;
    hint: string;
    /** Spans the full row instead of taking a grid cell */
    wide?: boolean;
    render: (dark: boolean) => ReactNode;
}

const PREVIEW_TILES: PreviewTile[] = [
    {
        state: 'default',
        hint: 'the surface itself',
        wide: true,
        render: (dark) => (
            <span className={`text-[11px] ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Roam this strip — it carries the default cursor
            </span>
        ),
    },
    {
        state: 'pointer',
        hint: 'buttons',
        render: (dark) => (
            <span
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium shadow-sm ${
                    dark ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'
                }`}
            >
                Get started
            </span>
        ),
    },
    {
        state: 'text',
        hint: 'copy',
        render: (dark) => (
            <span className={`text-[11px] leading-tight ${dark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                Select this line
            </span>
        ),
    },
    {
        state: 'grab',
        pressState: 'grabbing',
        hint: 'hold me',
        render: (dark) => (
            <span className={`flex items-center gap-0.5 ${dark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                <IconGripVertical className="h-4 w-4" />
                <span className="text-[11px]">Drag me</span>
            </span>
        ),
    },
    {
        state: 'move',
        hint: 'reposition',
        render: (dark) => <IconArrowsMove className={`h-4 w-4 ${dark ? 'text-neutral-300' : 'text-neutral-600'}`} />,
    },
    {
        state: 'crosshair',
        hint: 'precision',
        render: (dark) => <IconCrosshair className={`h-4 w-4 ${dark ? 'text-neutral-300' : 'text-neutral-600'}`} />,
    },
    {
        state: 'not-allowed',
        hint: 'blocked',
        render: (dark) => (
            <span className={`flex items-center gap-1 opacity-60 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                <IconBan className="h-4 w-4" />
                <span className="text-[11px] line-through">Submit</span>
            </span>
        ),
    },
    {
        state: 'wait',
        hint: 'busy',
        render: (dark) => (
            <IconLoader2 className={`h-4 w-4 animate-spin ${dark ? 'text-neutral-400' : 'text-neutral-500'}`} />
        ),
    },
    {
        state: 'help',
        hint: 'tooltips',
        render: (dark) => <IconHelpCircle className={`h-4 w-4 ${dark ? 'text-neutral-300' : 'text-neutral-600'}`} />,
    },
];

/** Hoverable playground applying the kit's configured cursors, on a light or dark surface */
function PreviewSurface({ config, dark }: { config: Partial<TokenCursors>; dark?: boolean }) {
    // Which tile the pointer is over, and whether it is being held down (grab → grabbing)
    const [hovered, setHovered] = useState<CursorState | null>(null);
    const [pressed, setPressed] = useState(false);

    const resolve = useCallback(
        (state: CursorState): ResolvedCursor => {
            const raw = (config[state] || '').trim();
            if (!raw) {
                return {
                    css: state === 'default' ? 'auto' : state,
                    label: `native ${state}`,
                    svg: null,
                    themed: false,
                };
            }
            const info = cursorPreview(raw);
            const label =
                info.kind === 'registry' ? `registry:${info.registryKey}` : info.kind === 'custom' ? 'custom SVG' : raw;
            return { css: info.css, label, svg: info.svg, themed: true };
        },
        [config],
    );

    const themedCount = CURSOR_STATES.filter((state) => Boolean(config[state])).length;
    // A held-down tile previews its press state (grab → grabbing) in both the tile and the readout
    const pressState = PREVIEW_TILES.find((t) => t.state === hovered)?.pressState;
    const activeState = pressed && pressState ? pressState : hovered;
    const active = activeState ? resolve(activeState) : null;

    return (
        <div
            className={`flex-1 min-w-0 rounded-xl border p-3 transition-colors ${
                dark
                    ? 'border-neutral-700 bg-gradient-to-b from-neutral-900 to-neutral-950 text-neutral-200'
                    : 'border-border bg-gradient-to-b from-white to-neutral-50 text-neutral-800'
            }`}
            style={{ cursor: resolve('default').css }}
            onMouseLeave={() => {
                setHovered(null);
                setPressed(false);
            }}
        >
            {/* Header: which surface, and a live readout of the cursor under the pointer */}
            <div className="flex items-center justify-between gap-2 mb-2.5 min-h-[24px]">
                <span
                    className={`inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide ${
                        dark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                >
                    {dark ? <IconMoon className="h-3.5 w-3.5" /> : <IconSun className="h-3.5 w-3.5" />}
                    {dark ? 'Dark' : 'Light'}
                    <span className={dark ? 'text-neutral-600' : 'text-neutral-400'}>·</span>
                    <span className={dark ? 'text-neutral-500' : 'text-neutral-400'}>
                        {themedCount}/{CURSOR_STATES.length} themed
                    </span>
                </span>
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition-opacity ${
                        dark ? 'border-neutral-700 bg-neutral-800/70' : 'border-border bg-white'
                    } ${active ? 'opacity-100' : 'opacity-50'}`}
                >
                    {active?.svg ? (
                        <img src={svgThumbSrc(active.svg)} alt="" className="h-4 w-4" />
                    ) : (
                        <IconPointer className={`h-3 w-3 ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />
                    )}
                    {active ? (
                        <>
                            <span className="font-medium">{activeState}</span>
                            <span className={`font-mono truncate max-w-[9rem] ${active.themed ? '' : 'opacity-60'}`}>
                                {active.label}
                            </span>
                        </>
                    ) : (
                        <span className={dark ? 'text-neutral-400' : 'text-neutral-500'}>Hover to test</span>
                    )}
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PREVIEW_TILES.map((tile) => {
                    // A held-down grab tile previews `grabbing` instead
                    const state = tile.pressState && pressed && hovered === tile.state ? tile.pressState : tile.state;
                    const cursor = resolve(state);
                    const isHovered = hovered === tile.state;
                    return (
                        <div
                            key={tile.state}
                            style={{ cursor: cursor.css }}
                            title={`${state} — ${cursor.label}`}
                            onMouseEnter={() => setHovered(tile.state)}
                            onMouseDown={() => tile.pressState && setPressed(true)}
                            onMouseUp={() => setPressed(false)}
                            className={`relative flex select-none flex-col items-center justify-center gap-1 rounded-lg border px-1 text-center transition-all ${
                                tile.wide ? 'col-span-2 h-9 flex-row sm:col-span-4' : 'h-[52px]'
                            } ${
                                dark
                                    ? 'border-neutral-800 bg-neutral-800/40 hover:bg-neutral-800'
                                    : 'border-border/70 bg-white hover:bg-neutral-50'
                            } ${isHovered ? (dark ? 'ring-1 ring-neutral-500' : 'ring-1 ring-neutral-300') : ''} ${
                                cursor.themed ? '' : 'opacity-60'
                            }`}
                        >
                            {/* Dot marks a themed state; hollow means it falls back to the browser cursor */}
                            <span
                                className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${
                                    cursor.themed
                                        ? dark
                                            ? 'bg-emerald-400'
                                            : 'bg-emerald-500'
                                        : dark
                                          ? 'border border-neutral-600'
                                          : 'border border-neutral-300'
                                }`}
                            />
                            {tile.render(Boolean(dark))}
                            {!tile.wide && (
                                <span
                                    className={`w-full truncate font-mono text-[9px] ${
                                        dark ? 'text-neutral-500' : 'text-neutral-400'
                                    }`}
                                >
                                    {isHovered ? tile.hint : state}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface BrandKitCursorsTabProps {
    tokensJson: string;
    onTokensChange: (tokensJson: string) => void;
}

export function BrandKitCursorsTab({ tokensJson, onTokensChange }: BrandKitCursorsTabProps) {
    // Edit modal state: which cursor state + mode we're editing
    const [editModal, setEditModal] = useState<{
        open: boolean;
        mode: 'light' | 'dark' | 'shared';
        state: string;
        svgContent: string;
        error: string | null;
    } | null>(null);

    // Parse the current cursors from the main tokensJson config
    const parsed = useMemo(() => {
        try {
            const p = JSON.parse(tokensJson || '{}');
            return p.cursors || {};
        } catch {
            return {};
        }
    }, [tokensJson]);

    // Check if cursors are split into light/dark mode
    const isSplitMode = useMemo(() => {
        return Boolean(parsed.light || parsed.dark);
    }, [parsed]);

    const activeLight = isSplitMode ? parsed.light || {} : parsed;
    const activeDark = isSplitMode ? parsed.dark || activeLight : activeLight;

    const handleOverrideToggle = useCallback(
        (enabled: boolean) => {
            if (!enabled) {
                try {
                    const p = JSON.parse(tokensJson || '{}');
                    const lightConfig = p.cursors?.light || {};
                    p.cursors = { ...lightConfig };
                    onTokensChange(JSON.stringify(p, null, 2));
                } catch {
                    onTokensChange('{}');
                }
            } else {
                try {
                    const p = JSON.parse(tokensJson || '{}');
                    const baseConfig = p.cursors || {};
                    p.cursors = {
                        light: { ...baseConfig },
                        dark: { ...baseConfig },
                    };
                    onTokensChange(JSON.stringify(p, null, 2));
                } catch {
                    onTokensChange('{}');
                }
            }
        },
        [tokensJson, onTokensChange],
    );

    const hasAnyCursor = useMemo(() => {
        const flat = isSplitMode ? { ...(parsed.light || {}), ...(parsed.dark || {}) } : parsed;
        return Object.values(flat).some(Boolean);
    }, [parsed, isSplitMode]);

    const handleClearAll = useCallback(() => {
        try {
            const p = JSON.parse(tokensJson || '{}');
            delete p.cursors;
            onTokensChange(JSON.stringify(p, null, 2));
        } catch {
            // Error silently on manual typed JSON failures
        }
    }, [tokensJson, onTokensChange]);

    const handleUpdate = (mode: 'light' | 'dark' | 'shared', state: string, val: string) => {
        try {
            const p = JSON.parse(tokensJson || '{}');
            p.cursors = p.cursors || {};

            if (mode === 'shared') {
                p.cursors = { ...p.cursors, [state]: val || undefined };
            } else {
                p.cursors[mode] = { ...(p.cursors[mode] || {}), [state]: val || undefined };
            }
            onTokensChange(JSON.stringify(p, null, 2));
        } catch {
            // Error silently on manual typed JSON failures
        }
    };

    const openSvgEditModal = useCallback(
        (mode: 'light' | 'dark' | 'shared', state: string) => {
            const config = mode === 'shared' ? activeLight : mode === 'light' ? activeLight : activeDark;
            const currentVal = config[state] || '';
            const svgContent = extractSvgFromCursor(currentVal);
            setEditModal({
                open: true,
                mode,
                state,
                svgContent,
                error: null,
            });
        },
        [activeLight, activeDark],
    );

    const applySvgFromModal = useCallback(() => {
        if (!editModal) return;
        const { mode, state, svgContent } = editModal;
        if (!isValidSvgInput(svgContent)) {
            setEditModal((m) => (m ? { ...m, error: 'Enter valid SVG content (must contain <svg>)' } : m));
            return;
        }
        const safetyError = validateSvgSafety(svgContent);
        if (safetyError) {
            setEditModal((m) => (m ? { ...m, error: `Unsafe SVG: ${safetyError}` } : m));
            return;
        }
        const cursorUri = svgToCursorUri(svgContent);
        handleUpdate(mode, state, cursorUri);
        setEditModal(null);
    }, [editModal, tokensJson, onTokensChange]);

    const clearSvgFromModal = useCallback(() => {
        if (!editModal) return;
        handleUpdate(editModal.mode, editModal.state, '');
        setEditModal(null);
    }, [editModal, tokensJson, onTokensChange]);

    const renderControls = (mode: 'light' | 'dark' | 'shared', config: Partial<TokenCursors>) => {
        return (
            <div className="space-y-4 p-4 rounded-lg border bg-card border-border text-card-foreground">
                {mode !== 'shared' && <h3 className="font-semibold text-sm capitalize mb-2">{mode} Mode Overrides</h3>}

                {CURSOR_STATES.map((state) => {
                    const currentVal = config[state] || '';
                    const preview = cursorPreview(currentVal);
                    const isSafe = preview.kind !== 'custom' || !validateSvgSafety(preview.svg || '');
                    return (
                        <div key={state} className="space-y-2">
                            <Label className="capitalize text-muted-foreground">{state} Cursor</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder={`Native ${state} — or registry:… (pick →)`}
                                    value={currentVal}
                                    onChange={(e) => handleUpdate(mode, state, e.target.value)}
                                    className="flex-1"
                                />
                                <RegistryPicker
                                    state={state}
                                    value={currentVal}
                                    onPick={(val) => handleUpdate(mode, state, val)}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={() => openSvgEditModal(mode, state)}
                                    title="Edit custom SVG cursor"
                                >
                                    <IconEdit className="h-4 w-4" />
                                </Button>
                            </div>
                            {preview.svg && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">Preview:</span>
                                    {isSafe ? (
                                        <div
                                            className="w-8 h-8 rounded border border-border/50 bg-muted/30 flex items-center justify-center overflow-hidden"
                                            style={{ cursor: preview.css }}
                                            title="Hover to see cursor"
                                        >
                                            <img
                                                src={svgThumbSrc(preview.svg)}
                                                alt=""
                                                className="max-w-full max-h-full object-contain pointer-events-none"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded border border-destructive/50 bg-destructive/5 flex items-center justify-center text-destructive text-[10px]">
                                            Unsafe
                                        </div>
                                    )}
                                    {preview.kind === 'registry' && (
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            registry:{preview.registryKey}
                                        </span>
                                    )}
                                </div>
                            )}
                            {state === 'default' && (
                                <p className="text-[10px] text-muted-foreground">
                                    Accepts native CSS keywords, a registry cursor (pick from the gallery), or custom
                                    SVG via Edit.
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0 gap-4">
                    <div className="space-y-1.5">
                        <CardTitle>Cursors</CardTitle>
                        <CardDescription>
                            Configure native, built-in registry, or fully custom SVG cursors. Supports distinct cursors
                            for light vs dark mode backgrounds.
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={handleClearAll}
                        disabled={!hasAnyCursor}
                        title="Reset every cursor state to native"
                    >
                        <IconTrash className="h-4 w-4 mr-1" />
                        Clear all
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Preview — hover the tiles</Label>
                        <div className="flex flex-col lg:flex-row gap-3">
                            <PreviewSurface config={activeLight} />
                            <PreviewSurface config={activeDark} dark />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Each tile is shaped like the thing its cursor means — hold the drag tile to feel{' '}
                            <code className="font-mono">grabbing</code>. A green dot marks a themed state; dimmed tiles
                            fall back to the native cursor. The dark surface shows how the white outline keeps cursors
                            legible.
                        </p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4 bg-accent/50">
                        <div>
                            <Label>Different for dark mode</Label>
                            <p className="text-xs text-muted-foreground">
                                For custom SVG cursors, you likely need a different coloured SVG for dark backgrounds.
                            </p>
                        </div>
                        <Switch checked={isSplitMode} onCheckedChange={handleOverrideToggle} />
                    </div>

                    {!isSplitMode ? (
                        renderControls('shared', activeLight)
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderControls('light', activeLight)}
                            {renderControls('dark', activeDark)}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* SVG Edit Modal */}
            <Dialog open={!!editModal?.open} onOpenChange={(open) => !open && setEditModal(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit SVG Cursor{editModal ? ` – ${editModal.state}` : ''}</DialogTitle>
                        <DialogDescription>
                            Paste SVG markup below. It will be used as a custom cursor. Recommended size: 24×24 or
                            32×32.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                        <div className="flex-1 flex flex-col gap-2 min-h-0">
                            <Label htmlFor="svg-content">SVG content</Label>
                            <textarea
                                id="svg-content"
                                value={editModal?.svgContent ?? ''}
                                onChange={(e) =>
                                    setEditModal((m) => (m ? { ...m, svgContent: e.target.value, error: null } : m))
                                }
                                placeholder='<svg width="24" height="24" viewBox="0 0 24 24">...</svg>'
                                className="min-h-[200px] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm resize-y dark:border-muted"
                                spellCheck={false}
                            />
                            {editModal?.error && <p className="text-sm text-destructive">{editModal.error}</p>}
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                            <span className="text-xs text-muted-foreground">Preview:</span>
                            {editModal?.svgContent && isValidSvgInput(editModal.svgContent) ? (
                                validateSvgSafety(editModal.svgContent) ? (
                                    <div className="w-12 h-12 rounded border border-destructive/50 bg-destructive/5 flex items-center justify-center text-destructive text-xs px-2 text-center">
                                        Unsafe SVG
                                    </div>
                                ) : (
                                    <div
                                        className="w-12 h-12 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden"
                                        style={{ cursor: svgToCursorUri(editModal.svgContent) }}
                                        title="Hover to see cursor"
                                    >
                                        <img
                                            src={svgThumbSrc(editModal.svgContent)}
                                            alt=""
                                            className="max-w-full max-h-full object-contain pointer-events-none"
                                        />
                                    </div>
                                )
                            ) : (
                                <div className="w-12 h-12 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-xs">
                                    —
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        {editModal?.svgContent && (
                            <Button
                                type="button"
                                variant="outline"
                                className="mr-auto text-destructive hover:text-destructive"
                                onClick={clearSvgFromModal}
                            >
                                <IconTrash className="h-4 w-4 mr-1" />
                                Clear
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => setEditModal(null)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={applySvgFromModal}
                            disabled={
                                !editModal?.svgContent?.trim() ||
                                !isValidSvgInput(editModal.svgContent) ||
                                !!validateSvgSafety(editModal.svgContent)
                            }
                        >
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
