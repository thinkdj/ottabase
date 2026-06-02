// ============================================================
// Payport Admin — registry coverage
// ============================================================
//
// Smoke tests to keep the admin registry honest:
//   • Every Payport model has a matching entity descriptor.
//   • Every entity is reachable from the nav.
//   • Nav uses the closed `billing` id (host-app contract).
// ============================================================

import { describe, expect, it } from 'vitest';

import { PAYPORT_ADMIN_NAV } from '../admin/nav';
import { PAYPORT_ENTITIES, PAYPORT_ENTITIES_BY_KEY, getPayportEntity } from '../admin/entities';
import { PAYPORT_MODELS } from '../models';

describe('payport admin registry', () => {
    it('exposes one entity per registered model', () => {
        const modelEntities = new Set(PAYPORT_MODELS.map((m) => (m as { entity: string }).entity));
        const registryKeys = new Set(PAYPORT_ENTITIES.map((e) => e.key));
        for (const entity of modelEntities) {
            expect(registryKeys.has(entity), `Missing PAYPORT_ENTITIES entry for ${entity}`).toBe(true);
        }
    });

    it('builds an O(1) lookup by key', () => {
        for (const entity of PAYPORT_ENTITIES) {
            expect(PAYPORT_ENTITIES_BY_KEY[entity.key]).toBe(entity);
            expect(getPayportEntity(entity.key)).toBe(entity);
        }
        expect(() => getPayportEntity('does-not-exist')).toThrow(/Unknown entity/);
    });

    it('nav references the billing group with at least dashboard + every entity', () => {
        expect(PAYPORT_ADMIN_NAV.id).toBe('billing');
        const hrefs = PAYPORT_ADMIN_NAV.items.map((i) => i.href);
        expect(hrefs).toContain('/admin/billing');
        for (const entity of PAYPORT_ENTITIES) {
            const expectedSegment = entity.key.replace(/^payment_/, '');
            expect(
                hrefs.includes(`/admin/billing/${expectedSegment}`),
                `Nav missing item for entity ${entity.key}`,
            ).toBe(true);
        }
    });
});
