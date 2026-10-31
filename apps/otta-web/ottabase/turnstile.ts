// ============================================================
// Turnstile actions: one name per public form, shared by its page and its route
// ============================================================
// The page renders `useTurnstile(TURNSTILE_ACTIONS.register)` (@ottabase/ui/turnstile) and the
// route checks the same name with `guardPublicForm` or `requireHuman` (worker/lib/turnstile.ts),
// so a token minted on one form is refused by every other. Packages that own their forms (Pro
// Campaigns, Beacon) name their own. Cloudflare's rule: up to 32 letters, digits, `_` and `-`.
// ============================================================

export const TURNSTILE_ACTIONS = {
    /** The sign-in page: password sign-in and the magic link share its widget. */
    signin: 'signin',
    register: 'register',
    passwordReset: 'password-reset',
    verifyResend: 'verify-resend',
    postUnlock: 'post-unlock',
    comment: 'comment',
} as const;

export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];
