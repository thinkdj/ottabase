// ============================================================
// @ottabase/ottaai/manifest — the package as the app registers it
// ============================================================
// The credentials table, the model and the RLS policy that guards it. The host adds the
// routes: the inference and credential handlers need its session resolver and its gates.
// ============================================================

import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { AiProviderCredential } from './ottaorm/AiProviderCredential';
import { createCredentialPolicy, type CredentialPolicyOptions } from './ottaorm/policy';
import { aiProviderCredentialsTable } from './schema';

export const OTTAAI_PACKAGE_KEY = 'ottaai';

export interface OttaaiPackageOptions<Env> extends PackageExtras<Env> {
    /**
     * Whose credentials a request may resolve to. STRUCTURAL: it shapes the RLS policy on the
     * credentials table, so it is a value in `ottabase.config.ts`, never an env var.
     */
    strategy: CredentialPolicyOptions['strategy'];
    orgManagePermissions?: CredentialPolicyOptions['orgManagePermissions'];
}

export function createOttaaiPackage<Env = unknown>(options: OttaaiPackageOptions<Env>): OttaPackage<Env> {
    const { strategy, orgManagePermissions, ...extras } = options;
    return definePackage<Env>({
        key: OTTAAI_PACKAGE_KEY,
        name: 'AI providers',
        version: '1.0.0',
        description: 'Tenant BYOK for AI: encrypted provider credentials, resolved per request through the gateway.',
        tables: { aiProviderCredentialsTable },
        models: [AiProviderCredential],
        policies: [createCredentialPolicy({ strategy, orgManagePermissions })],
        ...extras,
    });
}
