import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auditLog } = vi.hoisted(() => ({ auditLog: vi.fn() }));
vi.mock('@ottabase/ottaorm/models', () => ({ AuditLog: { log: auditLog } }));

import { withAudit } from '../middleware';
import { logAuth, logCreate, logDelete, logFailure, logRead, logRoleAssign, logRoleRemove, logUpdate } from '../utils';

const context = { userId: 'u1', organizationId: 'org-1', appId: 'web' };

describe('log helpers keep tenancy', () => {
    beforeEach(() => auditLog.mockReset());

    it.each([
        ['logCreate', () => logCreate('post', 'p1', {}, context)],
        ['logUpdate', () => logUpdate('post', 'p1', {}, context)],
        ['logDelete', () => logDelete('post', 'p1', context)],
        ['logRead', () => logRead('post', 'p1', context)],
        ['logAuth', () => logAuth('login', 'u1', 'u@x.io', context)],
        ['logRoleAssign', () => logRoleAssign('u2', 'r1', 'admin', 'u1', context)],
        ['logRoleRemove', () => logRoleRemove('u2', 'r1', 'admin', 'u1', context)],
        ['logFailure', () => logFailure('create', 'post', 'boom', context)],
    ])('%s writes organizationId and appId', async (_name, call) => {
        await call();
        expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', appId: 'web' }));
    });
});

describe('withAudit actor', () => {
    beforeEach(() => auditLog.mockReset());

    it('ignores a client-supplied x-user-id header', async () => {
        const handler = withAudit(async (_request: Request) => new Response('ok'), { resourceType: 'post' });
        await handler(new Request('https://x.io/api', { method: 'POST', headers: { 'x-user-id': 'victim' } }));

        expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
    });

    it('takes identity and tenancy from getActor', async () => {
        const handler = withAudit(async (_request: Request) => new Response('ok'), {
            resourceType: 'post',
            getActor: () => ({ userId: 'u1', userEmail: 'u@x.io', organizationId: 'org-1', appId: 'web' }),
        });
        await handler(new Request('https://x.io/api', { method: 'POST' }));

        expect(auditLog).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', userEmail: 'u@x.io', organizationId: 'org-1', appId: 'web' }),
        );
    });
});
