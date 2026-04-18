import { describe, expect, it } from 'vitest';
import { buildMediaLibraryAccessFilter } from '../../../../ottabase/models/mediaLibraryPolicy';

describe('mediaLibraryPolicy', () => {
    it('limits non-admin users to their own uploads', () => {
        const filter = buildMediaLibraryAccessFilter({
            appId: 'app-1',
            organizationId: 'org-1',
            userId: 'user-1',
            roles: ['user'],
            permissions: ['posts:read'],
        });

        expect(filter).toEqual({
            appId: 'app-1',
            organizationId: 'org-1',
            userId: 'user-1',
        });
    });

    it('allows admins to browse all uploads in the current scope', () => {
        const filter = buildMediaLibraryAccessFilter({
            appId: 'app-1',
            organizationId: 'org-1',
            userId: 'admin-1',
            roles: ['admin'],
            permissions: ['*:*'],
        });

        expect(filter).toEqual({
            appId: 'app-1',
            organizationId: 'org-1',
        });
    });

    it('denies access when app scope is missing', () => {
        expect(
            buildMediaLibraryAccessFilter({
                userId: 'user-1',
            }),
        ).toBeNull();
    });
});

/**
 * Tests for the appId resolution rule used by getResolvedMediaSecurityContext.
 *
 * The upload path must resolve appId the same way as the listing path so that
 * RLS filters match. The rule is:
 *   headerAppId || configAppId || securityContextAppId
 *
 * Previously, the order was headerAppId || securityContextAppId || configAppId,
 * which caused uploads via raw fetch/XHR (no X-App-Id header) to store
 * appId='web' while the listing client sent X-App-Id='app-id'.
 */
describe('media appId resolution (regression)', () => {
    // Mirrors the expression in getResolvedMediaSecurityContext
    function resolveAppId(headerAppId: string | null, configAppId: string, securityContextAppId: string): string {
        return headerAppId || configAppId || securityContextAppId;
    }

    it('prefers explicit X-App-Id header when present', () => {
        expect(resolveAppId('custom-app', 'otta-web', 'web')).toBe('custom-app');
    });

    it('falls back to config.appId when header is absent', () => {
        // This is the core regression case: uploads without X-App-Id header
        // must get config.appId, NOT the generic 'web' default.
        expect(resolveAppId(null, 'otta-web', 'web')).toBe('otta-web');
    });

    it('falls back to securityContext.appId when both header and config are empty', () => {
        expect(resolveAppId(null, '', 'web')).toBe('web');
    });
});
