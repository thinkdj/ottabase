import { Badge } from '@ottabase/ui';

/** Marks a demo listed in DEMO_ACCOUNT_GATES: it opens after a free sign-up. */
export function FreeAccountBadge() {
    return (
        <Badge
            variant="secondary"
            className="bg-background/60 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground"
        >
            Free account
        </Badge>
    );
}
