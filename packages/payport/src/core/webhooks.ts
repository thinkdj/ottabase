// ============================================================
// Payport — Webhook Ingestion
// ============================================================
//
// 1. Verifies signature via the active provider adapter.
// 2. Persists raw + normalized payload for audit/replay (idempotent
//    on (provider, externalEventId)).
// 3. Applies side-effects to local mirrors (PaymentSubscription, etc.).
// 4. Emits the universal event(s) on the bus.
//
// Returning a Response from `handleWebhookRequest()` keeps the
// HTTP layer in the app and the persistence/emit logic here.
// ============================================================

import { PaymentEvent, PaymentSubscription } from '../models';
import type { NormalizedWebhook, PaymentProviderName, PayportEvent, SubscriptionDTO } from '../types';
import { clearEntitlementsCache } from './entitlements';
import { emit } from './events';
import { getProvider } from './registry';

export interface IngestResult {
    duplicate: boolean;
    provider: PaymentProviderName;
    externalEventId: string;
    eventTypes: string[];
}

/**
 * High-level helper for HTTP handlers. Catches errors and returns
 * a JSON Response with appropriate status codes.
 */
export async function handleWebhookRequest(
    request: Request,
    options?: { provider?: PaymentProviderName },
): Promise<Response> {
    const provider = getProvider(options?.provider);
    const rawBody = await request.text();
    const headers = request.headers;

    try {
        provider.verifyWebhook({ rawBody, headers });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'invalid_signature', message: (err as Error).message }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
        });
    }

    let normalized: NormalizedWebhook;
    try {
        normalized = await provider.handleWebhook({ rawBody, headers });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'parse_error', message: (err as Error).message }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
        });
    }

    const result = await ingest(provider.name, rawBody, normalized);

    return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

/**
 * Lower-level ingestion: idempotent persistence + side-effects + emit.
 * Exposed for replay (`replayEvent`) and tests.
 */
export async function ingest(
    providerName: PaymentProviderName,
    rawBody: string,
    normalized: NormalizedWebhook,
): Promise<IngestResult> {
    // Idempotency check.
    const existing = await PaymentEvent.findByExternal(providerName, normalized.externalEventId);
    if (existing && (existing.get('status') as string) === 'processed') {
        return {
            duplicate: true,
            provider: providerName,
            externalEventId: normalized.externalEventId,
            eventTypes: normalized.events.map((e) => e.type),
        };
    }

    const record =
        existing ??
        ((await PaymentEvent.create({
            provider: providerName,
            externalEventId: normalized.externalEventId,
            eventType: normalized.events[0]?.type ?? 'unknown',
            rawPayload: rawBody,
            normalizedPayload: JSON.stringify(normalized.events),
            status: 'pending',
            attemptCount: 0,
        })) as PaymentEvent);

    try {
        for (const event of normalized.events) {
            await applySideEffects(event);
            await emit(event);
        }

        record.set('status', 'processed');
        record.set('processedAt', new Date());
        record.set('attemptCount', ((record.get('attemptCount') as number) ?? 0) + 1);
        record.set('lastError', null);
        await record.save();
    } catch (err) {
        record.set('status', 'failed');
        record.set('attemptCount', ((record.get('attemptCount') as number) ?? 0) + 1);
        record.set('lastError', (err as Error).message);
        await record.save();
        throw err;
    }

    return {
        duplicate: false,
        provider: providerName,
        externalEventId: normalized.externalEventId,
        eventTypes: normalized.events.map((e) => e.type),
    };
}

/**
 * Replay a previously-received event by id. Re-runs side-effects and re-emits.
 */
export async function replayEvent(paymentEventId: string): Promise<IngestResult> {
    const record = (await PaymentEvent.find(paymentEventId)) as PaymentEvent | null;
    if (!record) throw new Error(`[payport] PaymentEvent "${paymentEventId}" not found.`);

    const events = safeJsonArray(record.get('normalizedPayload') as string | null) as PayportEvent[] | null;
    if (!events?.length) throw new Error(`[payport] PaymentEvent "${paymentEventId}" has no normalized payload.`);

    return ingest(record.get('provider') as PaymentProviderName, record.get('rawPayload') as string, {
        externalEventId: record.get('externalEventId') as string,
        events,
    });
}

// ============================================================
// Side-effects: keep local DB mirrors in sync
// ============================================================

async function applySideEffects(event: PayportEvent): Promise<void> {
    if (event.type.startsWith('payment.subscription.')) {
        const sub = event.data as Partial<SubscriptionDTO> | undefined;
        if (!sub?.externalSubscriptionId) return;

        const existing = await PaymentSubscription.findByExternal(event.provider, sub.externalSubscriptionId);

        const patch: Record<string, unknown> = {
            status: sub.status,
            planSlug: sub.planSlug,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
            trialEndsAt: sub.trialEndsAt ?? null,
        };

        if (existing) {
            for (const [key, value] of Object.entries(patch)) {
                if (value !== undefined) existing.set(key, value);
            }
            if (sub.metadata) existing.set('metadata', JSON.stringify(sub.metadata));
            await existing.save();
        } else if (sub.userId) {
            await PaymentSubscription.create({
                userId: sub.userId,
                provider: event.provider,
                externalSubscriptionId: sub.externalSubscriptionId,
                planSlug: sub.planSlug ?? 'unknown',
                status: sub.status ?? 'incomplete',
                currentPeriodStart: sub.currentPeriodStart ?? null,
                currentPeriodEnd: sub.currentPeriodEnd ?? null,
                cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
                trialEndsAt: sub.trialEndsAt ?? null,
                metadata: sub.metadata ? JSON.stringify(sub.metadata) : null,
            });
        }

        // Evict the entitlements cache for this user so the next
        // hasFeature() call reflects the updated subscription state.
        const affectedUserId = sub.userId ?? (existing?.get('userId') as string | undefined);
        if (affectedUserId) clearEntitlementsCache(affectedUserId);
    }
}

function safeJsonArray(input: string | null): unknown[] | null {
    if (!input) return null;
    try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}
