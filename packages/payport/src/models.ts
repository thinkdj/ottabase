// ============================================================
// Payport — OttaORM Models (Fat Models)
// ============================================================
//
// All models extend BaseModel and stay deliberately thin: domain
// logic lives in the methods exposed here, but most CRUD goes
// through OttaORM's generic API or through the Payport service
// facade (see `../core/`).
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import {
    paymentCheckoutsTable,
    paymentCustomersTable,
    paymentDiscountsTable,
    paymentEntitlementsTable,
    paymentEventsTable,
    paymentLicenseActivationsTable,
    paymentLicenseKeysTable,
    paymentMeterEventsTable,
    paymentMetersTable,
    paymentPlansTable,
    paymentProductsTable,
    paymentRefundsTable,
    paymentSubscriptionsTable,
} from './schema';

const PACKAGE_NAME = '@ottabase/payport';
const PACKAGE_TYPE: PackageType = 'package';

const idField: ModelFields[string] = {
    type: 'id',
    primaryKey: true,
    editable: false,
    uiConfig: { label: 'ID' },
};

// ============================================================
// PaymentCustomer
// ============================================================

export class PaymentCustomer extends BaseModel {
    static entity = 'payment_customers';
    static table = paymentCustomersTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['provider', 'externalCustomerId', 'userId', 'email', 'metadata', 'organizationId', 'appId'],
        update: ['email', 'metadata'],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        externalCustomerId: { type: 'string', editable: false, searchable: true },
        userId: { type: 'string', editable: false, filterable: true },
        email: { type: 'string', editable: true, searchable: true },
        metadata: { type: 'json', editable: true },
        organizationId: { type: 'string', editable: false, filterable: true },
        appId: { type: 'string', editable: false, filterable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    static async findByUser(provider: string, userId: string): Promise<PaymentCustomer | null> {
        const rows = await this.where({ provider, userId });
        return (rows[0] as PaymentCustomer | undefined) ?? null;
    }

    static async findByExternal(provider: string, externalCustomerId: string): Promise<PaymentCustomer | null> {
        const rows = await this.where({ provider, externalCustomerId });
        return (rows[0] as PaymentCustomer | undefined) ?? null;
    }
}

// ============================================================
// PaymentPlan
// ============================================================

export class PaymentPlan extends BaseModel {
    static entity = 'payment_plans';
    static table = paymentPlansTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        active: 'boolean' as const,
        isDefault: 'boolean' as const,
        isPublic: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'slug',
            'name',
            'description',
            'provider',
            'providerProductId',
            'features',
            'priceLabel',
            'priceMonthly',
            'priceYearly',
            'currency',
            'displayOrder',
            'isDefault',
            'isPublic',
            'metadata',
            'active',
        ],
        update: [
            'name',
            'description',
            'providerProductId',
            'features',
            'priceLabel',
            'priceMonthly',
            'priceYearly',
            'currency',
            'displayOrder',
            'isDefault',
            'isPublic',
            'metadata',
            'active',
        ],
    };

    protected static fields: ModelFields = {
        id: idField,
        slug: { type: 'string', editable: false, searchable: true, filterable: true },
        name: { type: 'string', editable: true, searchable: true },
        description: { type: 'string', editable: true },
        provider: { type: 'string', editable: false, filterable: true },
        providerProductId: { type: 'string', editable: true },
        features: { type: 'json', editable: true },
        priceLabel: { type: 'string', editable: true },
        priceMonthly: { type: 'number', editable: true, uiConfig: { label: 'Price / month (cents)' } },
        priceYearly: { type: 'number', editable: true, uiConfig: { label: 'Price / year (cents)' } },
        currency: { type: 'string', editable: true },
        displayOrder: { type: 'number', editable: true, sortable: true },
        isDefault: { type: 'boolean', editable: true, filterable: true },
        isPublic: { type: 'boolean', editable: true, filterable: true },
        metadata: { type: 'json', editable: true },
        active: { type: 'boolean', editable: true, filterable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    static async findBySlug(slug: string): Promise<PaymentPlan | null> {
        const rows = await this.where({ slug });
        return (rows[0] as PaymentPlan | undefined) ?? null;
    }

    /** Returns the plan flagged `isDefault=true` (and active), if any. */
    static async findDefault(): Promise<PaymentPlan | null> {
        const rows = await this.where({ isDefault: true, active: true });
        return (rows[0] as PaymentPlan | undefined) ?? null;
    }

    /** Parse features JSON column safely. */
    getFeatures(): string[] {
        const raw = this.get('features') as string | string[] | undefined;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string') : [];
        } catch {
            return [];
        }
    }
}

// ============================================================
// PaymentProduct
// ============================================================

export class PaymentProduct extends BaseModel {
    static entity = 'payment_products';
    static table = paymentProductsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['provider', 'externalProductId', 'name', 'description', 'metadata'],
        update: ['name', 'description', 'metadata'],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        externalProductId: { type: 'string', editable: false, searchable: true },
        name: { type: 'string', editable: true, searchable: true },
        description: { type: 'string', editable: true },
        metadata: { type: 'json', editable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };
}

// ============================================================
// PaymentSubscription
// ============================================================

export class PaymentSubscription extends BaseModel {
    static entity = 'payment_subscriptions';
    static table = paymentSubscriptionsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        cancelAtPeriodEnd: 'boolean' as const,
        currentPeriodStart: 'date' as const,
        currentPeriodEnd: 'date' as const,
        trialEndsAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'userId',
            'provider',
            'externalSubscriptionId',
            'planSlug',
            'status',
            'currentPeriodStart',
            'currentPeriodEnd',
            'cancelAtPeriodEnd',
            'trialEndsAt',
            'organizationId',
            'appId',
            'metadata',
        ],
        update: [
            'planSlug',
            'status',
            'currentPeriodStart',
            'currentPeriodEnd',
            'cancelAtPeriodEnd',
            'trialEndsAt',
            'metadata',
        ],
    };

    protected static fields: ModelFields = {
        id: idField,
        userId: { type: 'string', editable: false, filterable: true },
        provider: { type: 'string', editable: false, filterable: true },
        externalSubscriptionId: { type: 'string', editable: false, searchable: true },
        planSlug: { type: 'string', editable: true, filterable: true },
        status: { type: 'string', editable: true, filterable: true },
        currentPeriodStart: { type: 'date', editable: true, sortable: true },
        currentPeriodEnd: { type: 'date', editable: true, sortable: true },
        cancelAtPeriodEnd: { type: 'boolean', editable: true },
        trialEndsAt: { type: 'date', editable: true },
        organizationId: { type: 'string', editable: false, filterable: true },
        appId: { type: 'string', editable: false, filterable: true },
        metadata: { type: 'json', editable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    /** Returns the most recent active-ish subscription for a user.
     * Uses DB-level IN filter for status so only matching rows are loaded.
     */
    static async activeForUser(userId: string): Promise<PaymentSubscription | null> {
        const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];
        const rows = (await this.where(
            { userId, status: ACTIVE_STATUSES },
            { orderBy: 'updatedAt', orderDirection: 'desc', limit: 1 },
        )) as PaymentSubscription[];
        return rows[0] ?? null;
    }

    static async findByExternal(provider: string, externalSubscriptionId: string): Promise<PaymentSubscription | null> {
        const rows = await this.where({ provider, externalSubscriptionId });
        return (rows[0] as PaymentSubscription | undefined) ?? null;
    }

    isActive(): boolean {
        const status = this.get('status') as string;
        return status === 'active' || status === 'trialing';
    }
}

// ============================================================
// PaymentCheckout
// ============================================================

export class PaymentCheckout extends BaseModel {
    static entity = 'payment_checkouts';
    static table = paymentCheckoutsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'userId',
            'provider',
            'externalCheckoutId',
            'planSlug',
            'checkoutUrl',
            'status',
            'successUrl',
            'cancelUrl',
            'metadata',
            'appId',
        ],
        update: ['status', 'metadata'],
    };

    protected static fields: ModelFields = {
        id: idField,
        userId: { type: 'string', editable: false, filterable: true },
        provider: { type: 'string', editable: false, filterable: true },
        externalCheckoutId: { type: 'string', editable: false, searchable: true },
        planSlug: { type: 'string', editable: false, filterable: true },
        checkoutUrl: { type: 'string', editable: false },
        status: { type: 'string', editable: true, filterable: true },
        successUrl: { type: 'string', editable: false },
        cancelUrl: { type: 'string', editable: false },
        metadata: { type: 'json', editable: true },
        appId: { type: 'string', editable: false, filterable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };
}

// ============================================================
// PaymentEntitlement
// ============================================================

export class PaymentEntitlement extends BaseModel {
    static entity = 'payment_entitlements';
    static table = paymentEntitlementsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        expiresAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['userId', 'feature', 'source', 'sourceId', 'expiresAt'],
        update: ['source', 'sourceId', 'expiresAt'],
    };

    protected static fields: ModelFields = {
        id: idField,
        userId: { type: 'string', editable: false, filterable: true },
        feature: { type: 'string', editable: false, filterable: true, searchable: true },
        source: { type: 'string', editable: true, filterable: true },
        sourceId: { type: 'string', editable: true },
        expiresAt: { type: 'date', editable: true, sortable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    static async featuresForUser(userId: string): Promise<string[]> {
        // OttaORM's where() doesn't support $gt/$lt comparisons, so expiry
        // filtering is done in JS. The result set is bounded (one row per
        // explicitly-granted feature per user), so loading all rows is fine.
        const rows = (await this.where({ userId })) as PaymentEntitlement[];
        const now = Date.now();
        return rows
            .filter((r) => {
                const expires = r.get('expiresAt') as Date | null;
                return !expires || expires.getTime() > now;
            })
            .map((r) => r.get('feature') as string);
    }
}

// ============================================================
// PaymentEvent
// ============================================================

export class PaymentEvent extends BaseModel {
    static entity = 'payment_events';
    static table = paymentEventsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        receivedAt: 'date' as const,
        processedAt: 'date' as const,
    };

    static writable = {
        create: [
            'provider',
            'externalEventId',
            'eventType',
            'rawPayload',
            'normalizedPayload',
            'status',
            'attemptCount',
            'lastError',
            'processedAt',
        ],
        update: ['status', 'attemptCount', 'lastError', 'processedAt', 'normalizedPayload'],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        externalEventId: { type: 'string', editable: false, searchable: true },
        eventType: { type: 'string', editable: false, filterable: true, searchable: true },
        rawPayload: { type: 'string', editable: false },
        normalizedPayload: { type: 'string', editable: false },
        status: { type: 'string', editable: true, filterable: true },
        attemptCount: { type: 'number', editable: true, sortable: true },
        lastError: { type: 'string', editable: true },
        processedAt: { type: 'date', editable: true, sortable: true },
        receivedAt: { type: 'date', editable: false, sortable: true },
    };

    static async findByExternal(provider: string, externalEventId: string): Promise<PaymentEvent | null> {
        const rows = await this.where({ provider, externalEventId });
        return (rows[0] as PaymentEvent | undefined) ?? null;
    }
}

// ============================================================
// PaymentDiscount
// ============================================================

export class PaymentDiscount extends BaseModel {
    static entity = 'payment_discounts';
    static table = paymentDiscountsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        active: 'boolean' as const,
        redeemBy: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'provider',
            'externalDiscountId',
            'slug',
            'code',
            'name',
            'type',
            'amount',
            'currency',
            'duration',
            'durationInMonths',
            'maxRedemptions',
            'redeemBy',
            'active',
            'metadata',
        ],
        update: ['name', 'code', 'active', 'maxRedemptions', 'redeemBy', 'metadata'],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        externalDiscountId: { type: 'string', editable: false, searchable: true },
        slug: { type: 'string', editable: false, searchable: true },
        code: { type: 'string', editable: true, searchable: true },
        name: { type: 'string', editable: true, searchable: true },
        type: { type: 'string', editable: false, filterable: true },
        amount: { type: 'number', editable: false },
        currency: { type: 'string', editable: false },
        duration: { type: 'string', editable: false },
        durationInMonths: { type: 'number', editable: false },
        maxRedemptions: { type: 'number', editable: true },
        redeemBy: { type: 'date', editable: true, sortable: true },
        active: { type: 'boolean', editable: true, filterable: true },
        metadata: { type: 'json', editable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    static async findByCode(provider: string, code: string): Promise<PaymentDiscount | null> {
        const rows = await this.where({ provider, code });
        return (rows[0] as PaymentDiscount | undefined) ?? null;
    }

    static async findByExternal(provider: string, externalDiscountId: string): Promise<PaymentDiscount | null> {
        const rows = await this.where({ provider, externalDiscountId });
        return (rows[0] as PaymentDiscount | undefined) ?? null;
    }
}

// ============================================================
// PaymentMeter
// ============================================================

export class PaymentMeter extends BaseModel {
    static entity = 'payment_meters';
    static table = paymentMetersTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        active: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['provider', 'externalMeterId', 'slug', 'name', 'aggregation', 'unit', 'metadata', 'active'],
        update: ['name', 'aggregation', 'unit', 'metadata', 'active'],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        externalMeterId: { type: 'string', editable: false, searchable: true },
        slug: { type: 'string', editable: false, searchable: true, filterable: true },
        name: { type: 'string', editable: true, searchable: true },
        aggregation: { type: 'string', editable: true, filterable: true },
        unit: { type: 'string', editable: true },
        metadata: { type: 'json', editable: true },
        active: { type: 'boolean', editable: true, filterable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    static async findBySlug(slug: string): Promise<PaymentMeter | null> {
        const rows = await this.where({ slug });
        return (rows[0] as PaymentMeter | undefined) ?? null;
    }
}

// ============================================================
// PaymentMeterEvent (usage ingest log)
// ============================================================

export class PaymentMeterEvent extends BaseModel {
    static entity = 'payment_meter_events';
    static table = paymentMeterEventsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        occurredAt: 'date' as const,
        sentAt: 'date' as const,
    };

    static writable = {
        create: [
            'provider',
            'meterSlug',
            'externalMeterId',
            'userId',
            'externalCustomerId',
            'externalEventId',
            'value',
            'metadata',
            'status',
            'lastError',
            'occurredAt',
            'sentAt',
        ],
        update: ['status', 'lastError', 'sentAt'],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        meterSlug: { type: 'string', editable: false, filterable: true, searchable: true },
        externalMeterId: { type: 'string', editable: false },
        userId: { type: 'string', editable: false, filterable: true },
        externalCustomerId: { type: 'string', editable: false },
        externalEventId: { type: 'string', editable: false, searchable: true },
        value: { type: 'number', editable: false },
        metadata: { type: 'json', editable: false },
        status: { type: 'string', editable: true, filterable: true },
        lastError: { type: 'string', editable: true },
        occurredAt: { type: 'date', editable: false, sortable: true },
        sentAt: { type: 'date', editable: true, sortable: true },
    };

    static async findByExternal(provider: string, externalEventId: string): Promise<PaymentMeterEvent | null> {
        const rows = await this.where({ provider, externalEventId });
        return (rows[0] as PaymentMeterEvent | undefined) ?? null;
    }
}

// ============================================================
// PaymentRefund
// ============================================================

export class PaymentRefund extends BaseModel {
    static entity = 'payment_refunds';
    static table = paymentRefundsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'provider',
            'externalRefundId',
            'externalOrderId',
            'externalSubscriptionId',
            'externalCustomerId',
            'userId',
            'amount',
            'currency',
            'reason',
            'status',
            'metadata',
        ],
        update: ['status', 'reason', 'metadata'],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        externalRefundId: { type: 'string', editable: false, searchable: true },
        externalOrderId: { type: 'string', editable: false, filterable: true },
        externalSubscriptionId: { type: 'string', editable: false, filterable: true },
        externalCustomerId: { type: 'string', editable: false },
        userId: { type: 'string', editable: false, filterable: true },
        amount: { type: 'number', editable: false, sortable: true },
        currency: { type: 'string', editable: false, filterable: true },
        reason: { type: 'string', editable: true },
        status: { type: 'string', editable: true, filterable: true },
        metadata: { type: 'json', editable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    static async findByExternal(provider: string, externalRefundId: string): Promise<PaymentRefund | null> {
        const rows = await this.where({ provider, externalRefundId });
        return (rows[0] as PaymentRefund | undefined) ?? null;
    }
}

// ============================================================
// PaymentLicenseKey
// ============================================================

export class PaymentLicenseKey extends BaseModel {
    static entity = 'payment_license_keys';
    static table = paymentLicenseKeysTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        expiresAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'provider',
            'externalLicenseKeyId',
            'keyMasked',
            'userId',
            'externalCustomerId',
            'externalProductId',
            'status',
            'activationsLimit',
            'activationsCount',
            'usageLimit',
            'usage',
            'validations',
            'expiresAt',
            'metadata',
        ],
        update: [
            'status',
            'activationsLimit',
            'activationsCount',
            'usageLimit',
            'usage',
            'validations',
            'expiresAt',
            'metadata',
        ],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        externalLicenseKeyId: { type: 'string', editable: false, searchable: true },
        keyMasked: { type: 'string', editable: false, searchable: true },
        userId: { type: 'string', editable: false, filterable: true },
        externalCustomerId: { type: 'string', editable: false },
        externalProductId: { type: 'string', editable: false, filterable: true },
        status: { type: 'string', editable: true, filterable: true },
        activationsLimit: { type: 'number', editable: true },
        activationsCount: { type: 'number', editable: true, sortable: true },
        usageLimit: { type: 'number', editable: true },
        usage: { type: 'number', editable: true, sortable: true },
        validations: { type: 'number', editable: true, sortable: true },
        expiresAt: { type: 'date', editable: true, sortable: true },
        metadata: { type: 'json', editable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    static async findByExternal(provider: string, externalLicenseKeyId: string): Promise<PaymentLicenseKey | null> {
        const rows = await this.where({ provider, externalLicenseKeyId });
        return (rows[0] as PaymentLicenseKey | undefined) ?? null;
    }

    static async forUser(userId: string): Promise<PaymentLicenseKey[]> {
        return (await this.where({ userId })) as PaymentLicenseKey[];
    }
}

// ============================================================
// PaymentLicenseActivation
// ============================================================

export class PaymentLicenseActivation extends BaseModel {
    static entity = 'payment_license_activations';
    static table = paymentLicenseActivationsTable;
    static primaryKey = 'id';
    static packageName = PACKAGE_NAME;
    static packageType = PACKAGE_TYPE;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'provider',
            'externalActivationId',
            'licenseKeyId',
            'externalLicenseKeyId',
            'label',
            'metadata',
            'status',
        ],
        update: ['label', 'metadata', 'status'],
    };

    protected static fields: ModelFields = {
        id: idField,
        provider: { type: 'string', editable: false, filterable: true },
        externalActivationId: { type: 'string', editable: false, searchable: true },
        licenseKeyId: { type: 'string', editable: false, filterable: true },
        externalLicenseKeyId: { type: 'string', editable: false, filterable: true },
        label: { type: 'string', editable: true, searchable: true },
        metadata: { type: 'json', editable: true },
        status: { type: 'string', editable: true, filterable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };
}

export const PAYPORT_MODELS = [
    PaymentCustomer,
    PaymentPlan,
    PaymentProduct,
    PaymentSubscription,
    PaymentCheckout,
    PaymentEntitlement,
    PaymentEvent,
    PaymentDiscount,
    PaymentMeter,
    PaymentMeterEvent,
    PaymentRefund,
    PaymentLicenseKey,
    PaymentLicenseActivation,
];
