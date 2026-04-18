import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Warning from './Warning';

describe('Warning Renderer', () => {
    it('stacks message content under title instead of inline with icon row', () => {
        const { container } = render(
            <Warning
                data={{
                    title: 'Important Note',
                    message: 'Always backup your data before making changes to production systems.',
                }}
            />,
        );

        const alert = container.querySelector('[role="alert"]');
        expect(alert).toBeTruthy();

        const textStack = alert?.querySelector('.min-w-0');
        expect(textStack).toBeTruthy();
        expect(textStack?.querySelector('h4')?.textContent).toContain('Important Note');
        expect(textStack?.querySelector('p')?.textContent).toContain('Always backup your data');

        expect(screen.getByText('Important Note')).toBeTruthy();
        expect(screen.getByText(/Always backup your data/)).toBeTruthy();
    });
});
