import { describe, expect, it } from 'vitest';
import { describeAuditEntry } from '../adminOverview';

const entry = (over: Record<string, unknown>) =>
    ({
        id: 'a',
        user_id: 'u',
        action: 'update',
        resource_type: 'post',
        status: 'success',
        created_at: 0,
        ...over,
    }) as never;

describe('describeAuditEntry', () => {
    it('reads as a sentence', () => {
        expect(describeAuditEntry(entry({ user_email: 'ada@example.com' }))).toBe('ada@example.com updated post');
        expect(describeAuditEntry(entry({ action: 'create', resource_type: 'organization_member' }))).toBe(
            'Someone created organization member',
        );
        expect(describeAuditEntry(entry({ action: 'login', user_email: 'ada@example.com' }))).toBe(
            'ada@example.com signed in',
        );
        expect(describeAuditEntry(entry({ action: 'rotate_key', resource_type: 'api_key' }))).toBe(
            'Someone rotate key api key',
        );
    });

    it('marks failures', () => {
        expect(describeAuditEntry(entry({ action: 'delete', status: 'failure' }))).toBe(
            'Someone deleted post (failed)',
        );
    });
});
