/**
 * useEditorLeaveGuard
 *
 * Navigation guard for any editor page that has unsaved changes.
 * Encapsulates the TanStack Router `useBlocker` wiring so every
 * editor page doesn't have to repeat the boilerplate.
 *
 * Usage:
 *   const { blocker, allowNavigateRef } = useEditorLeaveGuard(isDirty);
 *
 *   // Before a programmatic redirect that should NOT be blocked
 *   // (e.g. post-save redirect, after delete):
 *   allowNavigateRef.current = true;
 *   navigate({ to: '...' });
 *
 *   // Render the dialog (see UnsavedChangesDialog):
 *   <UnsavedChangesDialog blocker={blocker} />
 */
import { useBlocker } from '@tanstack/react-router';
import { useCallback, useRef } from 'react';

/**
 * The subset of the blocker object consumed by UnsavedChangesDialog
 * and by callers that need to check whether navigation is pending.
 */
export interface EditorLeaveBlocker {
    status: 'idle' | 'blocked';
    proceed?: () => void;
    reset?: () => void;
}

/**
 * @param shouldWarn - reactive boolean: true when the editor has
 *   changes the user has not yet saved. Pass `false` (not just a
 *   falsy value) when no warning is needed to cheaply disable the
 *   `beforeunload` handler too.
 */
export function useEditorLeaveGuard(shouldWarn: boolean): {
    blocker: EditorLeaveBlocker;
    /** Set `.current = true` immediately before any intentional programmatic navigation. */
    allowNavigateRef: React.MutableRefObject<boolean>;
} {
    // Ref mirrors `shouldWarn` so the stable `shouldBlockFn` can read
    // the latest value without being recreated on every render.
    const shouldWarnRef = useRef(false);
    shouldWarnRef.current = shouldWarn;

    // Set to true before intentional programmatic navigations
    // (post-save redirect, after delete) to skip the guard for that one navigation.
    const allowNavigateRef = useRef(false);

    const shouldBlockFn = useCallback(async () => {
        if (allowNavigateRef.current) {
            // One-shot: reset immediately so subsequent navigations are guarded again.
            allowNavigateRef.current = false;
            return false;
        }
        return shouldWarnRef.current;
    }, []);

    const blocker = useBlocker({
        shouldBlockFn,
        // withResolver: true exposes blocker.proceed / blocker.reset so we can
        // drive the confirmation dialog ourselves instead of using window.confirm.
        withResolver: true,
        // Also fires the native browser beforeunload prompt (tab close / refresh).
        enableBeforeUnload: shouldWarn,
    });

    return { blocker: blocker as EditorLeaveBlocker, allowNavigateRef };
}
