// ---------------------------------------------------------------------------
// Kit-level "Disable" switch for a whole editor section (fonts/motion/cursors).
// Toggles tokensJson root `disabled.{section}` – settings below are kept in
// the JSON but the engine stops applying them. Children dim while disabled.
// ---------------------------------------------------------------------------

import type { TokenDisabledFlags } from '@ottabase/brand-engine';
import { Label, Switch } from '@ottabase/ui-shadcn';
import { useMemo, type ReactNode } from 'react';

interface TabDisableToggleProps {
    section: keyof TokenDisabledFlags;
    label: string;
    description: string;
    tokensJson: string;
    onTokensChange: (tokensJson: string) => void;
    children: ReactNode;
}

export function TabDisableToggle({
    section,
    label,
    description,
    tokensJson,
    onTokensChange,
    children,
}: TabDisableToggleProps) {
    const isDisabled = useMemo(() => {
        try {
            const p = JSON.parse(tokensJson || '{}') as { disabled?: TokenDisabledFlags };
            return p.disabled?.[section] === true;
        } catch {
            return false;
        }
    }, [tokensJson, section]);

    const handleToggle = (disable: boolean) => {
        try {
            const p = JSON.parse(tokensJson || '{}') as Record<string, unknown> & { disabled?: TokenDisabledFlags };
            const flags: TokenDisabledFlags = { ...(p.disabled ?? {}) };
            if (disable) flags[section] = true;
            else delete flags[section];
            if (Object.keys(flags).length > 0) p.disabled = flags;
            else delete p.disabled;
            onTokensChange(JSON.stringify(p, null, 2));
        } catch {
            // Malformed JSON (mid-edit in Advanced tab) – leave untouched
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
                <div className="space-y-0.5">
                    <Label htmlFor={`disable-${section}`}>{label}</Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        {description} Settings below are kept, just not applied.
                    </p>
                </div>
                <Switch id={`disable-${section}`} checked={isDisabled} onCheckedChange={handleToggle} />
            </div>
            <div className={isDisabled ? 'pointer-events-none opacity-50' : undefined} aria-disabled={isDisabled}>
                {children}
            </div>
        </div>
    );
}
