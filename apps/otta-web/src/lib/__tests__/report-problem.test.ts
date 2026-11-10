import { ApiError } from '@ottabase/api';
import { describe, expect, it, vi } from 'vitest';
import { isReportable, problemDraft } from '../report-problem';

// Helpdesk is a Pro package: installed here, so the rule itself is what is under test.
vi.mock('@/ottabase/config/packages', () => ({ PACKAGES_ENABLED: { helpdesk: true } }));

describe('problemDraft', () => {
    it('carries a server error’s status and request id, the page and the time', () => {
        const error = new ApiError({
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            status: 500,
            requestId: '8d2f0c1a2b3c4d5e-SJC',
        });
        const draft = problemDraft(error, '/admin/posts', Date.UTC(2026, 10, 8, 14, 3));
        expect(draft.subject).toBe('Problem: Internal server error');
        expect(draft.body.startsWith('\n\n---\n')).toBe(true);
        expect(draft.body).toContain('Status: 500 INTERNAL_SERVER_ERROR');
        expect(draft.body).toContain('Page: /admin/posts');
        expect(draft.body).toContain('Time: 2026-11-08T14:03:00.000Z');
        expect(draft.body).toContain('Reference: 8d2f0c1a2b3c4d5e-SJC');
    });

    it('describes a browser error without a reference, and caps the subject', () => {
        const draft = problemDraft(new TypeError('x'.repeat(500)), '/');
        expect(draft.subject.length).toBe(120);
        expect(draft.body).not.toContain('Reference:');
        expect(draft.body).not.toContain('Status:');
    });
});

describe('isReportable', () => {
    const api = (status: number, code = 'X') => new ApiError({ error: 'e', code, status });

    it('offers a report for a crash and a real server fault', () => {
        expect(isReportable(new TypeError('boom'))).toBe(true);
        expect(isReportable(api(500))).toBe(true);
        expect(isReportable(api(502))).toBe(true);
    });

    it('offers none for what the customer fixes, a request that never arrived, or a state the app is in on purpose', () => {
        expect(isReportable(api(403))).toBe(false);
        expect(isReportable(api(422))).toBe(false);
        expect(isReportable(api(0, 'NETWORK_ERROR'))).toBe(false);
        expect(isReportable(api(501, 'NOT_CONFIGURED'))).toBe(false);
        expect(isReportable(api(503, 'READONLY_MODE'))).toBe(false);
    });
});
