import { cn } from '@ottabase/ui/lib/utils';

/* A key: mono, 11px, the strong border with a 2px bottom edge, on the surface. */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
    return (
        <kbd
            data-slot="kbd"
            className={cn(
                'pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 whitespace-nowrap rounded-[3px] border border-input border-b-2 bg-card px-1.5 font-mono text-[11px] font-medium text-subtle-foreground',
                "[&_svg:not([class*='size-'])]:size-3",
                '[[data-slot=tooltip-content]_&]:border-background/30 [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background',
                className,
            )}
            {...props}
        />
    );
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return <kbd data-slot="kbd-group" className={cn('inline-flex items-center gap-1', className)} {...props} />;
}

export { Kbd, KbdGroup };
