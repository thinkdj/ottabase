import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

vi.mock('@/ottabase/config', () => ({ APP_META: { appName: 'Ottabase' } }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, ...props }: { to: string } & ComponentProps<'a'>) => <a href={to} {...props} />,
}));

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

        // Dedicated Three.js hero remains useful even when WebGL is unavailable.
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /ship your thing\..*not the thing before the thing\..*or the thing after it\./i,
            }),
        ).toBeTruthy();
        expect(text).toContain('Cloudflare-native foundation');
        // The eyebrow is the only consumer of the appName prop.
        expect(text).toContain('Ottabase / EDGE-NATIVE FOUNDATION');
        expect(screen.getByText('Global by default')).toBeTruthy();
        expect(screen.getByText('Tenant-safe')).toBeTruthy();
        expect(screen.getByText('Already wired')).toBeTruthy();
        expect(screen.getByRole('link', { name: /start building/i })).toBeTruthy();
        expect(screen.getByRole('link', { name: /explore live demos/i })).toBeTruthy();

        // The Editor.js content starts after the hero and remains renderer-driven.
        expect(screen.getByText('Edge-native')).toBeTruthy();

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
    });
});
