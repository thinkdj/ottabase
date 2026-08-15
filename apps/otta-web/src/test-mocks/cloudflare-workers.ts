/**
 * Minimal runtime stand-in for `cloudflare:workers` in Vitest.
 *
 * Workerd supplies this base class in production. The worker route tests import the
 * module graph but do not run a Durable Object isolate, so this keeps the test
 * environment honest without emulating Cloudflare's storage implementation.
 */
interface DurableObjectStorage {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
}

interface DurableObjectState {
    storage: DurableObjectStorage;
}

export class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Env;

    constructor(ctx: DurableObjectState, env: Env) {
        this.ctx = ctx;
        this.env = env;
    }
}
