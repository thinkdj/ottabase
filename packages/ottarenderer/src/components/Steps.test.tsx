import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { customRenderers } from '../EditorJsRenderer';
import Steps from './Steps';

describe('Steps renderer', () => {
    it('renders numbered steps with titles and content', () => {
        const { container } = render(
            <Steps
                data={{
                    items: [
                        { title: 'Create the outline', content: 'Start with the structure of the guide.' },
                        { title: 'Add supporting details', content: 'Fill each step with the key information.' },
                    ],
                }}
            />,
        );

        expect(screen.getByLabelText('Step list')).toBeTruthy();
        expect(screen.getByText('Create the outline')).toBeTruthy();
        expect(screen.getByText('Add supporting details')).toBeTruthy();
        expect(container.querySelector('[data-step-index="1"]')).toBeTruthy();
        expect(container.querySelector('[data-step-index="2"]')).toBeTruthy();
    });

    it('skips empty steps and returns null for empty payloads', () => {
        const { container, rerender } = render(
            <Steps
                data={{
                    items: [
                        { title: '', content: '' },
                        { title: 'Only valid step', content: '' },
                    ],
                }}
            />,
        );

        expect(screen.getByText('Only valid step')).toBeTruthy();
        expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(1);

        rerender(<Steps data={{ items: [{ title: '', content: '' }] }} />);
        expect(container.firstChild).toBeNull();
    });

    it('is registered in the renderer map', () => {
        expect(customRenderers.steps).toBe(Steps);
    });
});
