import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/ottabase/config', () => ({ APP_META: { appName: 'Ottabase' } }));

import { HomePage } from '../HomePage';

/**
 * Smoke test for the landing content: every block in createHomeLandingEditorData
 * must survive the real OttaRenderer pipeline. A malformed block's data schema
 * fails here instead of rendering an empty hole on `/`.
 */
describe('HomePage (block content smoke)', () => {
    it('renders every block type used by the landing content', () => {
        const { container } = render(<HomePage />);
        const text = container.textContent ?? '';

        // header + hero
        expect(screen.getByRole('heading', { level: 1, name: 'Ottabase' })).toBeTruthy();
        expect(text).toContain('Production-grade');

        // quote
        expect(text).toContain('Stop assembling infrastructure. Start shipping product.');

        // checklists (split across a two-column layout)
        expect(text).toContain('fat models, RLS, hooks');
        expect(text).toContain('one click, done');

        // comparison table
        expect(screen.getByText('With Ottabase')).toBeTruthy();
        expect(screen.getByText('RLS enforced by the ORM')).toBeTruthy();

        // code block (highlighting splits tokens across spans, so match text content)
        expect(text).toContain('createModelHooks');

        // steps
        expect(text).toContain('Clone & install');

        // warning callout
        expect(screen.getByText('One account. No servers.')).toBeTruthy();

        // spoiler (text is present but obscured until clicked)
        expect(text).toContain('The landing page is the demo');

        // faq
        expect(text).toContain('Can I white-label it for clients?');

        // references
        expect(screen.getByText('Demo gallery')).toBeTruthy();

        // CTAs
        expect(screen.getAllByText('Explore demos').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Get started').length).toBeGreaterThan(0);
    });
});
