import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../context', () => ({
    hasConnection: vi.fn(() => false),
}));
vi.mock('../../models/AuditLog', () => ({
    AuditLog: {
        log: vi.fn(),
        where: vi.fn(),
    },
}));

import { AuditLog } from '../../models/AuditLog';
import { getRecentViolations, logSecurityViolation, sanitizeRlsViolationForAudit } from '../logger';
import type { RLSViolation } from '../types';

function makeViolation(): RLSViolation {
    const data = Object.fromEntries(Array.from({ length: 75 }, (_, index) => [`field_${index}`, `value_${index}`]));
    return {
        type: 'cross_tenant_write',
        model: `posts-${'x'.repeat(200)}`,
        context: {
            userId: 'user-1',
            organizationId: 'org-1',
            appId: 'web',
            roles: ['platform-owner-secret-role'],
            permissions: ['*:*'],
        },
        attemptedAccess: {
            operation: 'update',
            data: {
                ...data,
                password: 'hunter2',
                token: 'secret-token',
                email: 'private@example.com',
            },
        },
        timestamp: Date.now(),
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('RLS audit redaction', () => {
    it('retains bounded identifiers and field names without request values or authority arrays', () => {
        const sanitized = sanitizeRlsViolationForAudit(makeViolation());
        const serialized = JSON.stringify(sanitized);

        expect(sanitized.model).toHaveLength(128);
        expect(sanitized.attemptedAccess).toMatchObject({
            operation: 'update',
            fieldCount: 78,
            truncated: true,
        });
        expect(sanitized.attemptedAccess?.fields).toHaveLength(50);
        expect(serialized).not.toContain('hunter2');
        expect(serialized).not.toContain('secret-token');
        expect(serialized).not.toContain('private@example.com');
        expect(serialized).not.toContain('platform-owner-secret-role');
        expect(serialized).not.toContain('*:*');
    });

    it('emits one structured JSON log containing only the sanitized violation', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await logSecurityViolation(makeViolation());

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0]).toHaveLength(1);
        const log = JSON.parse(String(consoleSpy.mock.calls[0]![0]));
        expect(log.event).toBe('rls_security_violation');
        expect(log.violation.attemptedAccess.fields).toHaveLength(50);
        expect(JSON.stringify(log)).not.toContain('hunter2');
        expect(JSON.stringify(log)).not.toContain('private@example.com');
    });

    it('bounds dashboard queries before they reach the database', async () => {
        vi.mocked(AuditLog.where).mockResolvedValue([]);

        await getRecentViolations(Number.MAX_SAFE_INTEGER);

        expect(AuditLog.where).toHaveBeenCalledWith(
            {
                resourceType: 'rls_security',
                action: 'security_violation',
            },
            {
                orderBy: 'createdAt',
                orderDirection: 'desc',
                limit: 1_000,
            },
        );
    });
});
