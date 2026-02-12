import { BUILTIN_THEME_NAMES } from '@ottabase/brand-engine/themes';
import {
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@ottabase/ui-shadcn';

interface BrandKitThemeTabProps {
    themePresetId: string | null;
    tokensJson: string;
    onThemePresetChange: (id: string | null) => void;
    onTokensChange: (tokensJson: string) => void;
}

export function BrandKitThemeTab({
    themePresetId,
    tokensJson,
    onThemePresetChange,
    onTokensChange,
}: BrandKitThemeTabProps) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Base theme preset</CardTitle>
                    <CardDescription>
                        Choose a base theme. Tokens below override colors, radius, spacing, shadow, motion.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Select
                        value={themePresetId ?? 'default'}
                        onValueChange={(v) => onThemePresetChange(v === 'default' ? null : v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select preset" />
                        </SelectTrigger>
                        <SelectContent>
                            {BUILTIN_THEME_NAMES.map((name) => (
                                <SelectItem key={name} value={name}>
                                    {name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Design tokens JSON</CardTitle>
                    <CardDescription>
                        Override color, typography, spacing, radius, shadow, motion. Merged on top of preset.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Label htmlFor="tokensJson" className="sr-only">
                        Tokens JSON
                    </Label>
                    <textarea
                        id="tokensJson"
                        className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 font-mono text-sm dark:border-muted"
                        value={tokensJson}
                        onChange={(e) => onTokensChange(e.target.value)}
                        placeholder='{"color":{"light":{"primary":"222.2 47.4% 11.2%"}}}'
                        spellCheck={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
