import { afterEach, describe, expect, it, vi } from 'vitest';
import { ORG_ADMIN_PERMISSION, PLATFORM_OWNER_ROLE_NAME, Role } from '../Role';

// ---------------------------------------------------------------------------
// ensureDefaultRoles() self-heal
//
// The security-critical behavior: on every run, ensureDefaultRoles reconciles
// EXISTING framework `isSystem` role rows back to the canonical permission sets
// (Role.DEFAULT_ROLE_DEFINITIONS). This is what auto-corrects a role seeded under
// an older definition — e.g. a legacy `owner = ['*:*']` from before org/platform
// scoping — with no manual re-seed or DB wipe. These tests lock the create /
// heal / idempotent / don't-clobber-operator-roles branches so a future refactor
// can't silently revert to "skip if exists" and reintroduce the escalation.
//
// The static DB methods are stubbed (no driver needed) — we assert the branch
// logic, i.e. WHICH rows get updated/created and with WHAT permissions.
// ---------------------------------------------------------------------------

type FakeRole = { get(key: string): unknown; getPermissions(): string[] };

/** Build a fake existing role row from the canonical definition, optionally overriding fields. */
function existingRow(
    name: string,
    overrides: { permissions?: string[]; description?: string; isSystem?: boolean } = {},
): FakeRole {
    const def = Role.DEFAULT_ROLE_DEFINITIONS.find((d) => d.name === name)!;
    const permissions = overrides.permissions ?? [...def.permissions];
    const fields: Record<string, unknown> = {
        id: `${name}-id`,
        name,
        description: overrides.description ?? def.description,
        isSystem: overrides.isSystem ?? true,
    };
    return { get: (k) => fields[k], getPermissions: () => permissions };
}

// Restore the class's own-property state after each test (create/update are inherited
// from BaseModel, findByName is own on Role — this handles both).
const savedDescriptors: Record<string, PropertyDescriptor | undefined> = {};
function stub<M extends 'findByName' | 'create' | 'update'>(method: M, impl: (...args: any[]) => any) {
    if (!(method in savedDescriptors)) {
        savedDescriptors[method] = Object.getOwnPropertyDescriptor(Role, method);
    }
    (Role as any)[method] = vi.fn(impl);
    return (Role as any)[method] as ReturnType<typeof vi.fn>;
}

afterEach(() => {
    for (const [method, desc] of Object.entries(savedDescriptors)) {
        if (desc) Object.defineProperty(Role, method, desc);
        else delete (Role as any)[method];
    }
    for (const key of Object.keys(savedDescriptors)) delete savedDescriptors[key];
    vi.restoreAllMocks();
});

describe('Role.hasPermission', () => {
    it('uses shared wildcard semantics and rejects malformed wildcard grants', () => {
        const role = new Role({
            entity: 'roles',
            data: { permissions: ['posts:*', 'users:*:admin'] },
        });

        expect(role.hasPermission('posts:delete')).toBe(true);
        expect(role.hasPermission('users:read')).toBe(false);
    });
});

describe('Role.ensureDefaultRoles — heal mode', () => {
    it('heals a stale isSystem `owner = [*:*]` row to the org bundle (org:admin, no *:*) when heal:true', async () => {
        // All roles already match canonical EXCEPT `owner`, which carries the legacy wildcard.
        stub('findByName', async (name: string) =>
            name === 'owner' ? existingRow('owner', { permissions: ['*:*'] }) : existingRow(name),
        );
        const create = stub('create', async (data: any) => data);
        const update = stub('update', async (id: string, data: any) => ({ id, ...data }));

        await Role.ensureDefaultRoles({ heal: true });

        // Nothing missing → never created; exactly one row (owner) reconciled.
        expect(create).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledTimes(1);
        const [id, data] = update.mock.calls[0];
        expect(id).toBe('owner-id');
        const healed = JSON.parse(data.permissions);
        expect(healed).toContain(ORG_ADMIN_PERMISSION);
        expect(healed).not.toContain('*:*');
    });

    it('DEFAULT mode (no heal) is create-if-missing only — never reconciles a drifted system row', async () => {
        stub('findByName', async (name: string) =>
            name === 'owner' ? existingRow('owner', { permissions: ['*:*'] }) : existingRow(name),
        );
        const create = stub('create', async (data: any) => data);
        const update = stub('update', async (id: string, data: any) => ({ id, ...data }));

        const changed = await Role.ensureDefaultRoles(); // default heal:false (signup hot path)

        // Stale owner is NOT touched — no silent revert, no unbounded session-refresh obligation.
        expect(update).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        expect(changed).toEqual([]);
    });

    it('is idempotent under heal — no writes when every system role already matches', async () => {
        stub('findByName', async (name: string) => existingRow(name));
        const create = stub('create', async (d: any) => d);
        const update = stub('update', async (id: string, d: any) => ({ id, ...d }));

        const changed = await Role.ensureDefaultRoles({ heal: true });

        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(changed).toEqual([]);
    });

    it('creates a missing role instead of updating (either mode)', async () => {
        stub('findByName', async (name: string) => (name === 'member' ? null : existingRow(name)));
        const create = stub('create', async (d: any) => d);
        const update = stub('update', async (id: string, d: any) => ({ id, ...d }));

        await Role.ensureDefaultRoles();

        expect(update).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][0]).toMatchObject({ name: 'member', isSystem: true });
    });

    it('never clobbers an operator-created (non-system) role, even with drifted permissions under heal', async () => {
        // A row named `admin` that the operator owns (isSystem=false) with wild permissions.
        stub('findByName', async (name: string) =>
            name === 'admin' ? existingRow('admin', { isSystem: false, permissions: ['*:*'] }) : existingRow(name),
        );
        const create = stub('create', async (d: any) => d);
        const update = stub('update', async (id: string, d: any) => ({ id, ...d }));

        await Role.ensureDefaultRoles({ heal: true });

        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('keeps platform_owner at *:* (system superadmin) untouched when already canonical', async () => {
        stub('findByName', async (name: string) => existingRow(name));
        const update = stub('update', async (id: string, d: any) => ({ id, ...d }));

        await Role.ensureDefaultRoles({ heal: true });

        const platformOwnerHeal = update.mock.calls.find(([id]) => id === `${PLATFORM_OWNER_ROLE_NAME}-id`);
        expect(platformOwnerHeal).toBeUndefined();
    });
});
