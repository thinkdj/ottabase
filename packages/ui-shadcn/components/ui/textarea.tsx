import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                'flex min-h-[88px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-normal text-foreground shadow-xs transition duration-fast ease-theme placeholder:text-faint-foreground hover:border-faint-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint-foreground aria-[invalid=true]:border-destructive',
                className,
            )}
            ref={ref}
            {...props}
        />
    );
});
Textarea.displayName = 'Textarea';

export { Textarea };
