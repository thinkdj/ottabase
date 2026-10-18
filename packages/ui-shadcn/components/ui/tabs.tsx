'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@ottabase/ui-shadcn/lib/utils';

/*
 * Design System v1 tabs. `line` (default) is the underline tab for saved views
 * with counts: a 2px primary bar under the selected one, nothing else.
 * `segmented` is the pill track for ranges and views (24h · 7 days · 30 days).
 */
type TabsVariant = 'line' | 'segmented';

const TabsVariantContext = React.createContext<TabsVariant>('line');

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: TabsVariant }
>(({ className, variant = 'line', ...props }, ref) => (
    <TabsVariantContext.Provider value={variant}>
        <TabsPrimitive.List
            ref={ref}
            data-slot="tabs-list"
            data-variant={variant}
            className={cn(
                variant === 'line'
                    ? 'flex items-end gap-5 overflow-x-auto border-b border-border text-subtle-foreground [scrollbar-width:none]'
                    : 'inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-[3px] text-subtle-foreground',
                className,
            )}
            {...props}
        />
    </TabsVariantContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
    const variant = React.useContext(TabsVariantContext);
    return (
        <TabsPrimitive.Trigger
            ref={ref}
            data-slot="tabs-trigger"
            data-variant={variant}
            className={cn(
                'inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition duration-fast ease-theme hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-semibold data-[state=active]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0',
                variant === 'line'
                    ? 'relative py-3 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-t-sm after:bg-transparent data-[state=active]:after:bg-primary'
                    : 'h-7 rounded-sm px-3 data-[state=active]:bg-card data-[state=active]:shadow-xs',
                className,
            )}
            {...props}
        />
    );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} data-slot="tabs-content" className={cn('mt-4', className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
