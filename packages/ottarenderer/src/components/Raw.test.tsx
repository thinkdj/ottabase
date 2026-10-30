import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { blockRenderers } from '../renderers';
import Raw from './Raw';

describe('Raw renderer', () => {
    it('is registered for the raw block type', () => {
        expect(blockRenderers.raw).toBe(Raw);
    });

    it('sanitizes data.html', () => {
        const { container } = render(
            <Raw data={{ html: '<p>ok</p><img src="x" onerror="alert(1)"><script>alert(2)</script>' }} />,
        );

        expect(container.querySelector('p')?.textContent).toBe('ok');
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
    });
});
