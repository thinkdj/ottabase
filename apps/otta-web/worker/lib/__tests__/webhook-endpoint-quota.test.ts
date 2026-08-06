import { describe, expect, it, vi } from 'vitest';
import {
    reserveWebhookEndpointSlot,
    synchronizeWebhookEndpointQuota,
    webhookEndpointQuotaScope,
} from '../webhook-endpoint-quota';

const caller = { appId: 'otta-web', organizationId: 'org-1', userId: 'user-1', canManage: true };

describe('webhook endpoint quota coordinator', () => {
    it('uses one durable actor per resolved tenant and settles a reservation once', async () => {
        const reserve = vi.fn(async () => ({ id: 'reservation-1' }));
        const commit = vi.fn(async () => undefined);
        const release = vi.fn(async () => undefined);
        const synchronize = vi.fn(async () => undefined);
        const getByName = vi.fn(() => ({ reserve, commit, release, synchronize }));

        const reservation = await reserveWebhookEndpointSlot(
            { OBCF_WEBHOOK_ENDPOINT_QUOTA: { getByName } } as any,
            caller,
            { current: 0, limit: 1 },
        );

        expect(getByName).toHaveBeenCalledWith('otta-web:organization:org-1');
        expect(reserve).toHaveBeenCalledWith({ current: 0, limit: 1 });
        await reservation?.commit();
        await reservation?.release();
        expect(commit).toHaveBeenCalledWith('reservation-1');
        expect(release).not.toHaveBeenCalled();

        await synchronizeWebhookEndpointQuota({ OBCF_WEBHOOK_ENDPOINT_QUOTA: { getByName } } as any, caller, 0);
        expect(synchronize).toHaveBeenCalledWith(0);
    });

    it('keeps personal scopes isolated by user id', () => {
        expect(webhookEndpointQuotaScope({ ...caller, organizationId: null, userId: 'user-1' })).toBe(
            'otta-web:user:user-1',
        );
        expect(webhookEndpointQuotaScope({ ...caller, organizationId: null, userId: 'user-2' })).toBe(
            'otta-web:user:user-2',
        );
    });
});
