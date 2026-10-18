// The caller every package admin route trusts (Tower, Vault, Workbench, Blackbox, Beacon…).
// Platform authority must come from the session's scope-aware flag, never from the merged
// permission set: an org-scoped `*:*` is an org admin, not the operator of the deployment.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('@ottabase/auth/backend', () => ({ getSession: vi.fn(async () => session.value) }));
vi.mock('../../worker/lib/auth-utils', () => ({ getAuthOptions: () => ({}) }));
vi.mock('../config.loader', () => ({ getOttabaseConfig: () => ({ appId: 'app' }) }));

import { resolvePackageCaller } from '../packages/caller';

const request = new Request('https://app.test/api/workbench/tables');
const env = {} as CloudflareEnv;

beforeEach(() => {
    session.value = null;
});

describe('resolvePackageCaller', () => {
    it('is null without a session', async () => {
        expect(await resolvePackageCaller(request, env)).toBeNull();
    });

    it('does not make an org-scoped wildcard a platform admin', async () => {
        session.value = { user: { id: 'u1', organizationId: 'org-1', permissions: ['*:*'], platformAdmin: false } };
        expect(await resolvePackageCaller(request, env)).toMatchObject({
            userId: 'u1',
            organizationId: 'org-1',
            platformAdmin: false,
            canManage: true,
        });
    });

    it('trusts the session’s system-scoped flag, whatever the merged permissions say', async () => {
        session.value = {
            user: { id: 'u2', organizationId: 'system', permissions: ['platform:admin'], platformAdmin: true },
        };
        expect(await resolvePackageCaller(request, env)).toMatchObject({ platformAdmin: true, canManage: true });
        session.value = { user: { id: 'u3', organizationId: 'org-1', permissions: ['posts:read'] } };
        expect(await resolvePackageCaller(request, env)).toMatchObject({ platformAdmin: false, canManage: false });
    });
});
