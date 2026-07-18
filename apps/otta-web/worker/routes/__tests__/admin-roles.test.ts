import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({ requireAdminAccess: vi.fn() }));
vi.mock('@ottabase/ottaorm/models', () => ({
    Role: { find: vi.fn() },
    UserRole: { where: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@ottabase/cf/kv-cache', () => ({ invalidateCacheByPrefix: vi.fn() }));
vi.mock('../../lib/auth-utils', () => ({ bumpProfileVersion: vi.fn() }));

import { Role } from '@ottabase/ottaorm/models';
import { requireAdminAccess } from '../../lib/admin-guard';
import { handleAdminRoleUpdate } from '../admin-roles';

function ctx(body: unknown) {
    return {
        request: new Request('http://localhost/api/admin/roles/r1', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }),
        env: {},
    } as any;
}

describe('handleAdminRoleUpdate — system-role edit guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminAccess).mockResolvedValue({ user: { id: 'admin-1' } } as any);
    });

    it('REJECTS editing a built-in (isSystem) role — framework-owned, would be reverted by self-heal', async () => {
        vi.mocked(Role.find as any).mockResolvedValue({
            get: (k: string) => (k === 'isSystem' ? true : null),
            set: vi.fn(),
            save: vi.fn(),
        });

        const res = await handleAdminRoleUpdate(ctx({ permissions: ['*:*'] }), 'r1');
        const body = (await res.json()) as any;

        expect(res.status).toBe(403);
        expect(body.code).toBe('FORBIDDEN');
    });

    it('ALLOWS editing an operator-created (non-system) role', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        vi.mocked(Role.find as any).mockResolvedValue({
            get: (k: string) => (k === 'isSystem' ? false : k === 'id' ? 'r1' : null),
            set: vi.fn(),
            save,
            toJson: () => ({ id: 'r1' }),
        });

        const res = await handleAdminRoleUpdate(ctx({ description: 'Updated' }), 'r1');

        expect(res.status).toBe(200);
        expect(save).toHaveBeenCalled();
    });
});
