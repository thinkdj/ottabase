// ====================================================================
// @ottabase/ottaai — RLS policy for `ai_provider_credentials`
// --------------------------------------------------------------------
// PLANE: MANAGEMENT (tenant CRUD over the credential table).
//
// The CALL plane (the resolver) deliberately BYPASSES RLS: it is trusted server
// code holding an already-authenticated context, and RLS stops tenant A editing
// tenant B's row — it does not police the server's own lookup. That bypass is
// INTENTIONAL. Do not "restore consistency" by routing the resolver through here.
//
// Registration (AFTER initRLS(), because the registry is last-write-wins):
//
//     import { createCredentialPolicy } from '@ottabase/ottaai/ottaorm';
//     registerModels([...others, AiProviderCredential]);
//     initRLS();
//     registerPolicy(createCredentialPolicy({ strategy: 'user-then-org' }));
//
// ====================================================================

import type { ModelRLSConfig, SecurityContext } from '@ottabase/ottaorm';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import type { AiStrategy } from '../types';

/** The permission that authorises managing an ORGANISATION's AI credentials. */
export const AI_MANAGE_PERMISSION = 'ai:manage';

export interface CredentialPolicyOptions {
    /**
     * MUST be the SAME value passed to `createAiProvisioning`.
     *
     * Strategy is one half of a decision whose other half is this filter's dimension.
     * `createAiProvisioningWithStorage` passes both from one place so the match is
     * structural rather than a comment in two files.
     */
    strategy: AiStrategy;
    /**
     * Permissions that authorise ORG-scoped access. Any one of them suffices.
     * Default: `ai:manage` (seeded onto owner/admin) plus `org:admin`.
     */
    orgManagePermissions?: string[];
}

/**
 * RLS FILTERS ARE SINGLE-DIMENSION, SO THE TWO PLANES LEGITIMATELY DISAGREE.
 *
 * A filter is an AND-ed equality map; it cannot express `org = X OR user = Y` — exactly
 * the disjunction the resolver evaluates.
 *
 * | strategy         | filter dimension                 | rows the resolver may use that this cannot show |
 * | ---------------- | -------------------------------- | ----------------------------------------------- |
 * | `user`           | `userId`; deny if absent         | none                                            |
 * | `org`            | verified `organizationId`        | none                                            |
 * | `user-then-org`  | `userId`, else org               | ORG-ONLY ROWS                                   |
 * | `org-then-user`  | org, else `userId`               | USER-ONLY ROWS                                  |
 *
 * CONSEQUENCE: A USER CAN BE RUNNING ON A KEY THEY CANNOT SEE, DISABLE, OR ROTATE.
 * Three required responses, all implemented: this is a FACTORY taking the same strategy
 * the resolver takes; the management UI is built on the STATUS PRIMITIVE rather than
 * solely on this filtered list; and the UI badges `isActive` as "Active", never as
 * "In use".
 */
export function createCredentialPolicy(options: CredentialPolicyOptions): ModelRLSConfig {
    const orgPermissions = options.orgManagePermissions ?? [AI_MANAGE_PERMISSION, 'org:admin'];

    function canManageOrgCredentials(context: SecurityContext): boolean {
        if (context.platformAdmin === true) return true;
        return orgPermissions.some((permission) => hasGrantedPermission(context.permissions, permission));
    }

    /**
     * Membership-verified org id, or null.
     *
     * Returning the context's CLAIMED org id verbatim — next to a membership list that is
     * never read — is the single highest-leverage fix-once-instead-of-N-times item in this
     * design: every consuming app would inherit the hole. `memberOrganizationIds` is the
     * framework's already-verified list; `undefined` means "membership unknown", an empty
     * array is a real "no orgs" answer and must fail closed.
     */
    function verifiedOrg(context: SecurityContext): string | null {
        const org = context.organizationId ?? null;
        if (!org) return null;
        if (context.platformAdmin === true) return org;
        const memberships = context.memberOrganizationIds;
        if (!Array.isArray(memberships)) return null; // unknown ⇒ deny on the management plane
        return memberships.includes(org) ? org : null;
    }

    function filter(context: SecurityContext): Record<string, unknown> | null {
        // No tenant context at all ⇒ DENY. Never an unfiltered read.
        if (!context.userId) return null;

        const org = verifiedOrg(context);
        const base: Record<string, unknown> = {};

        // `appId` is AND-ed in on EVERY operation. A boundary enforced on the call plane
        // but not the management plane is not a boundary: a second app on the shared
        // database could not USE another app's key but could REPLACE it — swapping the
        // secret for one they control so the first app's inference silently flows through
        // it. Strictly worse than a read leak.
        if (context.appId) base.appId = context.appId;

        switch (options.strategy) {
            case 'user':
                return { ...base, userId: context.userId };

            case 'org':
                if (!org || !canManageOrgCredentials(context)) return null;
                return { ...base, organizationId: org };

            case 'org-then-user':
                if (org && canManageOrgCredentials(context)) {
                    return { ...base, organizationId: org };
                }
                return { ...base, userId: context.userId };

            case 'user-then-org':
            default:
                return { ...base, userId: context.userId };
        }
    }

    return {
        model: 'ai_provider_credentials',
        policy: { level: 'custom', filter },
        // Injected on create, validated always. Note this ALSO widens the writable
        // allow-list on create AND update — which is exactly why the model's own `update`
        // override rejects tenancy keys, where no policy config can re-enable them.
        contextFields: ['organizationId', 'appId', 'userId'],
        auditEnabled: true,
    };
}

/**
 * The org-scoped `authorize` hook, in the framework's native shape (RBAC permissions).
 *
 * RLS isolates TENANTS, not MEMBERS. Under an org strategy every member of the org could
 * otherwise read the key hint, replace the key, disable it, or delete it — and replacement
 * is the sharp end: swap the org key for one you control and every colleague's prompts
 * flow through your provider account. User-scoped rows are self-owned and need no gate.
 *
 * Takes the request's ALREADY-AUTHENTICATED `SecurityContext` at construction, because the
 * provisioning instance is built per request. RE-CHECKING PER REQUEST is the point: a role
 * baked into a session minted before the user was demoted or removed must not be trusted.
 */
export function createRbacAuthorize(
    security: SecurityContext,
    options?: { orgManagePermissions?: string[] },
): (input: { credential: { organizationId: string | null; userId: string | null } | null }) => boolean {
    const permissions = options?.orgManagePermissions ?? [AI_MANAGE_PERMISSION, 'org:admin'];
    return (input) => {
        const orgScoped = input.credential?.organizationId ?? null;
        if (!orgScoped) return true;
        if (security.platformAdmin === true) return true;
        // The grant must be held IN the credential's own organisation. The security
        // context's active org already represents that, and `getSecurityContext` has
        // membership-verified it before it ever reaches here.
        if (security.organizationId !== orgScoped) return false;
        return permissions.some((permission) => hasGrantedPermission(security.permissions, permission));
    };
}
