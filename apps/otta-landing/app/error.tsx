'use client';

import { Button } from '@ottabase/ui-shadcn';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
            <h1 className="font-heading text-4xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-lg text-muted-foreground">An unexpected error occurred.</p>
            <Button onClick={reset} className="mt-4">
                Try again
            </Button>
        </div>
    );
}
