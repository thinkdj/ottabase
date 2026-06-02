// ============================================================
// Payport — Universal Event Bus
// ============================================================
//
// Adapters emit normalized PayportEvents into this bus. Apps
// subscribe to lifecycle events without knowing the provider.
// ============================================================

import type { PayportEvent, PayportEventType } from '../types';

type Listener = (event: PayportEvent) => void | Promise<void>;

const LISTENERS = new Map<PayportEventType | '*', Set<Listener>>();

/** Subscribe to a single event type (or `*` for all). Returns an unsubscribe fn. */
export function on(type: PayportEventType | '*', listener: Listener): () => void {
    const set = LISTENERS.get(type) ?? new Set<Listener>();
    set.add(listener);
    LISTENERS.set(type, set);
    return () => {
        set.delete(listener);
    };
}

/** Emit an event to all matching listeners. Errors in listeners are swallowed-and-logged. */
export async function emit(event: PayportEvent): Promise<void> {
    const targets = [...(LISTENERS.get(event.type) ?? []), ...(LISTENERS.get('*') ?? [])];
    await Promise.all(
        targets.map(async (listener) => {
            try {
                await listener(event);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[payport] event listener error', { type: event.type, err });
            }
        }),
    );
}

/** Test/teardown helper. */
export function clearEventBus(): void {
    LISTENERS.clear();
}

// ---------------- Typed sugar helpers ----------------

export const onSubscriptionActivated = (listener: Listener) => on('payment.subscription.activated', listener);
export const onSubscriptionCancelled = (listener: Listener) => on('payment.subscription.cancelled', listener);
export const onSubscriptionTrialStarted = (listener: Listener) => on('payment.subscription.trial_started', listener);
export const onSubscriptionPaymentFailed = (listener: Listener) => on('payment.subscription.payment_failed', listener);
export const onPlanChanged = (listener: Listener) => on('payment.plan.changed', listener);
export const onCheckoutCompleted = (listener: Listener) => on('payment.checkout.completed', listener);
