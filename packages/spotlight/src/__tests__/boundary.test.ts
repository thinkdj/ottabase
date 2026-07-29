import { describe, expect, it } from 'vitest';
import * as root from '../index';

/**
 * Boundary guard: the '.' barrel (src/index.ts) MUST stay 100% pure.
 *
 * Rendered React UI (Spotlight, SpotlightProvider) lives exclusively behind
 * the '@ottabase/spotlight/react' subpath so that pure consumers never pull in
 * the optional UI peers (@ottabase/ui-shadcn, @radix-ui/react-dialog,
 * @tabler/icons-react). Importing the root here loads NO UI dependency, which
 * is exactly the property this test protects.
 */
describe('@ottabase/spotlight root barrel (pure)', () => {
    // Cast to a plain record so we can assert absence without TS complaining
    // about missing named exports.
    const mod = root as Record<string, unknown>;

    it('exposes the pure API surface', () => {
        expect(root.SpotlightContext).toBeDefined();
        expect(typeof root.useSpotlight).toBe('function');
        expect(typeof root.useSpotlightSearch).toBe('function');
        expect(typeof root.createApiSearchHandler).toBe('function');
        expect(typeof root.createApiSearchHandlerWithSignal).toBe('function');
    });

    it('does NOT re-export rendered UI components', () => {
        expect(mod.Spotlight).toBeUndefined();
        expect(mod.SpotlightProvider).toBeUndefined();
    });
});
