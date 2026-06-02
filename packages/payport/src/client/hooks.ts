// ============================================================
// Payport — React Client Hooks
// ============================================================
//
// Lightweight TanStack Query wrappers around the standard
// Payport HTTP endpoints. Apps can override the base URL if
// they mount Payport routes elsewhere.
// ============================================================

import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationOptions,
    type UseQueryOptions,
} from '@tanstack/react-query';
import type {
    CustomerMeterDTO,
    DiscountDTO,
    LicenseActivationDTO,
    RefundDTO,
    SubscriptionDTO,
    ValidateLicenseResult,
} from '../types';

export interface UsePayportOptions {
    /** Override the default `/api/payport` base. */
    baseUrl?: string;
    /** Override `fetch` (e.g. for auth headers). */
    fetcher?: typeof fetch;
}

const DEFAULT_BASE = '/api/payport';

function resolve(opts?: UsePayportOptions) {
    return {
        base: opts?.baseUrl ?? DEFAULT_BASE,
        fetcher: opts?.fetcher ?? fetch,
    };
}

async function jsonFetch<T>(fetcher: typeof fetch, url: string, init?: RequestInit): Promise<T> {
    const res = await fetcher(url, {
        ...init,
        headers: { 'content-type': 'application/json', accept: 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Payport request failed (${res.status}): ${text}`);
    }
    return (await res.json()) as T;
}

// ------------------------------------------------------------
// useSubscription
// ------------------------------------------------------------
export interface SubscriptionResponse {
    subscription: SubscriptionDTO | null;
}

export function useSubscription(opts?: UsePayportOptions & { queryOptions?: UseQueryOptions<SubscriptionResponse> }) {
    const { base, fetcher } = resolve(opts);
    return useQuery<SubscriptionResponse>({
        queryKey: ['payport', 'subscription'],
        queryFn: () => jsonFetch<SubscriptionResponse>(fetcher, `${base}/subscription`),
        ...(opts?.queryOptions ?? {}),
    });
}

// ------------------------------------------------------------
// useEntitlements
// ------------------------------------------------------------
export interface EntitlementsResponse {
    userId: string;
    planSlug: string | null;
    features: string[];
}

export function useEntitlements(opts?: UsePayportOptions & { queryOptions?: UseQueryOptions<EntitlementsResponse> }) {
    const { base, fetcher } = resolve(opts);
    return useQuery<EntitlementsResponse>({
        queryKey: ['payport', 'entitlements'],
        queryFn: () => jsonFetch<EntitlementsResponse>(fetcher, `${base}/entitlements`),
        ...(opts?.queryOptions ?? {}),
    });
}

// ------------------------------------------------------------
// useHasFeature — derived, no extra fetch if entitlements is cached.
// ------------------------------------------------------------
export function useHasFeature(feature: string, opts?: UsePayportOptions) {
    const result = useEntitlements(opts);
    return {
        ...result,
        hasFeature: result.data?.features.includes(feature) ?? false,
    };
}

// ------------------------------------------------------------
// usePlan — current plan slug derived from subscription.
// ------------------------------------------------------------
export function usePlan(opts?: UsePayportOptions) {
    const result = useSubscription(opts);
    return {
        ...result,
        plan: result.data?.subscription?.planSlug ?? null,
        status: result.data?.subscription?.status ?? null,
    };
}

// ------------------------------------------------------------
// useCheckout — mutation that opens checkout URL.
// ------------------------------------------------------------
export interface CreateCheckoutBody {
    plan: string;
    successUrl: string;
    cancelUrl: string;
    email?: string;
    metadata?: Record<string, string>;
}

export interface CreateCheckoutResponse {
    checkoutUrl: string;
    externalCheckoutId: string;
}

export function useCheckout(
    opts?: UsePayportOptions & {
        mutationOptions?: UseMutationOptions<CreateCheckoutResponse, Error, CreateCheckoutBody>;
        autoRedirect?: boolean;
    },
) {
    const { base, fetcher } = resolve(opts);
    return useMutation<CreateCheckoutResponse, Error, CreateCheckoutBody>({
        mutationFn: async (body) => {
            const result = await jsonFetch<CreateCheckoutResponse>(fetcher, `${base}/checkout`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (opts?.autoRedirect !== false && typeof window !== 'undefined') {
                window.location.href = result.checkoutUrl;
            }
            return result;
        },
        ...(opts?.mutationOptions ?? {}),
    });
}

// ------------------------------------------------------------
// useBillingPortal
// ------------------------------------------------------------
export function useBillingPortal(opts?: UsePayportOptions & { autoRedirect?: boolean }) {
    const { base, fetcher } = resolve(opts);
    return useMutation<{ portalUrl: string }, Error, { returnUrl: string }>({
        mutationFn: async (body) => {
            const result = await jsonFetch<{ portalUrl: string }>(fetcher, `${base}/portal`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (opts?.autoRedirect !== false && typeof window !== 'undefined') {
                window.location.href = result.portalUrl;
            }
            return result;
        },
    });
}

// ------------------------------------------------------------
// useCancelSubscription / useResumeSubscription
// ------------------------------------------------------------
export function useCancelSubscription(opts?: UsePayportOptions) {
    const { base, fetcher } = resolve(opts);
    const qc = useQueryClient();
    return useMutation<SubscriptionResponse, Error, { subscriptionId: string; immediate?: boolean }>({
        mutationFn: (body) =>
            jsonFetch<SubscriptionResponse>(fetcher, `${base}/subscription/cancel`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['payport', 'subscription'] });
            qc.invalidateQueries({ queryKey: ['payport', 'entitlements'] });
        },
    });
}

export function useResumeSubscription(opts?: UsePayportOptions) {
    const { base, fetcher } = resolve(opts);
    const qc = useQueryClient();
    return useMutation<SubscriptionResponse, Error, { subscriptionId: string }>({
        mutationFn: (body) =>
            jsonFetch<SubscriptionResponse>(fetcher, `${base}/subscription/resume`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['payport', 'subscription'] });
            qc.invalidateQueries({ queryKey: ['payport', 'entitlements'] });
        },
    });
}

// ------------------------------------------------------------
// useDiscounts — public storefront list of active discounts.
// ------------------------------------------------------------
export interface DiscountsResponse {
    discounts: DiscountDTO[];
}

export function useDiscounts(opts?: UsePayportOptions & { queryOptions?: UseQueryOptions<DiscountsResponse> }) {
    const { base, fetcher } = resolve(opts);
    return useQuery<DiscountsResponse>({
        queryKey: ['payport', 'discounts'],
        queryFn: () => jsonFetch<DiscountsResponse>(fetcher, `${base}/discounts`),
        ...(opts?.queryOptions ?? {}),
    });
}

// ------------------------------------------------------------
// useRecordUsage — records a metered usage event.
// ------------------------------------------------------------
export interface RecordUsageBody {
    meter: string;
    value: number;
    externalEventId?: string;
    metadata?: Record<string, string | number | boolean>;
    occurredAt?: string;
}

export function useRecordUsage(opts?: UsePayportOptions) {
    const { base, fetcher } = resolve(opts);
    const qc = useQueryClient();
    return useMutation<{ event: unknown }, Error, RecordUsageBody>({
        mutationFn: (body) => jsonFetch(fetcher, `${base}/usage`, { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: ['payport', 'meter', vars.meter] });
        },
    });
}

// ------------------------------------------------------------
// useCustomerMeter — current balance/consumption for a meter slug.
// ------------------------------------------------------------
export interface CustomerMeterResponse {
    meter: CustomerMeterDTO | null;
}

export function useCustomerMeter(
    meterSlug: string,
    opts?: UsePayportOptions & { queryOptions?: UseQueryOptions<CustomerMeterResponse> },
) {
    const { base, fetcher } = resolve(opts);
    return useQuery<CustomerMeterResponse>({
        queryKey: ['payport', 'meter', meterSlug],
        queryFn: () => jsonFetch<CustomerMeterResponse>(fetcher, `${base}/meters/${encodeURIComponent(meterSlug)}`),
        enabled: Boolean(meterSlug),
        ...(opts?.queryOptions ?? {}),
    });
}

// ------------------------------------------------------------
// useRefunds / useCreateRefund
// ------------------------------------------------------------
export interface RefundsResponse {
    refunds: RefundDTO[];
}

export function useRefunds(opts?: UsePayportOptions & { queryOptions?: UseQueryOptions<RefundsResponse> }) {
    const { base, fetcher } = resolve(opts);
    return useQuery<RefundsResponse>({
        queryKey: ['payport', 'refunds'],
        queryFn: () => jsonFetch<RefundsResponse>(fetcher, `${base}/refunds`),
        ...(opts?.queryOptions ?? {}),
    });
}

export interface CreateRefundBody {
    orderId: string;
    amount?: number;
    reason?: string;
    comment?: string;
    metadata?: Record<string, string>;
}

export function useCreateRefund(opts?: UsePayportOptions) {
    const { base, fetcher } = resolve(opts);
    const qc = useQueryClient();
    return useMutation<{ refund: RefundDTO }, Error, CreateRefundBody>({
        mutationFn: (body) => jsonFetch(fetcher, `${base}/refunds`, { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['payport', 'refunds'] });
        },
    });
}

// ------------------------------------------------------------
// License keys — validation, activation, deactivation.
// ------------------------------------------------------------
export interface ValidateLicenseBody {
    key: string;
    activationId?: string;
    incrementUsage?: number;
}

export function useValidateLicense(opts?: UsePayportOptions) {
    const { base, fetcher } = resolve(opts);
    return useMutation<ValidateLicenseResult, Error, ValidateLicenseBody>({
        mutationFn: (body) =>
            jsonFetch<ValidateLicenseResult>(fetcher, `${base}/license/validate`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),
    });
}

export interface ActivateLicenseBody {
    key: string;
    label?: string;
    metadata?: Record<string, string>;
}

export function useActivateLicense(opts?: UsePayportOptions) {
    const { base, fetcher } = resolve(opts);
    return useMutation<{ activation: LicenseActivationDTO }, Error, ActivateLicenseBody>({
        mutationFn: (body) =>
            jsonFetch(fetcher, `${base}/license/activate`, { method: 'POST', body: JSON.stringify(body) }),
    });
}

export interface DeactivateLicenseBody {
    key: string;
    activationId: string;
}

export function useDeactivateLicense(opts?: UsePayportOptions) {
    const { base, fetcher } = resolve(opts);
    return useMutation<{ ok: true }, Error, DeactivateLicenseBody>({
        mutationFn: (body) =>
            jsonFetch(fetcher, `${base}/license/deactivate`, { method: 'POST', body: JSON.stringify(body) }),
    });
}

// ------------------------------------------------------------
// usePublicPlans — DB-backed catalog for marketing/pricing pages.
// No auth required. Sorted by displayOrder.
// ------------------------------------------------------------
export interface PublicPlanDTO {
    slug: string;
    name: string;
    description: string | null;
    features: string[];
    priceLabel: string | null;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    displayOrder: number;
    isDefault: boolean;
}

export interface PublicPlansResponse {
    plans: PublicPlanDTO[];
}

export function usePublicPlans(opts?: UsePayportOptions & { queryOptions?: UseQueryOptions<PublicPlansResponse> }) {
    const { base, fetcher } = resolve(opts);
    return useQuery<PublicPlansResponse>({
        queryKey: ['payport', 'public-plans'],
        queryFn: () => jsonFetch<PublicPlansResponse>(fetcher, `${base}/plans`),
        ...(opts?.queryOptions ?? {}),
    });
}

// ------------------------------------------------------------
// Pending-plan handoff (homepage → register → checkout)
//
// Marketing/pricing pages call `capturePendingPlan(slug, interval)`
// before kicking the user to /register?plan=…. After successful
// signup, the post-auth redirect calls `consumePendingPlan()` and
// fires a checkout if one was queued. Stored in localStorage so it
// survives the OAuth round-trip.
// ------------------------------------------------------------
const PENDING_PLAN_KEY = 'payport_pending_plan';

export interface PendingPlanIntent {
    plan: string;
    interval?: 'monthly' | 'yearly';
    successUrl?: string;
    cancelUrl?: string;
}

export function capturePendingPlan(intent: PendingPlanIntent): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(PENDING_PLAN_KEY, JSON.stringify(intent));
    } catch {
        // localStorage unavailable (private browsing, quota); silently no-op.
    }
}

export function readPendingPlan(): PendingPlanIntent | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(PENDING_PLAN_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && typeof parsed.plan === 'string'
            ? (parsed as PendingPlanIntent)
            : null;
    } catch {
        return null;
    }
}

export function clearPendingPlan(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(PENDING_PLAN_KEY);
    } catch {
        /* no-op */
    }
}

/**
 * Read `?plan=...&interval=...` off the current URL and stash it as a
 * pending intent. Returns the parsed intent if one was found. Use on
 * the register/login pages to capture homepage CTAs.
 */
export function capturePendingPlanFromUrl(search?: string): PendingPlanIntent | null {
    if (typeof window === 'undefined' && !search) return null;
    const query = search ?? window.location.search;
    const params = new URLSearchParams(query);
    const plan = params.get('plan');
    if (!plan) return null;
    const interval = params.get('interval');
    const intent: PendingPlanIntent = {
        plan,
        interval: interval === 'yearly' ? 'yearly' : interval === 'monthly' ? 'monthly' : undefined,
    };
    capturePendingPlan(intent);
    return intent;
}
