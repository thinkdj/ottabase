import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@ottabase/ui/lib/utils';

function NativeSelect({
    className,
    wrapperClassName,
    size = 'default',
    ...props
}: Omit<React.ComponentProps<'select'>, 'size'> & { size?: 'sm' | 'default'; wrapperClassName?: string }) {
    return (
        <div className={cn('group/native-select relative w-fit', wrapperClassName)} data-slot="native-select-wrapper">
            <select
                data-slot="native-select"
                data-size={size}
                className={cn(
                    'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-card px-3 py-2 pr-9 text-sm text-foreground shadow-xs transition duration-fast ease-theme hover:border-faint-foreground placeholder:text-faint-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint-foreground data-[size=sm]:h-8 data-[size=sm]:py-1',
                    'aria-[invalid=true]:border-destructive',
                    className,
                )}
                {...props}
            />
            <ChevronDownIcon
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 select-none text-muted-foreground"
                aria-hidden="true"
                data-slot="native-select-icon"
            />
        </div>
    );
}

function NativeSelectOption({ ...props }: React.ComponentProps<'option'>) {
    return <option data-slot="native-select-option" {...props} />;
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<'optgroup'>) {
    return <optgroup data-slot="native-select-optgroup" className={cn(className)} {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
