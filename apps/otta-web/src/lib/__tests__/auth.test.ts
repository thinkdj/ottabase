import { describe, expect, it } from 'vitest';
import { resolveEffectiveOrgId } from '../auth';

describe('resolveEffectiveOrgId', () => {
    it('keeps the platform sentinel sticky for a platform admin even when the session falls back to a real org', () => {
        // Simulates: admin selected Platform (localStorage already 'platform'), then
        // refreshSession() re-reads the session, whose activeOrganizationId is null so
        // it falls back to the earliest membership (org-fallback) — that fallback must
        // NOT silently revert the explicit Platform selection.
        const user = { platformAdmin: true, organizationId: 'org-fallback', activeOrganizationId: null };
        expect(resolveEffectiveOrgId(user, true, 'platform')).toBe('platform');
    });

    it('does not keep the sentinel for a non-platform-admin (defense in depth)', () => {
        const user = { platformAdmin: false, organizationId: 'org-fallback', activeOrganizationId: null };
        expect(resolveEffectiveOrgId(user, true, 'platform')).toBe('org-fallback');
    });

    it('adopts a real org once the admin explicitly switches away from Platform (stored value updates first)', () => {
        // ControlsSection updates localStorage to the new org SYNCHRONOUSLY before the
        // PATCH/refreshSession round trip, so by the time this resolves, storedOrgId is
        // already 'org-2' — not the stale 'platform' value.
        const user = { platformAdmin: true, organizationId: 'org-2', activeOrganizationId: 'org-2' };
        expect(resolveEffectiveOrgId(user, true, 'org-2')).toBe('org-2');
    });

    it('falls back to the stored org for an unauthenticated/no-session read (unaffected by the sentinel logic)', () => {
        expect(resolveEffectiveOrgId(null, false, 'org-stored')).toBeNull();
        expect(resolveEffectiveOrgId(null, true, 'org-stored')).toBe('org-stored');
    });

    it('prefers the session organizationId over the stored value for a normal user', () => {
        const user = { platformAdmin: false, organizationId: 'org-session', activeOrganizationId: null };
        expect(resolveEffectiveOrgId(user, true, 'org-stale')).toBe('org-session');
    });
});
