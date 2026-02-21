import type { TokenMotion } from '@ottabase/brand-engine';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Label,
    Switch,
} from '@ottabase/ui-shadcn';
import { useCallback, useMemo } from 'react';

interface BrandKitMotionTabProps {
    tokensJson: string;
    onTokensChange: (tokensJson: string) => void;
}

const EASING_OPTIONS = [
    { value: 'cubic-bezier(0.4, 0, 0.2, 1)', label: 'Normal (ease-in-out)' },
    { value: 'cubic-bezier(0, 0, 0.2, 1)', label: 'Enter (ease-out)' },
    { value: 'cubic-bezier(0.4, 0, 1, 1)', label: 'Exit (ease-in)' },
    { value: 'linear', label: 'Linear' },
    { value: 'cubic-bezier(0.34, 1.56, 0.64, 1)', label: 'Bouncy' },
];

export function BrandKitMotionTab({ tokensJson, onTokensChange }: BrandKitMotionTabProps) {
    // Parse the current motion token from JSON
    const parsed = useMemo(() => {
        try {
            const p = JSON.parse(tokensJson || '{}') as { motion?: any };
            return p.motion || {};
        } catch {
            return {};
        }
    }, [tokensJson]);

    // Check if motion is split into light/dark mode
    const isSplitMode = useMemo(() => {
        return Boolean(parsed.light || parsed.dark);
    }, [parsed]);

    const activeLight = isSplitMode ? parsed.light || {} : parsed;
    const activeDark = isSplitMode ? parsed.dark || activeLight : activeLight;

    const handleOverrideToggle = useCallback(
        (enabled: boolean) => {
            if (!enabled) {
                // Revert back to single unified mode. Take light as the source of truth.
                try {
                    const p = JSON.parse(tokensJson || '{}');
                    const lightConfig = p.motion?.light || {};
                    p.motion = { ...lightConfig };
                    onTokensChange(JSON.stringify(p, null, 2));
                } catch {
                    onTokensChange('{}');
                }
            } else {
                // Split into light and dark
                try {
                    const p = JSON.parse(tokensJson || '{}');
                    const baseConfig = p.motion || {};
                    p.motion = {
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

    const handleUpdate = (mode: 'light' | 'dark' | 'shared', updates: Partial<TokenMotion>) => {
        try {
            const p = JSON.parse(tokensJson || '{}');
            p.motion = p.motion || {};

            if (mode === 'shared') {
                p.motion = { ...p.motion, ...updates };
            } else {
                p.motion[mode] = { ...(p.motion[mode] || {}), ...updates };
            }
            onTokensChange(JSON.stringify(p, null, 2));
        } catch {
            // Ignore parse errors on manual input
        }
    };

    const renderControls = (mode: 'light' | 'dark' | 'shared', config: Partial<TokenMotion>) => {
        const dFast = parseInt(config.durationFast || '100', 10);
        const dNormal = parseInt(config.durationNormal || '200', 10);
        const dSlow = parseInt(config.durationSlow || '400', 10);
        const easing = config.easing || 'cubic-bezier(0.4, 0, 0.2, 1)';
        const easingEnter = config.easingEnter || 'cubic-bezier(0, 0, 0.2, 1)';
        const easingExit = config.easingExit || 'cubic-bezier(0.4, 0, 1, 1)';
        const disableAnimations = Boolean(config.disableAnimations);

        return (
            <div className="space-y-4 p-4 rounded-lg border bg-card border-border text-card-foreground">
                {mode !== 'shared' && <h3 className="font-semibold text-sm capitalize mb-2">{mode} Mode Overrides</h3>}

                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                    <Checkbox
                        id={`disable-animations-${mode}`}
                        checked={disableAnimations}
                        onCheckedChange={(c) => handleUpdate(mode, { disableAnimations: c === true })}
                        className="mt-0.5"
                    />
                    <div className="grid gap-1">
                        <Label htmlFor={`disable-animations-${mode}`} className="cursor-pointer text-sm">
                            Disable animations
                        </Label>
                        <p className="text-xs text-muted-foreground">Sets duration vars to 0s for reduced motion.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-muted-foreground">Fast Duration ({dFast}ms)</Label>
                    <input
                        type="range"
                        min="50"
                        max="500"
                        step="10"
                        value={dFast}
                        onChange={(e) => handleUpdate(mode, { durationFast: `${e.target.value}ms` })}
                        className="w-full accent-primary"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-muted-foreground">Normal Duration ({dNormal}ms)</Label>
                    <input
                        type="range"
                        min="100"
                        max="1000"
                        step="10"
                        value={dNormal}
                        onChange={(e) => handleUpdate(mode, { durationNormal: `${e.target.value}ms` })}
                        className="w-full accent-primary"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-muted-foreground">Slow Duration ({dSlow}ms)</Label>
                    <input
                        type="range"
                        min="200"
                        max="2000"
                        step="10"
                        value={dSlow}
                        onChange={(e) => handleUpdate(mode, { durationSlow: `${e.target.value}ms` })}
                        className="w-full accent-primary"
                    />
                </div>
                <div className="space-y-2 pt-2">
                    <Label className="text-muted-foreground">Default Easing</Label>
                    <select
                        value={easing}
                        onChange={(e) => handleUpdate(mode, { easing: e.target.value })}
                        className="w-full p-2 text-sm border rounded bg-background border-input"
                    >
                        {EASING_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="text-black">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <Label className="text-muted-foreground">Enter Easing</Label>
                    <select
                        value={easingEnter}
                        onChange={(e) => handleUpdate(mode, { easingEnter: e.target.value })}
                        className="w-full p-2 text-sm border rounded bg-background border-input"
                    >
                        {EASING_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="text-black">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <Label className="text-muted-foreground">Exit Easing</Label>
                    <select
                        value={easingExit}
                        onChange={(e) => handleUpdate(mode, { easingExit: e.target.value })}
                        className="w-full p-2 text-sm border rounded bg-background border-input"
                    >
                        {EASING_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="text-black">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="mt-4 p-4 rounded bg-muted/20 flex items-center justify-center overflow-hidden h-24">
                    <div
                        className="w-8 h-8 rounded-full bg-primary"
                        style={{
                            animation: `motion-preview-pulse ${disableAnimations ? '0ms' : `${dSlow}ms`} ${easing} infinite alternate`,
                        }}
                    />
                    <style>{`
                        @keyframes motion-preview-pulse {
                            0% { transform: scale(0.8) translateX(-20px); opacity: 0.5; }
                            100% { transform: scale(1.2) translateX(20px); opacity: 1; }
                        }
                    `}</style>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Motion &amp; Animation</CardTitle>
                <CardDescription>
                    Configure transition speeds and easing curves across the UI. You can define a separate set of
                    animation tokens specifically for users in dark mode.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4 bg-accent/50">
                    <div>
                        <Label>Different for dark mode</Label>
                        <p className="text-xs text-muted-foreground">
                            Define entirely separate motion configs for light vs dark mode environments.
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
    );
}
