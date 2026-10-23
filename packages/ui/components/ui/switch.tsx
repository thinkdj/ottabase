'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@ottabase/ui/lib/utils';

/* Design System v1 switch: a 34×20 track on the strong border colour, primary when on. */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                'peer inline-flex h-5 w-[34px] shrink-0 items-center rounded-full border-0 p-0.5 transition duration-normal ease-theme disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className="pointer-events-none block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-normal ease-theme data-[state=checked]:translate-x-[14px] data-[state=unchecked]:translate-x-0"
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
