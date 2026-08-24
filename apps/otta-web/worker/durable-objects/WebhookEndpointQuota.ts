import { DurableObject } from 'cloudflare:workers';

const RESERVATIONS_KEY = 'endpoint-reservations';
const RESERVATION_TTL_MS = 60_000;

interface Reservation {
    expiresAt: number;
}

type Reservations = Record<string, Reservation>;

interface QuotaState {
    /** Lower bound on rows known to have been committed, refreshed after each delete. */
    committed: number;
    reservations: Reservations;
}

function isReservations(value: unknown): value is Reservations {
    return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.values(value).every(
            (entry) =>
                !!entry &&
                typeof entry === 'object' &&
                !Array.isArray(entry) &&
                Number.isFinite((entry as { expiresAt?: unknown }).expiresAt),
        )
    );
}

function isQuotaState(value: unknown): value is QuotaState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const state = value as { committed?: unknown; reservations?: unknown };
    return (
        Number.isSafeInteger(state.committed) && (state.committed as number) >= 0 && isReservations(state.reservations)
    );
}

/**
 * One actor per resolved webhook tenant. It serializes only the tiny interval between
 * counting endpoint rows and inserting one, while the D1-backed OttaORM model remains
 * the source of truth for endpoints themselves.
 */
export class WebhookEndpointQuota extends DurableObject<CloudflareEnv> {
    private async state(): Promise<QuotaState | null> {
        const stored = await this.ctx.storage.get<unknown>(RESERVATIONS_KEY);
        if (stored === undefined) return { committed: 0, reservations: {} };
        return isQuotaState(stored) ? stored : null;
    }

    /** Reserve one finite endpoint slot, or return null when the quota is full/unavailable. */
    async reserve(input: { current: number; limit: number }): Promise<{ id: string } | null> {
        if (
            !Number.isSafeInteger(input.current) ||
            input.current < 0 ||
            !Number.isSafeInteger(input.limit) ||
            input.limit < 0
        ) {
            return null;
        }

        const state = await this.state();
        if (!state) return null; // Corrupt coordination state fails closed.

        const now = Date.now();
        const active = Object.fromEntries(
            Object.entries(state.reservations).filter(([, reservation]) => reservation.expiresAt > now),
        );
        const committed = Math.max(state.committed, input.current);
        if (committed + Object.keys(active).length >= input.limit) {
            if (
                committed !== state.committed ||
                Object.keys(active).length !== Object.keys(state.reservations).length
            ) {
                await this.ctx.storage.put(RESERVATIONS_KEY, { committed, reservations: active });
            }
            return null;
        }

        const id = crypto.randomUUID();
        active[id] = { expiresAt: now + RESERVATION_TTL_MS };
        await this.ctx.storage.put(RESERVATIONS_KEY, { committed, reservations: active });
        return { id };
    }

    /** Retain the committed floor so a stale pre-insert D1 count cannot over-admit. */
    async commit(id: string): Promise<void> {
        const state = await this.state();
        if (!state || !Object.hasOwn(state.reservations, id)) return;
        delete state.reservations[id];
        await this.ctx.storage.put(RESERVATIONS_KEY, { ...state, committed: state.committed + 1 });
    }

    /** An unsuccessful insert must immediately free its slot. */
    async release(id: string): Promise<void> {
        await this.remove(id);
    }

    /** The delete route supplies the authoritative D1 count after a row is removed. */
    async synchronize(current: number): Promise<void> {
        if (!Number.isSafeInteger(current) || current < 0) return;
        const state = await this.state();
        if (!state) return; // Keep corrupt coordination state fail-closed for reservations.
        await this.ctx.storage.put(RESERVATIONS_KEY, { ...state, committed: current });
    }

    private async remove(id: string): Promise<void> {
        const state = await this.state();
        if (!state || !Object.hasOwn(state.reservations, id)) return;
        delete state.reservations[id];
        await this.ctx.storage.put(RESERVATIONS_KEY, state);
    }
}
