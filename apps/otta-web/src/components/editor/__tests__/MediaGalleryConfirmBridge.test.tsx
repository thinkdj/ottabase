import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MediaGalleryConfirmBridge } from '../MediaGalleryConfirmBridge';

vi.mock('@ottabase/ui-components', () => ({
    ConfirmDialog: () => null,
}));

describe('MediaGalleryConfirmBridge', () => {
    it('publishes bridge availability only while mounted', () => {
        const { unmount } = render(<MediaGalleryConfirmBridge />);

        expect(window.__mgConfirmBridgeActive).toBe(true);

        unmount();
        expect(window.__mgConfirmBridgeActive).toBeUndefined();
    });
});
