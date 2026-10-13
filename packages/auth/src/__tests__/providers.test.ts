import { describe, expect, it } from 'vitest';
import { buildAuthorizationUrl } from '../providers/oauth-client';
import { createGoogleProvider } from '../providers/presets';

describe('Google sign-in preset', () => {
    it('asks for identity only: no offline access, no forced consent screen', () => {
        // Sign-in stores no provider tokens, so requesting a refresh token would only force
        // returning users through Google's consent screen on every login for nothing.
        const provider = createGoogleProvider({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' });
        const url = new URL(
            buildAuthorizationUrl(provider, {
                redirectUri: 'https://app.test/api/auth/callback/google',
                state: 's',
                codeChallenge: 'c',
            }),
        );

        expect(url.searchParams.get('scope')).toBe('openid email profile');
        expect(url.searchParams.has('access_type')).toBe(false);
        expect(url.searchParams.has('prompt')).toBe(false);
    });
});
