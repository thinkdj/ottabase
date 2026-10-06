import type { AuditLogRecord } from '@/types/rbac';
import { describe, expect, it } from 'vitest';
import { auditQuery, auditSearch, dayGroups, humanizeAction, summarize } from '../auditTimeline';

const log = (extra: Partial<AuditLogRecord>): AuditLogRecord => ({
    id: 'l',
    user_id: 'u',
    action: 'create',
    resource_type: 'role',
    status: 'success',
    created_at: 0,
    ...extra,
});

describe('auditSearch', () => {
    it('keeps what is set, drops blanks and unknown statuses, pages only past the first', () => {
        expect(auditSearch({ q: ' ', action: 'delete', status: 'nope', page: '1', user: 'u1' })).toEqual({
            action: 'delete',
            user: 'u1',
        });
        expect(auditSearch({ status: 'failure', page: 3 })).toEqual({ status: 'failure', page: 3 });
    });
});

describe('auditQuery', () => {
    it('maps the view onto the API parameters', () => {
        expect(auditQuery({ q: 'ada', type: 'role', org: 'o1', status: 'error' }, 2, 50)).toBe(
            'page=2&per_page=50&search=ada&entityType=role&status=error&organizationId=o1',
        );
    });
});

describe('dayGroups', () => {
    it('groups rows by local day and names today and yesterday', () => {
        const now = new Date(2026, 9, 6, 15, 0, 0);
        const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime();
        const groups = dayGroups(
            [
                log({ id: 'a', created_at: at(6, 14) }),
                log({ id: 'b', created_at: at(6, 9) }),
                log({ id: 'c', created_at: at(5, 23) }),
                log({ id: 'd', created_at: at(1, 8) }),
            ],
            now,
        );
        expect(groups.map((g) => [g.label, g.logs.map((l) => l.id)])).toEqual([
            ['Today', ['a', 'b']],
            ['Yesterday', ['c']],
            [expect.stringMatching(/1/), ['d']],
        ]);
        expect(groups[2].label).not.toContain('2026');
    });
});

describe('summarize', () => {
    it('prefers the error, then the telling metadata fields, two at most', () => {
        expect(summarize(log({ error_message: 'Denied', metadata: '{"method":"POST"}' }))).toBe('Denied');
        expect(summarize(log({ metadata: '{"size":3,"method":"POST","reason":"expired","x":1}' }))).toBe(
            'method: POST, reason: expired',
        );
        expect(summarize(log({ metadata: 'not json' }))).toBe('');
        expect(humanizeAction('brand.kit.logo_upload')).toBe('brand kit logo upload');
    });
});
