// ====================================================================
// @ottabase/ottaai/ottaorm — the composing factory
// --------------------------------------------------------------------
// ONE REGISTRATION BUNDLE — the strategy stated EXACTLY ONCE.
//
// A consuming app would otherwise register across five touchpoints (model,
// policy, schema collection, migration re-export, master secret next to the
// connection registration) WITH THE STRATEGY DUPLICATED between the policy and
// the resolver, kept in sync by hand-written comments in two files. That is the
// single most likely misconfiguration in the design and IT FAILS SILENTLY:
// tenants manage one set of rows while their calls use another.
//
// This factory takes the strategy once and hands it to both.
// ====================================================================

import type { ModelRLSConfig } from '@ottabase/ottaorm';
import { createProviderRegistry } from '../registry';
import { createAiProvisioning, type AiProvisioning, type CreateAiProvisioningOptions } from '../resolver';
import { AiProviderCredential, configureCredentialWrites, type CredentialWriteContext } from './AiProviderCredential';
import { aiProviderCredentialsTable } from './AiProviderCredential.schema';
import { createCredentialPolicy, type CredentialPolicyOptions } from './policy';
import { createOrmCredentialStore } from './store';
import { createCredentialHandlers, type CredentialHandlers, type CredentialHandlerOptions } from './handlers';

export interface CreateAiProvisioningWithStorageOptions<HostContext> extends Omit<
    CreateAiProvisioningOptions<HostContext>,
    'store'
> {
    /** Optional override — defaults to the ORM-backed store. */
    store?: CreateAiProvisioningOptions<HostContext>['store'];
    /** Extra permissions that authorise ORG-scoped credential management. */
    orgManagePermissions?: CredentialPolicyOptions['orgManagePermissions'];
    /** Alias validation. Without it, gateway key aliases are rejected on write. */
    validateAlias?: CredentialWriteContext['validateAlias'];
    /** Non-fatal write warnings (e.g. a model/provider mismatch on save). */
    onWarning?: CredentialWriteContext['onWarning'];
    /** Route-factory wiring: how to turn a `Request` into a host security context. */
    handlers?: CredentialHandlerOptions<HostContext>;
}

export interface AiProvisioningWithStorage<HostContext> extends AiProvisioning<HostContext> {
    /** Spread into the app's schema bucket (`config.migrations.ts` PACKAGE_REGISTRY). */
    readonly tables: { aiProviderCredentialsTable: typeof aiProviderCredentialsTable };
    /** Register with `registerModels([...])`. */
    readonly models: readonly [typeof AiProviderCredential];
    /** Register with `registerPolicy(...)` — AFTER `initRLS()`. */
    readonly policies: readonly ModelRLSConfig[];
    /** Mount at one path. */
    readonly handlers: CredentialHandlers;
}

/**
 * Compose the core with ORM-backed storage.
 *
 * Layering stays intact: L3 (the core) never imports L4; L4 composes L3.
 *
 * FRAMEWORK WIRING THAT FAILS SILENTLY OR CONFUSINGLY IF MISSED:
 *  • a model registered WITHOUT a policy hard-fails every write (not fail-open);
 *  • `registerPolicy` must run AFTER `initRLS()`, because the RLS registry is
 *    last-write-wins and `initRLS()` bulk-registers the built-ins;
 *  • the table must appear in the app's schema collection or auto-init skips it;
 *  • the auto-init migrator adds tables and columns but cannot rename, drop or backfill,
 *    and a new non-nullable column needs a default;
 *  • the model must declare `packageName` / `packageType` or it is mislabelled in the
 *    admin registry (it does — see the model).
 */
export function createAiProvisioningWithStorage<HostContext = unknown>(
    options: CreateAiProvisioningWithStorageOptions<HostContext>,
): AiProvisioningWithStorage<HostContext> {
    const store = options.store ?? createOrmCredentialStore();
    const registry = options.registry ?? createProviderRegistry();

    // Install the write context BEFORE the core is built, so a boot-time failure surfaces
    // as a configuration error rather than as a write that silently stores plaintext.
    configureCredentialWrites({
        keyring: options.keyring,
        registry,
        validateAlias: options.validateAlias,
        onWarning: options.onWarning,
    });

    const core = createAiProvisioning<HostContext>({ ...options, store, registry });

    const policy = createCredentialPolicy({
        // THE SAME VALUE, from one place. This is what makes "they must match" structural.
        strategy: core.strategy,
        orgManagePermissions: options.orgManagePermissions,
    });

    const handlers = createCredentialHandlers(core, options.handlers);

    return {
        ...core,
        tables: { aiProviderCredentialsTable },
        models: [AiProviderCredential] as const,
        policies: [policy] as const,
        handlers,
    };
}
