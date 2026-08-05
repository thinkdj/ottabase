// ============================================================
// Outbound delivery — what actually leaves the worker.
//
// Three properties matter: the payload is signed, a lapsed license stops delivery
// entirely, and a failing customer endpoint never escapes as an exception into the
// caller's request.
// ============================================================

import { createMemoryStateStore, createPremiumRegistry, type PremiumRegistry } from '@ottabase/premium';
import { generateLicenseKeypair, issueLicense } from '@ottabase/premium/license-tools';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTables, tables } from './fake-models';
import { WEBHOOKS_PACKAGE_KEY } from '../constants';
import { createWebhooksPackage } from '../manifest';
import { dispatchWebhookEvent, summarizeDeliveryError } from '../dispatch';
import { EVENT_HEADER, SIGNATURE_HEADER, verifySignatureHeader } from '../signing';

vi.mock('../ottaorm-models/WebhookEndpoint', async () => {
    const { FakeWebhookEndpoint } = await import('./fake-models');
    return { WebhookEndpoint: FakeWebhookEndpoint };
});
vi.mock('../ottaorm-models/WebhookDelivery', async () => {
    const { FakeWebhookDelivery } = await import('./fake-models');
    return { WebhookDelivery: FakeWebhookDelivery };
});

type Env = Record<string, unknown>;

const TENANT = { organizationId: 'org-1', appId: 'otta-web' };
const SECRET = 'whsec_dispatch_test';

let keys: { publicKey: string; privateKey: string };
let proLicense: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
    keys = await generateLicenseKeypair();
    proLicense = await issueLicense(
        { pkg: WEBHOOKS_PACKAGE_KEY, plan: 'pro', licensee: 'Acme', features: ['deliveries.log'] },
        keys.privateKey,
    );
});

function makeRegistry(): PremiumRegistry<Env> {
    return createPremiumRegistry<Env>({
        packages: [createWebhooksPackage<Env>({ licensePublicKey: keys.publicKey, resolveCaller: async () => null })],
        getStore: () => createMemoryStateStore(),
        cacheTtlMs: 0,
    });
}

function seedEndpoint(overrides: Record<string, unknown> = {}) {
    tables.endpoints.push({
        id: 'ep_1',
        url: 'https://example.com/hooks',
        events: ['todo.created'],
        secret: SECRET,
        enabled: true,
        consecutiveFailures: 0,
        ...TENANT,
        ...overrides,
    });
}

beforeEach(() => {
    resetTables();
    fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('dispatchWebhookEvent', () => {
    it('signs the payload so the receiver can verify it', async () => {
        seedEndpoint();
        await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: { id: 7 },
            tenant: TENANT,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://example.com/hooks');

        const headers = init.headers as Record<string, string>;
        expect(headers[EVENT_HEADER]).toBe('todo.created');
        await expect(verifySignatureHeader(SECRET, init.body as string, headers[SIGNATURE_HEADER])).resolves.toBe(true);
    });

    it('never follows a redirect — a 3xx into a private address would be an SSRF', async () => {
        seedEndpoint();
        await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });

        expect((fetchMock.mock.calls[0][1] as RequestInit).redirect).toBe('manual');
    });

    it('delivers the usable free tier when the package is unlicensed', async () => {
        seedEndpoint();
        const outcomes = await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: {},
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });

        expect(outcomes).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('addresses personal endpoints by user id and never widens a null organization scope', async () => {
        seedEndpoint({ id: 'ep_mine', organizationId: null, userId: 'user-1' });
        seedEndpoint({ id: 'ep_theirs', organizationId: null, userId: 'user-2' });

        await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: { organizationId: null, appId: 'otta-web', userId: 'user-1' },
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/hooks');
    });

    it('fails closed when a personal dispatch omits its user id', async () => {
        seedEndpoint({ organizationId: null, userId: 'user-1' });
        const outcomes = await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: { organizationId: null, appId: 'otta-web' },
        });

        expect(outcomes).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('skips endpoints that are disabled or not subscribed', async () => {
        seedEndpoint({ id: 'ep_off', enabled: false });
        seedEndpoint({ id: 'ep_other', events: ['user.created'] });
        seedEndpoint({ id: 'ep_wildcard', events: ['*'] });

        await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('never delivers to another tenant', async () => {
        seedEndpoint({ id: 'ep_theirs', organizationId: 'org-2', events: ['*'] });

        const outcomes = await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });

        expect(outcomes).toEqual([]);
    });

    it('records endpoint health on every plan, and the delivery LOG only when licensed for it', async () => {
        seedEndpoint();
        const registry = makeRegistry();

        await dispatchWebhookEvent({
            registry,
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });
        expect(tables.endpoints[0].lastStatus).toBe('success');
        expect(tables.deliveries).toHaveLength(1);

        // A license WITHOUT the log feature: health still lands, history does not.
        const basic = await issueLicense(
            { pkg: WEBHOOKS_PACKAGE_KEY, plan: 'starter', licensee: 'Acme' },
            keys.privateKey,
        );
        resetTables();
        seedEndpoint();
        await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: basic },
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });

        expect(tables.endpoints[0].lastStatus).toBe('success');
        expect(tables.deliveries).toHaveLength(0);
    });

    it('turns a failing endpoint into an outcome, never an exception', async () => {
        seedEndpoint();
        fetchMock.mockRejectedValue(new TypeError('network down'));

        const outcomes = await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });

        expect(outcomes[0]).toMatchObject({ ok: false, error: 'TypeError' });
        expect(tables.endpoints[0]).toMatchObject({ lastStatus: 'failed', consecutiveFailures: 1 });
    });

    it('counts a non-2xx as a failure and reports the code', async () => {
        seedEndpoint();
        fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));

        const outcomes = await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });

        expect(outcomes[0]).toMatchObject({ ok: false, statusCode: 500, error: 'HTTP 500' });
    });

    it('resets the failure streak after a success', async () => {
        seedEndpoint({ consecutiveFailures: 4 });
        await dispatchWebhookEvent({
            registry: makeRegistry(),
            env: { PREMIUM_LICENSE_WEBHOOKS: proLicense },
            event: 'todo.created',
            payload: {},
            tenant: TENANT,
        });

        expect(tables.endpoints[0].consecutiveFailures).toBe(0);
    });
});

describe('summarizeDeliveryError', () => {
    it('never returns the raw failure — those carry the signed body and the URL', () => {
        const detailed = new TypeError('fetch to https://example.com?token=SECRET failed');
        expect(summarizeDeliveryError(detailed)).toBe('TypeError');
        expect(summarizeDeliveryError(new Error('boom'))).toBe('request failed');
        expect(summarizeDeliveryError('anything')).toBe('request failed');
    });

    it('names a timeout, because that is the one an operator can act on', () => {
        expect(summarizeDeliveryError(new DOMException('aborted', 'AbortError'))).toBe('timeout');
    });
});
