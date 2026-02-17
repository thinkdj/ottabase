// ---------------------------------------------------------------------------
// OverrideSection – Toggle wrapper for inherited brand kit sections
// Shows "Inherited from parent" when disabled, section content when enabled.
// Only used when the brand kit has a parent (inherited kit).
// ---------------------------------------------------------------------------

import { Label, Switch } from '@ottabase/ui-shadcn';
import { IconGitBranch } from '@tabler/icons-react';

interface OverrideSectionProps {
    /** Section label shown next to the toggle (e.g. "Colors", "Typography") */
    label: string;
    /** Whether this section is currently overridden (has local values) */
    isOverridden: boolean;
    /** Called when the user toggles the override on/off */
    onToggle: (enabled: boolean) => void;
    /** The editable section content – only rendered when overridden */
    children: React.ReactNode;
}

/**
 * Wraps a brand kit editor section with an override toggle.
 * When the kit inherits from a parent, each section (colors, fonts, etc.)
 * can be individually overridden. Only overridden sections are saved in
 * tokensJson, keeping the child's config as a minimal diff.
 */
export function OverrideSection({ label, isOverridden, onToggle, children }: OverrideSectionProps) {
    return (
        <div className="space-y-4">
            {/* Override toggle bar */}
            <div className="flex items-center justify-between rounded-lg border border-dashed p-3 dark:border-muted">
                <div className="flex items-center gap-2">
                    <IconGitBranch className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Override {label}</Label>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {isOverridden ? 'Custom values' : 'Inherited from parent'}
                    </span>
                    <Switch checked={isOverridden} onCheckedChange={onToggle} />
                </div>
            </div>

            {/* Section content: show when overridden, or inherited message */}
            {isOverridden ? (
                children
            ) : (
                <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center dark:border-muted">
                    <p className="text-sm text-muted-foreground">
                        Using <strong>parent kit's</strong> {label.toLowerCase()}. Enable the toggle above to customize.
                    </p>
                </div>
            )}
        </div>
    );
}
