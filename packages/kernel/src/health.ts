import type {
    EnvDeclaration,
    EnvKey,
    EnvKeyDeclaration,
    HealthCheck,
    HealthReport,
    PackageRegistry,
    ReadinessReport,
    ReadinessSetting,
} from './types';

/** A plain string declares a secret var: showing a value must be opted into. */
export function normalizeEnvKey(key: EnvKey): Required<Pick<EnvKeyDeclaration, 'key' | 'secret' | 'kind'>> & {
    description?: string;
} {
    if (typeof key === 'string') return { key, secret: true, kind: 'var' };
    return {
        key: key.key,
        secret: key.secret ?? true,
        kind: key.kind ?? 'var',
        ...(key.description ? { description: key.description } : {}),
    };
}

function isPresent(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
}

/**
 * Does a binding look like what its name promises? D1 has `prepare`, KV `get`, R2 `head`, a
 * queue `send`. Anything else is "exists". A `false` here means the binding is wired to the
 * wrong kind of resource, which a plain presence check would miss.
 */
function bindingLooksRight(key: string, value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    if (/D1/.test(key)) return typeof obj.prepare === 'function';
    if (/KV/.test(key)) return typeof obj.get === 'function';
    if (/R2/.test(key)) return typeof obj.head === 'function';
    if (/QUEUE/.test(key)) return typeof obj.send === 'function';
    return true;
}

/**
 * Masked preview for a non-secret var: first two and last two characters survive, anything over
 * 48 characters is cut in the middle. Short values show whole; booleans and numbers show whole.
 */
export function previewValue(value: unknown): string {
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    const text = String(value);
    if (text.length <= 6) return text;
    const masked = `${text.slice(0, 2)}${'*'.repeat(Math.min(text.length - 4, 12))}${text.slice(-2)}`;
    return masked.length > 48 ? `${masked.slice(0, 22)}...${masked.slice(-22)}` : masked;
}

/**
 * One report for the whole app: every package's required env, then every package's own
 * probe. A probe that throws becomes a failed check named after the package; it never
 * takes the report down with it.
 */
export async function runHealth<Env>(registry: PackageRegistry<Env>, env: Env): Promise<HealthReport> {
    const checks: HealthReport['checks'] = [];
    const bag = (env ?? {}) as Record<string, unknown>;

    for (const pkg of registry.packages) {
        for (const declared of pkg.env?.required ?? []) {
            const { key } = normalizeEnvKey(declared);
            checks.push({ package: pkg.key, name: `env:${key}`, ok: isPresent(bag[key]) });
        }
    }

    for (const list of await runProbes(registry, env)) checks.push(...list);

    return { ok: checks.every((check) => check.ok), checks };
}

/** Run every package probe in parallel. A throw or a timeout becomes one failed check. */
function runProbes<Env>(registry: PackageRegistry<Env>, env: Env, timeoutMs?: number) {
    return Promise.all(
        registry.packages
            .filter((pkg) => typeof pkg.health === 'function')
            .map(async (pkg): Promise<HealthReport['checks']> => {
                let timer: ReturnType<typeof setTimeout> | undefined;
                try {
                    const probe = Promise.resolve(pkg.health!(env));
                    const result = timeoutMs
                        ? await Promise.race([
                              probe,
                              new Promise<never>((_, reject) => {
                                  timer = setTimeout(() => reject(new Error('timed out')), timeoutMs);
                              }),
                          ])
                        : await probe;
                    const list: HealthCheck[] = Array.isArray(result) ? result : [result];
                    return list.map((check) => ({ ...check, package: pkg.key }));
                } catch (error) {
                    const detail =
                        error instanceof Error && error.message === 'timed out'
                            ? 'timed out'
                            : error instanceof Error
                              ? error.name
                              : 'probe threw';
                    return [{ package: pkg.key, name: 'probe', ok: false, detail }];
                } finally {
                    if (timer) clearTimeout(timer);
                }
            }),
    );
}

/**
 * The admin "System readiness" report: every declared env key (set or not, with a masked preview
 * only for `secret: false` vars) and every health probe, each probe under a timeout. No secret
 * character ever reaches the result: secrets and bindings report `set` alone.
 */
export async function runReadiness<Env>(
    registry: PackageRegistry<Env>,
    env: Env,
    options: { probeTimeoutMs?: number } = {},
): Promise<ReadinessReport> {
    const bag = (env ?? {}) as Record<string, unknown>;
    const settings: ReadinessSetting[] = registry.envDeclarations().map((declaration: EnvDeclaration) => {
        const value = bag[declaration.key];
        const set = declaration.kind === 'binding' ? bindingLooksRight(declaration.key, value) : isPresent(value);
        const preview = set && !declaration.secret && declaration.kind !== 'binding' ? previewValue(value) : undefined;
        return { ...declaration, set, ...(preview !== undefined ? { preview } : {}) };
    });

    const checks = (await runProbes(registry, env, options.probeTimeoutMs ?? 3000)).flat();
    const missingRequired = settings.filter((s) => s.required && !s.set).length;
    const failedChecks = checks.filter((c) => !c.ok).length;
    return {
        ok: missingRequired === 0 && failedChecks === 0,
        settings,
        checks,
        summary: {
            total: settings.length,
            set: settings.filter((s) => s.set).length,
            missingRequired,
            optionalUnset: settings.filter((s) => !s.required && !s.set).length,
            failedChecks,
        },
    };
}
