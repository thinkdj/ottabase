import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/forms/react', () => ({
    ModelCrud: ({ config, header }: { config: { entity: string }; header?: ReactNode }) => (
        <div>
            {header}
            <span data-testid="selected-model">{config.entity}</span>
        </div>
    ),
}));

vi.mock('../../DemoPageHeader', () => ({
    DemoPageHeader: ({ title, description }: { title: string; description: string }) => (
        <header>
            <h1>{title}</h1>
            <p>{description}</p>
        </header>
    ),
}));

import { OttaFormsDemoPage } from '../OttaFormsDemoPage';

describe('OttaFormsDemoPage', () => {
    it('keeps Users as an explicit protected auto-CRUD demonstration', () => {
        render(<OttaFormsDemoPage />);

        expect(screen.getByRole('heading', { name: /Users/ })).toBeTruthy();
        expect(screen.getByText('Protected')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Test Access Boundary' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Test Access Boundary' }));

        expect(screen.getByText('Protected model demonstration')).toBeTruthy();
        expect(screen.getByText('Expected 403')).toBeTruthy();
        expect(screen.getByText(/metadata never grants API access/i)).toBeTruthy();
        expect(screen.getByTestId('selected-model').textContent).toBe('users');
    });
});
