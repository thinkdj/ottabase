import { describe, expect, it } from 'vitest';
import { defineOttabaseConfig } from '../defineOttabaseConfig';
import { resolveConfigWithEnv } from '../resolveConfigWithEnv';

const baseInput = { appId: 'test-app', appName: 'Test App' };

describe('authBehavior account policy', () => {
    it('defaults to owner sign-ups and no OAuth claim of existing users', () => {
        const { authBehavior } = defineOttabaseConfig(baseInput).features;
        expect(authBehavior.signupRole).toBe('owner');
        expect(authBehavior.oauthClaimsUnclaimedUsers).toBe(false);
    });

    it('keeps the config file values through env resolution', () => {
        const config = defineOttabaseConfig({
            ...baseInput,
            features: {
                authBehavior: {
                    sessionMaxAge: 60,
                    requireEmailVerified: false,
                    disableCredentials: false,
                    verbose: false,
                    signupRole: 'member',
                    oauthClaimsUnclaimedUsers: true,
                },
            },
        });
        const { authBehavior } = resolveConfigWithEnv(config, { AUTH_VERBOSE: 'true' }).features;
        expect(authBehavior).toMatchObject({ signupRole: 'member', oauthClaimsUnclaimedUsers: true, verbose: true });
    });
});
