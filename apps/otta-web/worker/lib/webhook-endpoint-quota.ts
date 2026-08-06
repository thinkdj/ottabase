import type { WebhookCaller, WebhookEndpointQuotaInput, WebhookEndpointReservation } from '@ottabase/premium-webhooks';
import type { CloudflareEnv } from '../../cloudflare-env';
import type { WebhookEndpointQuota } from '../durable-objects/WebhookEndpointQuota';

type QuotaStub = Pick<WebhookEndpointQuota, 'reserve' | 'commit' | 'release'>;

/** A deterministic tenant coordination atom; it is never derived from request input. */
export function webhookEndpointQuotaScope(caller: WebhookCaller): string {
    const tenant = caller.organizationId === null ? `user:${caller.userId}` : `organization:${caller.organizationId}`;
    return `${caller.appId}:${tenant}`;
}

/**
 * Adapter passed into the generic webhooks package. A reservation is deliberately
 * short-lived: D1 remains authoritative, so a crashed request loses its provisional slot
 * and the next count reconciles naturally after the lease expires.
 */
export async function reserveWebhookEndpointSlot(
    env: CloudflareEnv,
    caller: WebhookCaller,
    input: WebhookEndpointQuotaInput,
): Promise<WebhookEndpointReservation | null> {
    const namespace = env.OBCF_WEBHOOK_ENDPOINT_QUOTA;
    if (!namespace) {
        throw new Error('OBCF_WEBHOOK_ENDPOINT_QUOTA binding is required for strict webhook endpoint quotas');
    }

    const stub = namespace.getByName(webhookEndpointQuotaScope(caller)) as unknown as QuotaStub;
    const reserved = await stub.reserve(input);
    if (!reserved) return null;

    let settled = false;
    const settle = async (operation: 'commit' | 'release') => {
        if (settled) return;
        settled = true;
        await stub[operation](reserved.id);
    };

    return {
        commit: () => settle('commit'),
        release: () => settle('release'),
    };
}

/** Reconcile a delete so committed slots do not stay allocated after a row is removed. */
export async function synchronizeWebhookEndpointQuota(
    env: CloudflareEnv,
    caller: WebhookCaller,
    current: number,
): Promise<void> {
    const namespace = env.OBCF_WEBHOOK_ENDPOINT_QUOTA;
    if (!namespace) {
        throw new Error('OBCF_WEBHOOK_ENDPOINT_QUOTA binding is required for strict webhook endpoint quotas');
    }
    const stub = namespace.getByName(webhookEndpointQuotaScope(caller)) as unknown as Pick<
        WebhookEndpointQuota,
        'synchronize'
    >;
    await stub.synchronize(current);
}
