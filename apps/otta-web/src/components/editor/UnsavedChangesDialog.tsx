/**
 * UnsavedChangesDialog
 *
 * Pair this with `useEditorLeaveGuard`. The dialog appears automatically
 * when TanStack Router blocks an in-app navigation because the editor
 * has unsaved changes.
 *
 * Example:
 *   const { blocker, allowNavigateRef } = useEditorLeaveGuard(isDirty);
 *   …
 *   <UnsavedChangesDialog blocker={blocker} />
 */
import type { EditorLeaveBlocker } from '@/hooks/useEditorLeaveGuard';
import { ConfirmDialog } from '@ottabase/ui-components';

interface UnsavedChangesDialogProps {
    blocker: EditorLeaveBlocker;
}

export function UnsavedChangesDialog({ blocker }: UnsavedChangesDialogProps) {
    return (
        <ConfirmDialog
            open={blocker.status === 'blocked'}
            title="Unsaved changes"
            description="You have unsaved changes that will be lost if you leave this page."
            tone="unsaved-changes"
            primaryActionText="Leave without saving"
            secondaryActionText="Stay and keep editing"
            onConfirm={blocker.proceed}
            onCancel={blocker.reset}
        />
    );
}
