import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@ottabase/ui-shadcn';

interface BrandKitAdvancedTabProps {
    defaultColorScheme: 'light' | 'dark' | 'system';
    allowDarkModeToggle: boolean;
    customCss: string;
    hideOttabaseBranding: boolean;
    /** Raw design-tokens JSON for power users */
    tokensJson?: string;
    onTokensChange?: (tokensJson: string) => void;
    onChange: (data: {
        defaultColorScheme: 'light' | 'dark' | 'system';
        allowDarkModeToggle: boolean;
        customCss: string;
        hideOttabaseBranding: boolean;
    }) => void;
}

export function BrandKitAdvancedTab({
    defaultColorScheme,
    allowDarkModeToggle,
    customCss,
    hideOttabaseBranding,
    tokensJson,
    onTokensChange,
    onChange,
}: BrandKitAdvancedTabProps) {
    return (
        <div className="space-y-6">
            <div>
                <Label>Default color scheme</Label>
                <Select
                    value={defaultColorScheme}
                    onValueChange={(v) =>
                        onChange({
                            defaultColorScheme: v as 'light' | 'dark' | 'system',
                            allowDarkModeToggle,
                            customCss,
                            hideOttabaseBranding,
                        })
                    }
                >
                    <SelectTrigger className="mt-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 dark:border-muted">
                <div>
                    <Label>Allow dark mode toggle</Label>
                    <p className="text-xs text-muted-foreground">Let users switch light/dark in the app.</p>
                </div>
                <Switch
                    checked={allowDarkModeToggle}
                    onCheckedChange={(v) =>
                        onChange({
                            defaultColorScheme,
                            allowDarkModeToggle: v,
                            customCss,
                            hideOttabaseBranding,
                        })
                    }
                />
            </div>

            <div>
                <Label htmlFor="customCss">Custom CSS</Label>
                <p className="text-xs text-muted-foreground mb-2">Injected into the document. Use for overrides.</p>
                <textarea
                    id="customCss"
                    className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 font-mono text-sm dark:border-muted"
                    value={customCss}
                    onChange={(e) =>
                        onChange({
                            defaultColorScheme,
                            allowDarkModeToggle,
                            customCss: e.target.value,
                            hideOttabaseBranding,
                        })
                    }
                    placeholder=":root { --custom-var: value; }"
                />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 dark:border-muted">
                <div>
                    <Label>Hide Ottabase branding</Label>
                    <p className="text-xs text-muted-foreground">Remove &quot;Powered by Ottabase&quot; footer.</p>
                </div>
                <Switch
                    checked={hideOttabaseBranding}
                    onCheckedChange={(v) =>
                        onChange({
                            defaultColorScheme,
                            allowDarkModeToggle,
                            customCss,
                            hideOttabaseBranding: v,
                        })
                    }
                />
            </div>

            {/* Raw design-tokens JSON – power-user escape hatch */}
            {onTokensChange && (
                <div>
                    <Label htmlFor="tokensJson">Design tokens (JSON)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                        Raw token overrides. Edits here take effect immediately in the preview.
                    </p>
                    <textarea
                        id="tokensJson"
                        className="w-full min-h-[180px] rounded-md border bg-background px-3 py-2 font-mono text-sm dark:border-muted"
                        value={tokensJson ?? '{}'}
                        onChange={(e) => onTokensChange(e.target.value)}
                        spellCheck={false}
                    />
                </div>
            )}
        </div>
    );
}
