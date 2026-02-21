import type { TokenCursors } from '@ottabase/brand-engine';
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
    Switch,
} from '@ottabase/ui-shadcn';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

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
    const urlMatch = trimmed.match(/url\s*\(\s*["']?data:image\/svg\+xml(?:;utf8)?,([^"')]+)["']?\s*\)/i);
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
            // Cursors are stored at the root of the theme alongside tokens, wait no...
            // the implementation plan says TokenCursors is in tokens.ts DesignTokens.
            // Oh right, `cursors` was added to `tokens` vs root BrandTheme.
            // Actually resolver.ts maps merged.cursors to resolved.cursors.
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

    const renderControls = (mode: 'light' | 'dark' | 'shared', config: Partial<TokenCursors>) => {
        return (
            <div className="space-y-4 p-4 rounded-lg border bg-card border-border text-card-foreground">
                {mode !== 'shared' && <h3 className="font-semibold text-sm capitalize mb-2">{mode} Mode Overrides</h3>}

                {CURSOR_STATES.map((state) => {
                    const currentVal = config[state] || '';
                    const svgContent = extractSvgFromCursor(currentVal);
                    const hasSvg = !!svgContent;
                    const isSafeSvg = hasSvg && !validateSvgSafety(svgContent);
                    return (
                        <div key={state} className="space-y-2">
                            <Label className="capitalize text-muted-foreground">{state} Cursor</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder={`Native ${state}`}
                                    value={currentVal}
                                    onChange={(e) => handleUpdate(mode, state, e.target.value)}
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={() => openSvgEditModal(mode, state)}
                                    title="Edit SVG cursor"
                                >
                                    <IconEdit className="h-4 w-4" />
                                </Button>
                            </div>
                            {hasSvg && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">Preview:</span>
                                    {isSafeSvg ? (
                                        <div
                                            className="w-8 h-8 rounded border border-border/50 bg-muted/30 flex items-center justify-center overflow-hidden"
                                            style={{ cursor: currentVal }}
                                            title="Hover to see cursor"
                                        >
                                            <img
                                                src={`data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`}
                                                alt=""
                                                className="max-w-full max-h-full object-contain pointer-events-none"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded border border-destructive/50 bg-destructive/5 flex items-center justify-center text-destructive text-[10px]">
                                            Unsafe
                                        </div>
                                    )}
                                </div>
                            )}
                            {state === 'default' && (
                                <p className="text-[10px] text-muted-foreground">
                                    Accepts native CSS cursors, or use Edit to paste SVG content.
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
                <CardHeader>
                    <CardTitle>Cursors</CardTitle>
                    <CardDescription>
                        Configure native or entirely customized mouse cursors using Data URIs. Supports defining
                        distinct cursors for light vs dark mode backgrounds.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                                            src={`data:image/svg+xml;utf8,${encodeURIComponent(editModal.svgContent)}`}
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
