import { describe, expectTypeOf, it } from 'vitest';
import type { ProviderUIBaseProps } from '../index';

describe('ProviderUIBaseProps', () => {
    // Type-level: fails `type-check` if the export is the component type instead of its props.
    it('is the props interface, not the component', () => {
        expectTypeOf<ProviderUIBaseProps>().toHaveProperty('children');
        expectTypeOf<ProviderUIBaseProps['preventFOUC']>().toEqualTypeOf<boolean | undefined>();
    });
});
