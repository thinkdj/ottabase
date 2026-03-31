import { describe, expect, it } from 'vitest';
import { getHomepageVariantIdsForSlot, homepageSlotVariantRegistry } from '../slot-registry';
import { homepageSlotNames } from '../schemas';

describe('homepageSlotVariantRegistry', () => {
    it('covers every slot name with at least two variants', () => {
        for (const slot of homepageSlotNames) {
            expect(homepageSlotVariantRegistry[slot].variants.length).toBeGreaterThanOrEqual(2);
            expect(homepageSlotVariantRegistry[slot].defaultVariant).toBeTruthy();
        }
    });

    it('getHomepageVariantIdsForSlot returns ids', () => {
        expect(getHomepageVariantIdsForSlot('hero')).toEqual(['centered', 'split', 'minimal']);
    });
});
