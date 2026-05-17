import { describe, expect, it, vi } from 'vitest';
import {
    normalizeGroupInviteEmail,
    USER_GROUP_MEMBER_ROLES,
    USER_GROUP_MEMBER_STATUSES,
    UserGroupMember,
} from '../UserGroup';

describe('normalizeGroupInviteEmail', () => {
    it('lowercases and trims emails', () => {
        expect(normalizeGroupInviteEmail('  Foo@Bar.COM  ')).toBe('foo@bar.com');
    });

    it('returns null for null/undefined/empty', () => {
        expect(normalizeGroupInviteEmail(null)).toBeNull();
        expect(normalizeGroupInviteEmail(undefined)).toBeNull();
        expect(normalizeGroupInviteEmail('')).toBeNull();
        expect(normalizeGroupInviteEmail('   ')).toBeNull();
    });

    it('preserves the local-part/case-sensitive parts only after lowercasing', () => {
        // RFC technically permits case-sensitive local-parts, but in practice almost no email
        // provider treats them as such, and unique-key matching requires a stable normalization.
        expect(normalizeGroupInviteEmail('Mixed.Case+tag@Example.com')).toBe('mixed.case+tag@example.com');
    });
});

describe('UserGroupMember enumerations', () => {
    it('exposes the canonical role list', () => {
        expect(USER_GROUP_MEMBER_ROLES).toEqual(['admin', 'member']);
    });

    it('exposes the canonical status list', () => {
        expect(USER_GROUP_MEMBER_STATUSES).toEqual(['invited', 'active', 'declined', 'removed']);
    });
});

describe('UserGroupMember.claimPendingInvitesForEmail', () => {
    /**
     * Build a fake Drizzle-style db that satisfies the chained calls in the method.
     * First select() returns the pending invites; second select() returns the user's existing
     * memberships across those groups; update().set().where().returning() returns one row.
     */
    function makeFakeDb({
        pending,
        existing,
        updateReturning,
    }: {
        pending: Array<{ id: string; groupId: string }>;
        existing: Array<{ groupId: string }>;
        updateReturning: Array<{ id: string }>;
    }) {
        const events: Array<{ kind: string; payload?: any }> = [];
        let selectCallIndex = 0;
        const db: any = {
            select(_cols: any) {
                const callIndex = selectCallIndex++;
                return {
                    from() {
                        return {
                            where() {
                                events.push({ kind: 'select', payload: { callIndex } });
                                return callIndex === 0 ? pending : existing;
                            },
                        };
                    },
                };
            },
            update() {
                return {
                    set(values: any) {
                        events.push({ kind: 'update', payload: values });
                        return {
                            where() {
                                return {
                                    returning() {
                                        return updateReturning;
                                    },
                                };
                            },
                        };
                    },
                };
            },
        };
        return { db, events };
    }

    it('returns 0 when email or userId is empty', async () => {
        await expect(UserGroupMember.claimPendingInvitesForEmail('', 'user-1')).resolves.toBe(0);
        await expect(UserGroupMember.claimPendingInvitesForEmail('foo@bar.com', '')).resolves.toBe(0);
    });

    it('returns 0 when there are no pending invites', async () => {
        const { db } = makeFakeDb({ pending: [], existing: [], updateReturning: [] });
        const spy = vi.spyOn(UserGroupMember as any, 'getDriver').mockReturnValue({ getDb: () => db });

        const claimed = await UserGroupMember.claimPendingInvitesForEmail('foo@bar.com', 'user-1');
        expect(claimed).toBe(0);
        spy.mockRestore();
    });

    it('claims pending invites and skips already-member groups', async () => {
        const { db, events } = makeFakeDb({
            pending: [
                { id: 'm1', groupId: 'g1' },
                { id: 'm2', groupId: 'g2' },
                { id: 'm3', groupId: 'g3' },
            ],
            existing: [{ groupId: 'g2' }], // user is already a member of g2 — should be skipped
            updateReturning: [{ id: 'ok' }],
        });
        const spy = vi.spyOn(UserGroupMember as any, 'getDriver').mockReturnValue({ getDb: () => db });

        const claimed = await UserGroupMember.claimPendingInvitesForEmail('FOO@BAR.COM', 'user-1');
        // g1 + g3 = 2 claimed; g2 skipped because of pre-existing membership
        expect(claimed).toBe(2);

        // Verify update payloads contain server-derived fields and clear invitedEmail
        const updates = events.filter((e) => e.kind === 'update');
        expect(updates).toHaveLength(2);
        for (const u of updates) {
            expect(u.payload.userId).toBe('user-1');
            expect(u.payload.status).toBe('active');
            expect(u.payload.invitedEmail).toBeNull();
            expect(typeof u.payload.joinedAt).toBe('number');
        }
        spy.mockRestore();
    });
});
