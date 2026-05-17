/**
 * Pending group-invite claim helper.
 *
 * When an admin invites a user by email (User B, `userb@domain.com`) to a `UserGroup`,
 * a `user_group_members` row is created with `userId = null` and `invited_email`
 * lower-cased. Later, when User B signs up (credentials or OAuth) with the *same* email,
 * this helper atomically:
 *   1. Resolves all pending rows matching the user's email
 *   2. Skips any group where the user is already a member (avoids unique-index conflict)
 *   3. Updates remaining rows: sets `userId`, flips `status='active'`, stamps `joinedAt`
 *
 * Idempotent — safe to call on every sign-in. Failures are logged but never throw, so a
 * transient claim failure cannot break authentication.
 */

import { UserGroupMember } from '@ottabase/ottaorm/models';

export interface ClaimPendingGroupInvitesResult {
    claimed: number;
    error?: string;
}

export async function claimPendingGroupInvitesForUser(
    userId: string,
    email: string | null | undefined,
): Promise<ClaimPendingGroupInvitesResult> {
    if (!userId || !email) {
        return { claimed: 0 };
    }
    try {
        const claimed = await UserGroupMember.claimPendingInvitesForEmail(email, userId);
        if (claimed > 0) {
            console.log(`[group-invites] Claimed ${claimed} pending invite(s) for user ${userId}`);
        }
        return { claimed };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[group-invites] Failed to claim pending invites:', message);
        return { claimed: 0, error: message };
    }
}
