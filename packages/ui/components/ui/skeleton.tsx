import { cn } from '@ottabase/ui/lib/utils';

/* A placeholder where content will be: the subtle fill with a shimmer sweeping across it. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                'rounded-sm bg-[linear-gradient(90deg,hsl(var(--muted))_0%,hsl(var(--secondary))_50%,hsl(var(--muted))_100%)] bg-[length:200%_100%] motion-safe:animate-shimmer',
                className,
            )}
            {...props}
        />
    );
}

export { Skeleton };
