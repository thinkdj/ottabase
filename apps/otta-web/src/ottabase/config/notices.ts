/**
 * URL notices: the registry of codes a redirect may carry as `?notice=<code>`.
 *
 * Codes, never text, travel in the URL (a link that carried its own message could put words in
 * the app's mouth). Core codes live here; packages add theirs through `notices` on their client
 * descriptor and arrive namespaced (`payport.checkout-complete`). The global handler in
 * `components/UrlNotices.tsx` toasts a known code and strips it from the URL; a page claims an
 * `inline` code with `useNotice()` and renders it itself (the login page does this for errors).
 */
import type { NoticeContribution } from '@ottabase/kernel/client';
import { PACKAGE_NOTICES } from './packages';

export type NoticeDefinition = NoticeContribution;

export const CORE_NOTICES: Record<string, NoticeDefinition> = {
    'coming-soon': { type: 'info', title: 'Coming soon', message: 'This part is not ready yet.' },
    'signed-out': { type: 'info', message: 'You have been signed out.' },
    'session-revoked': {
        type: 'warning',
        title: 'Signed out',
        message: 'This session was signed out from another device, or your password was changed. Please sign in again.',
    },
    'session-expired': { type: 'info', title: 'Session expired', message: 'Please sign in again.' },
    'invite-accepted': { type: 'success', message: 'Invitation accepted. Welcome aboard.' },
    'org-switched': { type: 'info', message: 'Organization switched.' },
    'permission-denied': { type: 'error', message: 'You do not have access to that page.' },

    // Rendered inline by the login page
    'email-verified': { type: 'success', message: 'Email verified successfully. Please sign in.', inline: true },
    'password-changed': {
        type: 'success',
        message: 'Password changed successfully. Please sign in with your new password.',
        inline: true,
    },
    'auth.oauth-account-not-linked': {
        type: 'error',
        message:
            'An account already exists for this email. Sign in with your original method, then link this provider from your profile.',
        inline: true,
    },
    'auth.oauth-callback': {
        type: 'error',
        message: 'We could not complete sign-in with that provider. Please try again.',
        inline: true,
    },
    'auth.oauth-signin': {
        type: 'error',
        message: 'That provider is not available right now. Please try another sign-in method.',
        inline: true,
    },
    'auth.verification': {
        type: 'error',
        message: 'Your sign-in link is invalid or has expired. Request a new one.',
        inline: true,
    },
    'auth.account-provisioning': {
        type: 'error',
        message: 'Your account workspace could not be initialized. Please try signing in again.',
        inline: true,
    },
    'auth.failed': { type: 'error', message: 'Sign-in failed. Please try again.', inline: true },
};

/** Core codes plus every installed package's codes. */
export const NOTICES: Record<string, NoticeDefinition> = { ...PACKAGE_NOTICES, ...CORE_NOTICES };

export function resolveNotice(code: string | null | undefined): NoticeDefinition | null {
    return code ? (NOTICES[code] ?? null) : null;
}
