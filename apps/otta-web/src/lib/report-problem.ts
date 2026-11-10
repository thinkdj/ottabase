/**
 * "Report this problem": from the crash screen, a failed request's toast, or an inline API error.
 *
 * The draft (what failed, on which page, when, and the request id a server error carries) is
 * handed to Helpdesk's /support page through localStorage; its SupportCenter opens a new request
 * prefilled with it and removes it. The request id is the one Blackbox stored with the server
 * error, so the agent's sidebar links the exact error. Without Helpdesk there is nowhere to
 * report to, and nothing shows.
 */

import { PACKAGES_ENABLED } from '@/ottabase/config/packages';
import { isApiError } from '@ottabase/api';

/** Read by `@ottabase/helpdesk/react` (SupportCenter). Change both together. */
export const SUPPORT_DRAFT_KEY = 'ottabase.support-draft';

export interface ProblemDraft {
    subject: string;
    body: string;
    at: number;
}

export const canReportProblem = (): boolean => PACKAGES_ENABLED.helpdesk === true;

/**
 * Whether this failure is ours to hear about. A crash or a 5xx is. A 4xx is the customer's to
 * fix (a form, a permission), a network failure never reached us, and 501 and 503 are states
 * the app is in on purpose (a feature not configured, read-only mode, lockdown), not faults.
 */
export function isReportable(error: unknown): boolean {
    if (!canReportProblem()) return false;
    if (!isApiError(error)) return true;
    return error.isServerError() && error.status !== 501 && error.status !== 503;
}

/** The prefilled request. Blank lines on top for the customer's own words; the page without its query string. */
export function problemDraft(error: unknown, page: string, now = Date.now()): ProblemDraft {
    const api = isApiError(error) ? error : null;
    const message = (api?.message || (error instanceof Error ? error.message : '') || 'Unexpected error').slice(0, 300);
    const lines = [
        '',
        '',
        '---',
        `What went wrong: ${message}`,
        ...(api?.status ? [`Status: ${api.status}${api.code ? ` ${api.code}` : ''}`] : []),
        `Page: ${page}`,
        `Time: ${new Date(now).toISOString()}`,
        ...(api?.requestId ? [`Reference: ${api.requestId}`] : []),
    ];
    return { subject: `Problem: ${message}`.slice(0, 120), body: lines.join('\n'), at: now };
}

/** Open /support with the draft. `newTab` keeps the page the customer was on (a toast, an inline error). */
export function reportProblem(error: unknown, { newTab = false } = {}): void {
    try {
        localStorage.setItem(SUPPORT_DRAFT_KEY, JSON.stringify(problemDraft(error, window.location.pathname)));
    } catch {
        // Storage blocked: the page still opens, just empty.
    }
    if (newTab) window.open('/support', '_blank', 'noopener');
    else window.location.assign('/support');
}
