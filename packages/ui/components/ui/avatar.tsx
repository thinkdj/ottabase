'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@ottabase/ui/lib/utils';

const Avatar = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Root
        ref={ref}
        data-slot="avatar"
        className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
        {...props}
    />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Image>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Image
        ref={ref}
        data-slot="avatar-image"
        className={cn('aspect-square h-full w-full', className)}
        {...props}
    />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Fallback>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Fallback
        ref={ref}
        data-slot="avatar-fallback"
        className={cn(
            'flex h-full w-full items-center justify-center rounded-full bg-secondary text-xs font-semibold tracking-[0.02em] text-subtle-foreground',
            className,
        )}
        {...props}
    />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/*
 * A row of overlapping avatars (members, assignees, who is viewing). Each one
 * is ringed in the surface colour so the overlap reads as a cut, and anything
 * past `max` folds into a "+N" disc. The group sizes its children: pass plain
 * <Avatar>s, without size classes.
 */
// Each avatar tucks ~20% under the next: enough to read as a group, little enough that the
// centred initials of the one beneath stay clear of the ring
const AVATAR_GROUP_SIZES = {
    sm: '-space-x-1 [&>*]:size-6 [&>*]:text-[9px] [&_[data-slot=avatar-fallback]]:text-[9px]',
    default: '-space-x-1.5 [&>*]:size-8 [&>*]:text-xs',
    lg: '-space-x-2 [&>*]:size-10 [&>*]:text-sm [&_[data-slot=avatar-fallback]]:text-sm',
} as const;

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    /** How many avatars show before the rest fold into "+N". */
    max?: number;
    /** The real headcount when `children` is only the first few (e.g. 3 loaded of 120 members). */
    total?: number;
    size?: keyof typeof AVATAR_GROUP_SIZES;
}

const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
    ({ max, total, size = 'default', className, children, ...props }, ref) => {
        const avatars = React.Children.toArray(children).filter(React.isValidElement);
        const shown = max === undefined ? avatars : avatars.slice(0, Math.max(0, max));
        const hidden = Math.max(0, (total ?? avatars.length) - shown.length);

        return (
            <div
                ref={ref}
                role="group"
                data-slot="avatar-group"
                data-size={size}
                className={cn('flex items-center [&>*]:ring-2 [&>*]:ring-card', AVATAR_GROUP_SIZES[size], className)}
                {...props}
            >
                {shown}
                {hidden > 0 ? (
                    <span
                        data-slot="avatar-group-count"
                        className="relative inline-grid shrink-0 place-items-center rounded-full bg-muted font-semibold tabular-nums tracking-[0.02em] text-subtle-foreground"
                    >
                        <span aria-hidden="true">{hidden > 99 ? '99+' : `+${hidden}`}</span>
                        <span className="sr-only">{hidden} more</span>
                    </span>
                ) : null}
            </div>
        );
    },
);
AvatarGroup.displayName = 'AvatarGroup';

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup };
