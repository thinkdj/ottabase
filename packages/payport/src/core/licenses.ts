// ============================================================
// Payport — License Keys Service
// ============================================================
//
// Mirror of provider-issued license keys + activations. Validation
// and activation typically happen from a downloadable client app
// or storefront flow; the provider stays authoritative while this
// service keeps a fast local copy for analytics and rate-limiting.
// ============================================================

import { PaymentLicenseActivation, PaymentLicenseKey } from '../models';
import type {
    ActivateLicenseInput,
    DeactivateLicenseInput,
    LicenseActivationDTO,
    LicenseKeyDTO,
    PaymentProviderName,
    ValidateLicenseInput,
    ValidateLicenseResult,
} from '../types';
import { ProviderCapabilityError } from './capabilities';
import { emit } from './events';
import { getProvider } from './registry';

/** Mask a key string for safe local storage (`****-****-LAST4`). */
export function maskLicenseKey(key: string): string {
    if (!key) return '';
    const last4 = key.slice(-4);
    return `****-${last4}`;
}

export async function listLicenseKeys(query?: {
    userId?: string;
    externalCustomerId?: string;
}): Promise<LicenseKeyDTO[]> {
    const provider = getProvider();
    if (!provider.listLicenseKeys) throw new ProviderCapabilityError(provider.name, 'listLicenseKeys');
    const keys = await provider.listLicenseKeys(query);
    await Promise.all(keys.map((k) => upsertLocalLicenseKey(k)));
    return keys;
}

export async function getLicenseKey(externalLicenseKeyId: string): Promise<LicenseKeyDTO | null> {
    const provider = getProvider();
    if (!provider.getLicenseKey) throw new ProviderCapabilityError(provider.name, 'getLicenseKey');
    const key = await provider.getLicenseKey(externalLicenseKeyId);
    if (key) await upsertLocalLicenseKey(key);
    return key;
}

export async function validateLicenseKey(input: ValidateLicenseInput): Promise<ValidateLicenseResult> {
    const provider = getProvider();
    if (!provider.validateLicenseKey) throw new ProviderCapabilityError(provider.name, 'validateLicenseKey');
    const result = await provider.validateLicenseKey(input);
    if (result.licenseKey) {
        await upsertLocalLicenseKey(result.licenseKey);
        // Bump validations counter locally for rate-limit dashboards.
        const local = await PaymentLicenseKey.findByExternal(
            result.licenseKey.provider,
            result.licenseKey.externalLicenseKeyId,
        );
        if (local) {
            local.set('validations', ((local.get('validations') as number) ?? 0) + 1);
            await local.save();
        }
    }
    return result;
}

export async function activateLicenseKey(input: ActivateLicenseInput): Promise<LicenseActivationDTO> {
    const provider = getProvider();
    if (!provider.activateLicenseKey) throw new ProviderCapabilityError(provider.name, 'activateLicenseKey');
    const activation = await provider.activateLicenseKey(input);

    // Try to resolve the local license id (best-effort; the activation DTO
    // carries `licenseKeyId` as the provider-native id).
    const local = await PaymentLicenseKey.findByExternal(activation.provider, activation.licenseKeyId);
    await PaymentLicenseActivation.create({
        provider: activation.provider,
        externalActivationId: activation.externalActivationId,
        licenseKeyId: (local?.get('id') as string | undefined) ?? activation.licenseKeyId,
        externalLicenseKeyId: activation.licenseKeyId,
        label: activation.label ?? null,
        metadata: activation.metadata ? JSON.stringify(activation.metadata) : null,
        status: 'active',
    });

    if (local) {
        local.set('activationsCount', ((local.get('activationsCount') as number) ?? 0) + 1);
        await local.save();
    }

    await emit({
        type: 'payment.license_key.activated',
        provider: provider.name,
        externalEventId: `license.activated:${activation.externalActivationId}`,
        data: activation,
        occurredAt: new Date(),
    });

    return activation;
}

export async function deactivateLicenseKey(input: DeactivateLicenseInput): Promise<void> {
    const provider = getProvider();
    if (!provider.deactivateLicenseKey) throw new ProviderCapabilityError(provider.name, 'deactivateLicenseKey');
    await provider.deactivateLicenseKey(input);

    const activation = await PaymentLicenseActivation.where({
        provider: provider.name,
        externalActivationId: input.activationId,
    });
    const row = activation[0] as PaymentLicenseActivation | undefined;
    if (row) {
        row.set('status', 'deactivated');
        await row.save();
        // Decrement counter on owning license key (best-effort).
        const externalLicenseKeyId = row.get('externalLicenseKeyId') as string;
        const local = await PaymentLicenseKey.findByExternal(provider.name, externalLicenseKeyId);
        if (local) {
            const next = Math.max(0, ((local.get('activationsCount') as number) ?? 0) - 1);
            local.set('activationsCount', next);
            await local.save();
        }
    }

    await emit({
        type: 'payment.license_key.deactivated',
        provider: provider.name,
        externalEventId: `license.deactivated:${input.activationId}`,
        data: { activationId: input.activationId, key: maskLicenseKey(input.key) },
        occurredAt: new Date(),
    });
}

/** Upsert a license-key DTO from the provider into the local mirror. */
export async function upsertLocalLicenseKey(dto: LicenseKeyDTO): Promise<PaymentLicenseKey> {
    const existing = await PaymentLicenseKey.findByExternal(dto.provider, dto.externalLicenseKeyId);
    const fields = {
        userId: dto.userId ?? null,
        externalCustomerId: dto.externalCustomerId ?? null,
        externalProductId: dto.externalProductId ?? null,
        status: dto.status,
        activationsLimit: dto.activationsLimit ?? null,
        activationsCount: dto.activationsCount,
        usageLimit: dto.usageLimit ?? null,
        usage: dto.usage,
        validations: dto.validations,
        expiresAt: dto.expiresAt ?? null,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
    };
    if (existing) {
        for (const [key, value] of Object.entries(fields)) existing.set(key, value);
        await existing.save();
        return existing;
    }
    const created = await PaymentLicenseKey.create({
        provider: dto.provider,
        externalLicenseKeyId: dto.externalLicenseKeyId,
        keyMasked: maskLicenseKey(dto.key),
        ...fields,
    });
    return created as PaymentLicenseKey;
}

/** Re-export for callers that need to pre-build mirror rows from webhook payloads. */
export { upsertLocalLicenseKey as mirrorLicenseKey };

export type { PaymentProviderName };
