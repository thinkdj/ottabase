// Asks before leaving with unsaved edits: in-app navigation gets a confirm dialog, and
// reload / tab close gets the browser's own prompt.

import { ConfirmDialog } from '@ottabase/ui-components';
import { useBlocker } from '@tanstack/react-router';

export function UnsavedChangesGuard({ when }: { when: boolean }) {
    const blocker = useBlocker({ shouldBlockFn: () => when, enableBeforeUnload: () => when, withResolver: true });
    return (
        <ConfirmDialog
            open={blocker.status === 'blocked'}
            onOpenChange={(open) => !open && blocker.reset?.()}
            title="Leave without saving?"
            description="Your changes haven’t been saved and will be lost."
            tone="destructive"
            secondaryActionText="Keep editing"
            primaryActionText="Leave"
            onConfirm={() => blocker.proceed?.()}
        />
    );
}
