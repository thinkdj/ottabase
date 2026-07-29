import { describe, expect, it } from 'vitest';
// Import the source module that backs the pure `@ottabase/auth/config` subpath.
// These helpers use type-only imports, so this entry must stay free of any UI deps
// (@ottabase/ui-shadcn / lucide-react live only on `@ottabase/auth/components`).
import {
    getConfiguredSocialProviders,
    getLoginConfig,
    isCredentialsConfigured,
    isEmailProviderConfigured,
} from '../components/helpers';
import type { ProviderEnv } from '../providers';

describe('@ottabase/auth/config boundary', () => {
    it('exposes the pure login-config helpers', () => {
        expect(typeof getLoginConfig).toBe('function');
        expect(typeof getConfiguredSocialProviders).toBe('function');
        expect(typeof isCredentialsConfigured).toBe('function');
        expect(typeof isEmailProviderConfigured).toBe('function');
    });

    it('getLoginConfig derives a config object from env vars', () => {
        // Empty env: no social providers, credentials on by default, no email sender.
        const config = getLoginConfig({} as ProviderEnv);

        expect(config).toEqual({
            socialProviders: [],
            showCredentials: true,
            showMagicLink: false,
            hasSocialProviders: false,
            hasEmailProvider: false,
        });
    });

    it('reflects configured providers and disabled credentials', () => {
        const env = {
            GOOGLE_CLIENT_ID: 'id',
            GOOGLE_CLIENT_SECRET: 'secret',
            EMAIL_RESEND_API_KEY: 're_123',
            AUTH_DISABLE_CREDENTIALS: 'true',
        } as unknown as ProviderEnv;

        const config = getLoginConfig(env);

        expect(config.showCredentials).toBe(false);
        expect(config.showMagicLink).toBe(true);
        expect(config.hasSocialProviders).toBe(true);
        expect(config.socialProviders).toEqual([{ id: 'google', name: 'Google' }]);
    });
});
